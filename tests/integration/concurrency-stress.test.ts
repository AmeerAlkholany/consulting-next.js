import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import { createBooking } from "@/server/services/booking";
import { upsertRule, getPublicAvailability } from "@/server/services/availability";
import type { SessionUser } from "@/server/auth/dal";

describe("Critical Flow 4 — 20-Iteration Concurrency Stress Test", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it("consistently prevents double booking across 20 race iterations", async () => {
    // 1. Create consultant
    const consultantUser = await prisma.user.create({
      data: {
        email: `consultant-stress-${crypto.randomUUID()}@example.com`,
        fullName: "Dr. Concurrency Stress",
        passwordHash: "dummy-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        timezone: "UTC",
        consultantProfile: {
          create: {
            slug: `dr-stress-${crypto.randomUUID()}`,
            headline: "Stress test consultant",
            bio: "Concurrency tester",
            yearsOfExperience: 10,
            sessionPriceMinor: 10000,
            currency: "USD",
            sessionDurationMinutes: 50,
            bufferMinutes: 0,
            minLeadTimeHours: 0,
            maxAdvanceDays: 60,
            cancellationWindowHours: 0,
            consultationTypes: ["ONLINE"],
            timezone: "UTC",
            verificationStatus: "APPROVED",
            isAcceptingBookings: true,
            autoConfirmBookings: true,
          },
        },
      },
      include: { consultantProfile: true },
    });

    const consultantProfile = consultantUser.consultantProfile!;

    // Set recurring rule: Every day (0 to 6) 08:00 - 18:00 (480 - 1080)
    for (let day = 0; day <= 6; day++) {
      await upsertRule(
        { id: consultantUser.id },
        {
          consultantProfileId: consultantProfile.id,
          weekday: day,
          startMinute: 480,
          endMinute: 1080,
          isActive: true,
        },
      );
    }

    // 20 separate slot race rounds
    for (let round = 1; round <= 20; round++) {
      const u1 = await prisma.user.create({
        data: {
          email: `client-stress-1-${round}-${crypto.randomUUID()}@example.com`,
          fullName: `Client 1 Round ${round}`,
          passwordHash: "dummy-hash",
          role: "CLIENT",
          status: "ACTIVE",
          timezone: "UTC",
          clientProfile: { create: { displayName: `C1 R${round}` } },
        },
      });

      const u2 = await prisma.user.create({
        data: {
          email: `client-stress-2-${round}-${crypto.randomUUID()}@example.com`,
          fullName: `Client 2 Round ${round}`,
          passwordHash: "dummy-hash",
          role: "CLIENT",
          status: "ACTIVE",
          timezone: "UTC",
          clientProfile: { create: { displayName: `C2 R${round}` } },
        },
      });

      const s1: SessionUser = {
        id: u1.id,
        email: u1.email,
        fullName: u1.fullName,
        role: "CLIENT",
        status: "ACTIVE",
        timezone: "UTC",
        emailVerifiedAt: new Date(),
      };

      const s2: SessionUser = {
        id: u2.id,
        email: u2.email,
        fullName: u2.fullName,
        role: "CLIENT",
        status: "ACTIVE",
        timezone: "UTC",
        emailVerifiedAt: new Date(),
      };

      const from = new Date(Date.now() + round * 24 * 3600000);
      const to = new Date(from.getTime() + 2 * 24 * 3600000);
      const availability = await getPublicAvailability(consultantProfile.slug, from, to, "UTC");
      expect(availability).not.toBeNull();
      expect(availability!.days.length).toBeGreaterThan(0);

      const firstSlot = availability!.days[0].slots[0];
      const startsAt = firstSlot.startsAt.toISOString();
      const endsAt = firstSlot.endsAt.toISOString();

      const [res1, res2] = await Promise.allSettled([
        createBooking(s1, {
          consultantProfileId: consultantProfile.id,
          startsAt,
          endsAt,
          consultationType: "ONLINE",
          idempotencyKey: `race-${round}-1-${Date.now()}`,
        }),
        createBooking(s2, {
          consultantProfileId: consultantProfile.id,
          startsAt,
          endsAt,
          consultationType: "ONLINE",
          idempotencyKey: `race-${round}-2-${Date.now()}`,
        }),
      ]);

      const isSuccess = (r: PromiseSettledResult<unknown>) =>
        r.status === "fulfilled" &&
        typeof r.value === "object" &&
        r.value !== null &&
        "status" in r.value &&
        (r.value as { status: string }).status === "ok";

      const wins = [isSuccess(res1), isSuccess(res2)].filter(Boolean).length;
      expect(wins, `Round ${round} expected exactly 1 winner`).toBe(1);
    }
  });
});
