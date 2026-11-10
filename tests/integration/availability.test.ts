import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import {
  upsertRule,
  deleteRule,
  upsertException,
  deleteException,
} from "@/server/services/availability";
import { AuthorizationError, ConflictError } from "@/server/errors";

describe("Availability integration tests", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  let consultantA: { id: string };
  let profileA: { id: string; slug: string };
  let consultantB: { id: string };
  let _profileB: { id: string; slug: string };

  beforeEach(async () => {
    await cleanDatabase();

    // Create consultant A
    consultantA = await prisma.user.create({
      data: {
        email: "consultant-a@example.com",
        fullName: "Dr. Alice Smith",
        passwordHash: "argon2id$mockedhash123",
        role: "CONSULTANT",
        status: "ACTIVE",
        consultantProfile: {
          create: {
            slug: "alice-smith",
            headline: "Clinical Psychologist with 10 years experience",
            bio: "Specializing in cognitive behavioral therapy and trauma recovery with adult patients.",
            yearsOfExperience: 10,
            sessionPriceMinor: 10000,
            currency: "USD",
            sessionDurationMinutes: 50,
            bufferMinutes: 10,
            minLeadTimeHours: 24,
            maxAdvanceDays: 30,
            cancellationWindowHours: 24,
            consultationTypes: ["ONLINE"],
            timezone: "Europe/Berlin",
            verificationStatus: "APPROVED",
            isAcceptingBookings: true,
          },
        },
      },
    });

    profileA = (await prisma.consultantProfile.findUniqueOrThrow({
      where: { userId: consultantA.id },
      select: { id: true, slug: true },
    })) as { id: string; slug: string };

    // Create consultant B
    consultantB = await prisma.user.create({
      data: {
        email: "consultant-b@example.com",
        fullName: "Dr. Bob Jones",
        passwordHash: "argon2id$mockedhash123",
        role: "CONSULTANT",
        status: "ACTIVE",
        consultantProfile: {
          create: {
            slug: "bob-jones",
            headline: "Licensed Psychoanalyst & Therapist",
            bio: "Providing depth psychotherapy for anxiety, relationship issues, and personal growth.",
            yearsOfExperience: 8,
            sessionPriceMinor: 12000,
            currency: "USD",
            sessionDurationMinutes: 60,
            bufferMinutes: 15,
            minLeadTimeHours: 12,
            maxAdvanceDays: 60,
            cancellationWindowHours: 48,
            consultationTypes: ["ONLINE"],
            timezone: "America/New_York",
            verificationStatus: "APPROVED",
            isAcceptingBookings: true,
          },
        },
      },
    });

    _profileB = (await prisma.consultantProfile.findUniqueOrThrow({
      where: { userId: consultantB.id },
      select: { id: true, slug: true },
    })) as { id: string; slug: string };
  });

  describe("Weekly Rules CRUD", () => {
    it("creates, updates, and deletes an availability rule for the consultant", async () => {
      // 1. Create rule: Mondays 09:00 - 12:00 (540 - 720 minutes)
      await upsertRule(
        { id: consultantA.id },
        {
          consultantProfileId: profileA.id,
          weekday: 0,
          startMinute: 540,
          endMinute: 720,
          isActive: true,
        },
      );

      const rulesAfterCreate = await prisma.availabilityRule.findMany({
        where: { consultantProfileId: profileA.id },
      });
      expect(rulesAfterCreate).toHaveLength(1);
      expect(rulesAfterCreate[0].startMinute).toBe(540);
      expect(rulesAfterCreate[0].endMinute).toBe(720);
      expect(rulesAfterCreate[0].isActive).toBe(true);

      const ruleId = rulesAfterCreate[0].id;

      // 2. Update rule: change hours to 10:00 - 13:00 (600 - 780 minutes)
      await upsertRule(
        { id: consultantA.id },
        {
          id: ruleId,
          consultantProfileId: profileA.id,
          weekday: 0,
          startMinute: 600,
          endMinute: 780,
          isActive: true,
        },
      );

      const ruleAfterUpdate = await prisma.availabilityRule.findUniqueOrThrow({
        where: { id: ruleId },
      });
      expect(ruleAfterUpdate.startMinute).toBe(600);
      expect(ruleAfterUpdate.endMinute).toBe(780);

      // 3. Delete rule
      await deleteRule({ id: consultantA.id }, profileA.id, ruleId);

      const rulesAfterDelete = await prisma.availabilityRule.findMany({
        where: { consultantProfileId: profileA.id },
      });
      expect(rulesAfterDelete).toHaveLength(0);
    });

    it("rejects overlapping active rules on the same weekday", async () => {
      // Existing rule: Monday 09:00 - 12:00 (540 - 720)
      await upsertRule(
        { id: consultantA.id },
        {
          consultantProfileId: profileA.id,
          weekday: 0,
          startMinute: 540,
          endMinute: 720,
          isActive: true,
        },
      );

      // Attempt overlapping rule: Monday 11:00 - 14:00 (660 - 840)
      await expect(
        upsertRule(
          { id: consultantA.id },
          {
            consultantProfileId: profileA.id,
            weekday: 0,
            startMinute: 660,
            endMinute: 840,
            isActive: true,
          },
        ),
      ).rejects.toThrow(ConflictError);

      // Allow adjacent non-overlapping rule: Monday 12:00 - 15:00 (720 - 900)
      await expect(
        upsertRule(
          { id: consultantA.id },
          {
            consultantProfileId: profileA.id,
            weekday: 0,
            startMinute: 720,
            endMinute: 900,
            isActive: true,
          },
        ),
      ).resolves.not.toThrow();
    });

    it("enforces ownership: consultant B cannot modify or delete consultant A rules", async () => {
      await upsertRule(
        { id: consultantA.id },
        {
          consultantProfileId: profileA.id,
          weekday: 1,
          startMinute: 600,
          endMinute: 800,
          isActive: true,
        },
      );

      const rule = await prisma.availabilityRule.findFirstOrThrow({
        where: { consultantProfileId: profileA.id },
      });

      // Consultant B attempts to modify Consultant A's rule
      await expect(
        upsertRule(
          { id: consultantB.id },
          {
            id: rule.id,
            consultantProfileId: profileA.id,
            weekday: 1,
            startMinute: 600,
            endMinute: 900,
            isActive: true,
          },
        ),
      ).rejects.toThrow(AuthorizationError);

      // Consultant B attempts to delete Consultant A's rule
      await expect(
        deleteRule({ id: consultantB.id }, profileA.id, rule.id),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe("Date Exceptions CRUD", () => {
    it("creates and deletes date exceptions", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // Block full day
      await upsertException(
        { id: consultantA.id },
        {
          consultantProfileId: profileA.id,
          date: tomorrow,
          type: "BLOCK",
          reason: "Medical appointment",
        },
      );

      const exceptions = await prisma.availabilityException.findMany({
        where: { consultantProfileId: profileA.id },
      });
      expect(exceptions).toHaveLength(1);
      expect(exceptions[0].type).toBe("BLOCK");
      expect(exceptions[0].reason).toBe("Medical appointment");

      // Delete exception
      await deleteException({ id: consultantA.id }, profileA.id, exceptions[0].id);

      const exceptionsAfterDelete = await prisma.availabilityException.findMany({
        where: { consultantProfileId: profileA.id },
      });
      expect(exceptionsAfterDelete).toHaveLength(0);
    });

    it("enforces ownership on date exceptions", async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 3);

      await upsertException(
        { id: consultantA.id },
        {
          consultantProfileId: profileA.id,
          date: targetDate,
          type: "EXTRA",
          startMinute: 600,
          endMinute: 720,
        },
      );

      const exception = await prisma.availabilityException.findFirstOrThrow({
        where: { consultantProfileId: profileA.id },
      });

      await expect(
        deleteException({ id: consultantB.id }, profileA.id, exception.id),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe("BR-14: booked appointment preservation", () => {
    it("rejects a rule update that would orphan an existing booked appointment", async () => {
      // 1. Consultant A has rule on Mondays 09:00 - 17:00 (540 - 1020)
      await upsertRule(
        { id: consultantA.id },
        {
          consultantProfileId: profileA.id,
          weekday: 0, // Monday
          startMinute: 540,
          endMinute: 1020,
          isActive: true,
        },
      );

      // 2. Create client and book an appointment next Monday at 10:00 - 10:50 UTC
      const client = await prisma.user.create({
        data: {
          email: "client-test@example.com",
          fullName: "Test Client",
          passwordHash: "argon2id$mockedhash123",
          role: "CLIENT",
          status: "ACTIVE",
          timezone: "Europe/Berlin",
          clientProfile: {
            create: {
              displayName: "TestC",
            },
          },
        },
      });

      const clientProfile = await prisma.clientProfile.findUniqueOrThrow({
        where: { userId: client.id },
      });

      // Find next Monday date
      const nextMonday = new Date();
      const currentDay = nextMonday.getDay();
      const daysUntilMonday = (1 + 7 - currentDay) % 7 || 7;
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
      nextMonday.setUTCHours(9, 0, 0, 0); // 09:00 UTC = 10:00 or 11:00 Berlin

      const endsAt = new Date(nextMonday.getTime() + 50 * 60 * 1000);

      await prisma.appointment.create({
        data: {
          consultantProfileId: profileA.id,
          clientProfileId: clientProfile.id,
          startsAt: nextMonday,
          endsAt,
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "Europe/Berlin",
          consultantTimezone: "Europe/Berlin",
          requestIdempotencyKey: "test-booking-br14",
        },
      });

      const existingRule = await prisma.availabilityRule.findFirstOrThrow({
        where: { consultantProfileId: profileA.id },
      });

      // 3. Try to update Monday hours to 15:00 - 17:00 (900 - 1020), which orphans the morning appointment
      await expect(
        upsertRule(
          { id: consultantA.id },
          {
            id: existingRule.id,
            consultantProfileId: profileA.id,
            weekday: 0,
            startMinute: 900,
            endMinute: 1020,
            isActive: true,
          },
        ),
      ).rejects.toThrow(/CONFLICTS_WITH_BOOKED_APPOINTMENTS/);
    });
  });
});

