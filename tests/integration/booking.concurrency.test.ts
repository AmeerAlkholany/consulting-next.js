import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import { createBooking, cancelAppointment, rescheduleAppointment } from "@/server/services/booking";
import { upsertRule, getPublicAvailability } from "@/server/services/availability";
import type { SessionUser } from "@/server/auth/dal";

describe("Booking concurrency & exclusion constraint tests", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  let consultantUser: { id: string };
  let consultantProfile: { id: string; slug: string };
  const clients: Array<{ user: SessionUser; profileId: string }> = [];

  beforeEach(async () => {
    await cleanDatabase();
    clients.length = 0;

    // 1. Create approved consultant with 0-hour lead time for easy testing
    consultantUser = await prisma.user.create({
      data: {
        email: "consultant@example.com",
        fullName: "Dr. Concurrency Consultant",
        passwordHash: "dummy-argon2-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        timezone: "UTC",
        consultantProfile: {
          create: {
            slug: "dr-concurrency",
            headline: "Expert in high-stress concurrency",
            bio: "Helping distributed systems and humans resolve contention safely.",
            yearsOfExperience: 12,
            sessionPriceMinor: 15000,
            currency: "USD",
            sessionDurationMinutes: 50,
            bufferMinutes: 10,
            minLeadTimeHours: 0,
            maxAdvanceDays: 30,
            cancellationWindowHours: 0,
            consultationTypes: ["ONLINE"],
            timezone: "UTC",
            verificationStatus: "APPROVED",
            isAcceptingBookings: true,
            autoConfirmBookings: true,
          },
        },
      },
    });

    consultantProfile = (await prisma.consultantProfile.findUniqueOrThrow({
      where: { userId: consultantUser.id },
      select: { id: true, slug: true },
    })) as { id: string; slug: string };

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

    // 2. Create 10 distinct clients
    for (let i = 1; i <= 10; i++) {
      const user = await prisma.user.create({
        data: {
          email: `client${i}@example.com`,
          fullName: `Client Number ${i}`,
          passwordHash: "dummy-argon2-hash",
          role: "CLIENT",
          status: "ACTIVE",
          timezone: "UTC",
          clientProfile: {
            create: {
              displayName: `Client${i}`,
            },
          },
        },
      });

      const clientProfile = await prisma.clientProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });

      clients.push({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: "CLIENT",
          status: "ACTIVE",
          timezone: "UTC",
          emailVerifiedAt: new Date(),
        },
        profileId: clientProfile.id,
      });
    }
  });

  it("ensures ten parallel booking attempts on the exact same slot yield exactly one appointment and 9 conflicts", async () => {
    const from = new Date();
    from.setDate(from.getDate() + 1);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);

    const availability = await getPublicAvailability(consultantProfile.slug, from, to, "UTC");
    expect(availability).not.toBeNull();
    expect(availability!.days.length).toBeGreaterThan(0);

    const firstSlot = availability!.days[0].slots[0];
    const startsAt = firstSlot.startsAt.toISOString();
    const endsAt = firstSlot.endsAt.toISOString();

    // Launch 10 parallel booking requests from 10 different clients
    const promises = clients.map((client, idx) =>
      createBooking(client.user, {
        consultantProfileId: consultantProfile.id,
        startsAt,
        endsAt,
        consultationType: "ONLINE",
        clientNote: `Booking by client ${idx + 1}`,
        idempotencyKey: `race-key-${idx + 1}-${Date.now()}`,
      }),
    );

    const outcomes = await Promise.all(promises);

    const successful = outcomes.filter((o) => o.status === "ok");
    const conflicts = outcomes.filter((o) => o.status === "conflict");

    expect(successful).toHaveLength(1);
    expect(conflicts).toHaveLength(9);

    for (const conflict of conflicts) {
      if (conflict.status === "conflict") {
        expect(conflict.message).toMatch(/SLOT_TAKEN|no longer available/);
      }
    }

    // Verify in database: exactly 1 appointment exists for that slot
    const appointmentsInDb = await prisma.appointment.findMany({
      where: {
        consultantProfileId: consultantProfile.id,
        startsAt: new Date(startsAt),
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    expect(appointmentsInDb).toHaveLength(1);
    expect(appointmentsInDb[0].id).toBe(
      successful[0].status === "ok" ? successful[0].appointmentId : null,
    );
  });

  it("handles idempotent double submit cleanly by returning the existing appointment", async () => {
    const from = new Date();
    from.setDate(from.getDate() + 2);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);

    const availability = await getPublicAvailability(consultantProfile.slug, from, to, "UTC");
    expect(availability).not.toBeNull();
    const targetSlot = availability!.days[0].slots[1];

    const startsAt = targetSlot.startsAt.toISOString();
    const endsAt = targetSlot.endsAt.toISOString();
    const idempotencyKey = `idempotent-test-${Date.now()}`;

    const client = clients[0];

    // First call
    const firstOutcome = await createBooking(client.user, {
      consultantProfileId: consultantProfile.id,
      startsAt,
      endsAt,
      consultationType: "ONLINE",
      clientNote: "First submission",
      idempotencyKey,
    });

    expect(firstOutcome.status).toBe("ok");

    // Second call with same idempotency key
    const secondOutcome = await createBooking(client.user, {
      consultantProfileId: consultantProfile.id,
      startsAt,
      endsAt,
      consultationType: "ONLINE",
      clientNote: "Repeated submission",
      idempotencyKey,
    });

    expect(secondOutcome.status).toBe("ok");
    if (firstOutcome.status === "ok" && secondOutcome.status === "ok") {
      expect(secondOutcome.appointmentId).toBe(firstOutcome.appointmentId);
    }

    // Verify only 1 appointment row exists
    const count = await prisma.appointment.count({
      where: { requestIdempotencyKey: idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it("frees the slot immediately upon cancellation, allowing another client to book it", async () => {
    const from = new Date();
    from.setDate(from.getDate() + 3);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);

    const availability = await getPublicAvailability(consultantProfile.slug, from, to, "UTC");
    expect(availability).not.toBeNull();
    const targetSlot = availability!.days[0].slots[2];

    const startsAt = targetSlot.startsAt.toISOString();
    const endsAt = targetSlot.endsAt.toISOString();

    const clientA = clients[0];
    const clientB = clients[1];

    // 1. Client A books slot
    const bookOutcomeA = await createBooking(clientA.user, {
      consultantProfileId: consultantProfile.id,
      startsAt,
      endsAt,
      consultationType: "ONLINE",
      idempotencyKey: `client-a-booking-${Date.now()}`,
    });
    expect(bookOutcomeA.status).toBe("ok");

    if (bookOutcomeA.status !== "ok") return;

    // 2. Client A cancels
    const cancelOutcome = await cancelAppointment(clientA.user, {
      appointmentId: bookOutcomeA.appointmentId,
      reason: "Plans changed",
    });
    expect(cancelOutcome.status).toBe("ok");

    // 3. Client B books the exact same slot
    const bookOutcomeB = await createBooking(clientB.user, {
      consultantProfileId: consultantProfile.id,
      startsAt,
      endsAt,
      consultationType: "ONLINE",
      idempotencyKey: `client-b-booking-${Date.now()}`,
    });
    expect(bookOutcomeB.status).toBe("ok");

    // 4. Verify in DB: client A's appointment is CANCELLED, client B's is CONFIRMED
    const aptA = await prisma.appointment.findUniqueOrThrow({
      where: { id: bookOutcomeA.appointmentId },
    });
    expect(aptA.status).toBe("CANCELLED");

    if (bookOutcomeB.status === "ok") {
      const aptB = await prisma.appointment.findUniqueOrThrow({
        where: { id: bookOutcomeB.appointmentId },
      });
      expect(aptB.status).toBe("CONFIRMED");
      expect(aptB.clientProfileId).toBe(clientB.profileId);
    }
  });

  it("handles parallel reschedules racing for the same target slot leaving exactly one winner", async () => {
    const from = new Date();
    from.setDate(from.getDate() + 4);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);

    const availability = await getPublicAvailability(consultantProfile.slug, from, to, "UTC");
    expect(availability).not.toBeNull();

    // Pick 3 separate slots: slotA, slotB, targetSlot
    const slotA = availability!.days[0].slots[0];
    const slotB = availability!.days[0].slots[1];
    const targetSlot = availability!.days[0].slots[2];

    const clientA = clients[0];
    const clientB = clients[1];

    const aptA = await createBooking(clientA.user, {
      consultantProfileId: consultantProfile.id,
      startsAt: slotA.startsAt.toISOString(),
      endsAt: slotA.endsAt.toISOString(),
      consultationType: "ONLINE",
      idempotencyKey: `init-a-${Date.now()}`,
    });
    expect(aptA.status).toBe("ok");

    const aptB = await createBooking(clientB.user, {
      consultantProfileId: consultantProfile.id,
      startsAt: slotB.startsAt.toISOString(),
      endsAt: slotB.endsAt.toISOString(),
      consultationType: "ONLINE",
      idempotencyKey: `init-b-${Date.now()}`,
    });
    expect(aptB.status).toBe("ok");

    if (aptA.status !== "ok" || aptB.status !== "ok") return;

    // Both race to reschedule into targetSlot
    const targetStartsAt = targetSlot.startsAt.toISOString();
    const targetEndsAt = targetSlot.endsAt.toISOString();

    const [rescheduleA, rescheduleB] = await Promise.all([
      rescheduleAppointment(clientA.user, {
        appointmentId: aptA.appointmentId,
        startsAt: targetStartsAt,
        endsAt: targetEndsAt,
      }),
      rescheduleAppointment(clientB.user, {
        appointmentId: aptB.appointmentId,
        startsAt: targetStartsAt,
        endsAt: targetEndsAt,
      }),
    ]);

    const successes = [rescheduleA, rescheduleB].filter((r) => r.status === "ok");
    const errors = [rescheduleA, rescheduleB].filter((r) => r.status === "error");

    expect(successes).toHaveLength(1);
    expect(errors).toHaveLength(1);

    // Exactly 1 confirmed appointment at targetSlot
    const targetApts = await prisma.appointment.findMany({
      where: {
        consultantProfileId: consultantProfile.id,
        startsAt: targetSlot.startsAt,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    expect(targetApts).toHaveLength(1);
  });
});
