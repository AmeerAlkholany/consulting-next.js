import { describe, expect, it } from "vitest";
import { generateSlots } from "@/server/services/availability";
import type { AvailabilityRuleRow } from "@/server/dal/availability";

/**
 * Tests are timezone-independent: they pin UTC dates and assert on UTC instants.
 * The slot engine should produce the same UTC output regardless of machine TZ.
 */

const CONSULTANT_TZ = "Europe/Berlin";
const SESSION_DURATION = 60; // minutes

const baseRule: AvailabilityRuleRow = {
  id: "rule-1",
  consultantProfileId: "consultant-1",
  weekday: 0, // Monday
  startMinute: 540, // 09:00
  endMinute: 1020, // 17:00
  effectiveFrom: null,
  effectiveUntil: null,
  isActive: true,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

function makeParams(
  overrides: Partial<Parameters<typeof generateSlots>[0]> = {},
): Parameters<typeof generateSlots>[0] {
  return {
    rules: [baseRule],
    exceptions: [],
    appointments: [],
    bufferMinutes: 10,
    leadTimeMinutes: 12 * 60, // 12 hours
    maxAdvanceMinutes: 60 * 24 * 60, // 60 days
    from: new Date("2026-06-15T00:00:00.000Z"), // Monday in UTC
    to: new Date("2026-06-29T23:59:59.999Z"),
    now: new Date("2026-06-14T10:00:00.000Z"), // Day before, so June 15 slots are within lead time
    consultantTimezone: CONSULTANT_TZ,
    sessionDurationMinutes: SESSION_DURATION,
    ...overrides,
  };
}

function toUtcStr(date: Date): string {
  return date.toISOString();
}

describe("slot generation", () => {
  describe("basic week", () => {
    it("generates Monday slots for a simple week", () => {
      const result = generateSlots(makeParams());

      // Should have slots for Monday June 15 (09:00 CEST = 07:00 UTC)
      const monday = result.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();
      expect(monday!.slots.length).toBeGreaterThan(0);
      // 09:00 CEST = 07:00 UTC
      expect(toUtcStr(monday!.slots[0].startsAt)).toBe("2026-06-15T07:00:00.000Z");
      // 09:00 + 60min session = 10:00 CEST = 08:00 UTC
      expect(toUtcStr(monday!.slots[0].endsAt)).toBe("2026-06-15T08:00:00.000Z");
    });

    it("generates multiple slots within one day", () => {
      // 09:00-17:00 = 480 min, session 60min, step 65min (60+5 slotStepMinutes)
      // Slots: 09:00, 10:05, 11:10, 12:15, 13:20, 14:25, 15:30 (7 slots)
      const result = generateSlots(makeParams());
      const monday = result.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();
      expect(monday!.slots.length).toBe(7);
    });

    it("generates slots for consecutive weeks", () => {
      const result = generateSlots(makeParams());
      const dates = result.days.map((d) => d.date);
      // Should include June 15, 22, and 29 (all Mondays)
      expect(dates).toContain("2026-06-15");
      expect(dates).toContain("2026-06-22");
      expect(dates).toContain("2026-06-29");
    });
  });

  describe("lead time and max advance", () => {
    it("respects lead time (no slots before lead time)", () => {
      const result = generateSlots(
        makeParams({
          now: new Date("2026-06-15T10:00:00.000Z"),
          leadTimeMinutes: 24 * 60, // 24 hours
        }),
      );

      // June 15 09:00 UTC = 2026-06-15T07:00:00Z
      // Lead time: now + 24h = 2026-06-16T10:00:00Z
      // So June 15 slots should be filtered out
      const june15 = result.days.find((d) => d.date === "2026-06-15");
      expect(june15).toBeUndefined();

      // June 16 is Tuesday (not Monday), so no slots
      // June 17-21 also not Monday
      const june22 = result.days.find((d) => d.date === "2026-06-22");
      expect(june22).toBeDefined();
      expect(june22!.slots.length).toBeGreaterThan(0);
    });

    it("respects max advance", () => {
      const result = generateSlots(
        makeParams({
          maxAdvanceMinutes: 12 * 60, // 12 hours
          to: new Date("2026-06-30T23:59:59.999Z"),
        }),
      );

      // now + 12h = 2026-06-14T22:00:00Z
      // June 15 slots start at 07:00 UTC which is AFTER 22:00 UTC
      // So June 15 should be filtered out
      const june15 = result.days.find((d) => d.date === "2026-06-15");
      expect(june15).toBeUndefined();

      // All other days are even further away
      expect(result.days.length).toBe(0);
    });
  });

  describe("buffer application", () => {
    it("applies buffer to booked appointments", () => {
      const mondayAppt = {
        startsAt: new Date("2026-06-15T09:00:00.000Z"), // Monday 09:00 UTC
        endsAt: new Date("2026-06-15T10:00:00.000Z"),
      };

      const resultWithAppt = generateSlots(
        makeParams({
          appointments: [mondayAppt],
          bufferMinutes: 10,
        }),
      );

      const monday = resultWithAppt.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();

      // With 10 min buffer: appointment at 09:00-10:00 blocks 08:50-10:10
      // Slots starting in or overlapping this window must be removed
      const hasOverlappingSlot = monday!.slots.some((s) => {
        return (
          s.startsAt < new Date("2026-06-15T10:10:00.000Z") &&
          s.endsAt > new Date("2026-06-15T08:50:00.000Z")
        );
      });
      expect(hasOverlappingSlot).toBe(false);
    });
  });

  describe("exceptions", () => {
    it("BLOCK exception removes whole day", () => {
      const result = generateSlots(
        makeParams({
          exceptions: [
            {
              id: "exc-1",
              consultantProfileId: "consultant-1",
              date: new Date("2026-06-15T00:00:00.000Z"),
              type: "BLOCK",
              startMinute: null,
              endMinute: null,
              reason: "Holiday",
              createdAt: new Date("2026-06-01T00:00:00.000Z"),
            },
          ],
        }),
      );

      const monday = result.days.find((d) => d.date === "2026-06-15");
      // Day is filtered out when all slots are blocked
      expect(monday).toBeUndefined();
    });

    it("BLOCK exception removes partial day", () => {
      const result = generateSlots(
        makeParams({
          exceptions: [
            {
              id: "exc-1",
              consultantProfileId: "consultant-1",
              date: new Date("2026-06-15T00:00:00.000Z"),
              type: "BLOCK",
              startMinute: 540, // 09:00
              endMinute: 720, // 12:00
              reason: "Meeting",
              createdAt: new Date("2026-06-01T00:00:00.000Z"),
            },
          ],
        }),
      );

      const monday = result.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();
      // 09:00-12:00 blocked, 12:00-17:00 should remain
      // First slot should start at or after 12:00 CEST (10:00 UTC)
      const afternoonSlots = monday!.slots.filter(
        (s) => s.startsAt >= new Date("2026-06-15T10:00:00.000Z"),
      );
      expect(afternoonSlots.length).toBeGreaterThan(0);
    });

    it("EXTRA exception adds slots", () => {
      const result = generateSlots(
        makeParams({
          exceptions: [
            {
              id: "exc-1",
              consultantProfileId: "consultant-1",
              date: new Date("2026-06-15T00:00:00.000Z"),
              type: "EXTRA",
              startMinute: 1080, // 18:00
              endMinute: 1260, // 21:00
              reason: "Evening hours",
              createdAt: new Date("2026-06-01T00:00:00.000Z"),
            },
          ],
        }),
      );

      const monday = result.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();
      // Extra slots should start at 18:00 CEST (16:00 UTC)
      const eveningSlots = monday!.slots.filter(
        (s) => s.startsAt >= new Date("2026-06-15T16:00:00.000Z"),
      );
      expect(eveningSlots.length).toBeGreaterThan(0);
    });
  });

  describe("DST transitions", () => {
    it("handles Europe/Berlin summer time (CEST, UTC+2)", () => {
      const result = generateSlots(
        makeParams({
          from: new Date("2026-06-15T00:00:00.000Z"),
          to: new Date("2026-06-21T23:59:59.999Z"),
          consultantTimezone: "Europe/Berlin",
        }),
      );

      const monday = result.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();
      // 09:00 CEST = 07:00 UTC
      expect(toUtcStr(monday!.slots[0].startsAt)).toBe("2026-06-15T07:00:00.000Z");
    });

    it("handles Europe/Berlin winter time (CET, UTC+1)", () => {
      // January 4, 2027 is a Monday in UTC
      const result = generateSlots(
        makeParams({
          from: new Date("2027-01-04T00:00:00.000Z"),
          to: new Date("2027-01-10T23:59:59.999Z"),
          consultantTimezone: "Europe/Berlin",
          now: new Date("2027-01-03T10:00:00.000Z"),
        }),
      );

      const monday = result.days.find((d) => d.date === "2027-01-04");
      expect(monday).toBeDefined();
      // 09:00 CET = 08:00 UTC
      expect(toUtcStr(monday!.slots[0].startsAt)).toBe("2027-01-04T08:00:00.000Z");
    });

    it("keeps 09:00 local across DST transition", () => {
      // Spring forward: March 29, 2026 (Sunday in Berlin, but March 30 is Monday)
      // Before: March 23 is Monday, 09:00 CET = 08:00 UTC
      // After: March 30 is Monday, 09:00 CEST = 07:00 UTC
      const before = generateSlots(
        makeParams({
          from: new Date("2026-03-23T00:00:00.000Z"),
          to: new Date("2026-03-29T23:59:59.999Z"),
          consultantTimezone: "Europe/Berlin",
          now: new Date("2026-03-22T10:00:00.000Z"),
        }),
      );

      const after = generateSlots(
        makeParams({
          from: new Date("2026-03-30T00:00:00.000Z"),
          to: new Date("2026-04-05T23:59:59.999Z"),
          consultantTimezone: "Europe/Berlin",
          now: new Date("2026-03-29T10:00:00.000Z"),
        }),
      );

      const mondayBefore = before.days.find((d) => d.date === "2026-03-23");
      const mondayAfter = after.days.find((d) => d.date === "2026-03-30");

      expect(mondayBefore).toBeDefined();
      expect(mondayAfter).toBeDefined();

      // Before spring forward: 09:00 CET = 08:00 UTC
      expect(toUtcStr(mondayBefore!.slots[0].startsAt)).toBe("2026-03-23T08:00:00.000Z");
      // After spring forward: 09:00 CEST = 07:00 UTC
      expect(toUtcStr(mondayAfter!.slots[0].startsAt)).toBe("2026-03-30T07:00:00.000Z");
    });

    it("drops slots in spring-forward gap", () => {
      // March 29, 2026: clocks spring forward from 02:00 to 03:00
      // 02:30 doesn't exist
      const result = generateSlots(
        makeParams({
          rules: [
            {
              ...baseRule,
              startMinute: 150, // 02:30
              endMinute: 180, // 03:00
            },
          ],
          from: new Date("2026-03-29T00:00:00.000Z"),
          to: new Date("2026-03-29T23:59:59.999Z"),
          consultantTimezone: "Europe/Berlin",
          now: new Date("2026-03-29T10:00:00.000Z"),
        }),
      );

      const sunday = result.days.find((d) => d.date === "2026-03-29");
      // This day shouldn't exist since baseRule is Monday
      expect(sunday).toBeUndefined();
    });

    it("resolves fall-back ambiguity to first occurrence", () => {
      // October 25, 2026: clocks fall back from 03:00 to 02:00
      // 02:30 happens twice
      const result = generateSlots(
        makeParams({
          rules: [
            {
              ...baseRule,
              weekday: 6, // Sunday
              startMinute: 150, // 02:30
              endMinute: 180, // 03:00
            },
          ],
          from: new Date("2026-10-25T00:00:00.000Z"),
          to: new Date("2026-10-25T23:59:59.999Z"),
          consultantTimezone: "Europe/Berlin",
          now: new Date("2026-10-24T10:00:00.000Z"),
        }),
      );

      const sunday = result.days.find((d) => d.date === "2026-10-25");
      expect(sunday).toBeDefined();
      // First occurrence: 02:30 CEST = 00:30 UTC
      expect(toUtcStr(sunday!.slots[0].startsAt)).toBe("2026-10-25T00:30:00.000Z");
    });
  });

  describe("half-hour offset zones", () => {
    it("handles Asia/Kolkata (UTC+5:30, no DST)", () => {
      // June 15, 2026 is a Monday in Kolkata too
      const result = generateSlots(
        makeParams({
          from: new Date("2026-06-15T00:00:00.000Z"),
          to: new Date("2026-06-21T23:59:59.999Z"),
          consultantTimezone: "Asia/Kolkata",
          now: new Date("2026-06-14T10:00:00.000Z"),
        }),
      );

      const monday = result.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();
      // 09:00 IST = 03:30 UTC
      expect(toUtcStr(monday!.slots[0].startsAt)).toBe("2026-06-15T03:30:00.000Z");
    });
  });

  describe("half-hour DST shift", () => {
    it("handles Australia/Lord_Howe (UTC+10:30 winter, UTC+11:00 summer)", () => {
      // June 15, 2026 is a Monday
      const winter = generateSlots(
        makeParams({
          from: new Date("2026-06-15T00:00:00.000Z"),
          to: new Date("2026-06-21T23:59:59.999Z"),
          consultantTimezone: "Australia/Lord_Howe",
          now: new Date("2026-06-14T10:00:00.000Z"),
        }),
      );

      // December 14, 2026 is a Monday
      const summer = generateSlots(
        makeParams({
          from: new Date("2026-12-14T00:00:00.000Z"),
          to: new Date("2026-12-20T23:59:59.999Z"),
          consultantTimezone: "Australia/Lord_Howe",
          now: new Date("2026-12-13T10:00:00.000Z"),
        }),
      );

      const winterMonday = winter.days.find((d) => d.date === "2026-06-15");
      const summerMonday = summer.days.find((d) => d.date === "2026-12-14");

      expect(winterMonday).toBeDefined();
      expect(summerMonday).toBeDefined();

      // Winter: 09:00 LHT (UTC+10:30) = 22:30 UTC previous day
      expect(toUtcStr(winterMonday!.slots[0].startsAt)).toBe("2026-06-14T22:30:00.000Z");
      // Summer: 09:00 LHT (UTC+11:00) = 22:00 UTC previous day
      expect(toUtcStr(summerMonday!.slots[0].startsAt)).toBe("2026-12-13T22:00:00.000Z");
    });
  });

  describe("viewer timezone conversion", () => {
    it("returns slots in consultant timezone but labels with local dates", () => {
      const result = generateSlots(
        makeParams({
          from: new Date("2026-06-15T00:00:00.000Z"),
          to: new Date("2026-06-16T23:59:59.999Z"),
          consultantTimezone: "Europe/Berlin",
        }),
      );

      // Should have Monday June 15
      const monday = result.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();
      expect(monday!.slots.length).toBeGreaterThan(0);
      expect(result.timezone).toBe("Europe/Berlin");
    });
  });

  describe("multiple intervals", () => {
    it("handles multiple rules on the same weekday", () => {
      const result = generateSlots(
        makeParams({
          rules: [
            baseRule, // Monday 09:00-17:00
            {
              ...baseRule,
              id: "rule-2",
              startMinute: 720, // 12:00
              endMinute: 1020, // 17:00
            },
          ],
        }),
      );

      const monday = result.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();
      // Should have slots from both intervals
      expect(monday!.slots.length).toBeGreaterThan(6);
    });
  });

  describe("appointments blocking slots", () => {
    it("removes slots including buffer bleed", () => {
      const appointment = {
        startsAt: new Date("2026-06-15T09:30:00.000Z"), // During a slot
        endsAt: new Date("2026-06-15T10:30:00.000Z"),
      };

      const result = generateSlots(
        makeParams({
          appointments: [appointment],
          bufferMinutes: 10,
        }),
      );

      const monday = result.days.find((d) => d.date === "2026-06-15");
      expect(monday).toBeDefined();

      // Appointment at 09:30-10:30 with 10min buffer blocks 09:20-10:40
      // Slot starting at 09:00 (07:00 UTC) would overlap
      const hasOverlappingSlot = monday!.slots.some((s) => {
        return (
          s.startsAt < new Date("2026-06-15T10:40:00.000Z") &&
          s.endsAt > new Date("2026-06-15T09:20:00.000Z")
        );
      });
      expect(hasOverlappingSlot).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles empty rules", () => {
      const result = generateSlots(
        makeParams({
          rules: [],
        }),
      );

      expect(result.days).toHaveLength(0);
    });

    it("handles no matching weekdays in range", () => {
      const result = generateSlots(
        makeParams({
          from: new Date("2026-06-16T00:00:00.000Z"), // Tuesday
          to: new Date("2026-06-16T23:59:59.999Z"), // Only one day, Tuesday
        }),
      );

      expect(result.days).toHaveLength(0);
    });

    it("respects effectiveFrom", () => {
      const result = generateSlots(
        makeParams({
          rules: [
            {
              ...baseRule,
              effectiveFrom: new Date("2026-06-22T00:00:00.000Z"),
            },
          ],
        }),
      );

      const june15 = result.days.find((d) => d.date === "2026-06-15");
      const june22 = result.days.find((d) => d.date === "2026-06-22");

      expect(june15).toBeUndefined();
      expect(june22).toBeDefined();
    });

    it("respects effectiveUntil", () => {
      const result = generateSlots(
        makeParams({
          rules: [
            {
              ...baseRule,
              effectiveUntil: new Date("2026-06-22T00:00:00.000Z"),
            },
          ],
        }),
      );

      const june15 = result.days.find((d) => d.date === "2026-06-15");
      const june22 = result.days.find((d) => d.date === "2026-06-22");
      const june29 = result.days.find((d) => d.date === "2026-06-29");

      expect(june15).toBeDefined();
      expect(june22).toBeDefined();
      expect(june29).toBeUndefined();
    });
  });
});
