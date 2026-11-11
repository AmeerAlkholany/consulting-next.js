import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import {
  getClientAppointmentsByTab,
  getClientAppointmentById,
  getNextClientAppointment,
} from "@/server/dal/appointment";
import type { AppointmentStatus } from "@/db/generated/prisma/client";

describe("Client appointment workspace integration tests", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  let clientAProfileId: string;
  let clientBProfileId: string;
  let consultantProfileId: string;

  beforeEach(async () => {
    await cleanDatabase();

    // Create Consultant
    const consultantUser = await prisma.user.create({
      data: {
        email: "consultant@example.com",
        fullName: "Dr. Jane Doe",
        passwordHash: "dummy-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        consultantProfile: {
          create: {
            slug: "dr-jane-doe",
            headline: "Clinical Psychologist",
            bio: "Expert therapist with 10 years of practice in adult psychotherapy.",
            yearsOfExperience: 10,
            sessionPriceMinor: 10000,
            currency: "USD",
            sessionDurationMinutes: 50,
            consultationTypes: ["ONLINE"],
            timezone: "UTC",
            verificationStatus: "APPROVED",
            isAcceptingBookings: true,
          },
        },
      },
    });

    const cProfile = await prisma.consultantProfile.findUniqueOrThrow({
      where: { userId: consultantUser.id },
    });
    consultantProfileId = cProfile.id;

    // Create Client A
    const clientAUser = await prisma.user.create({
      data: {
        email: "client-a@example.com",
        fullName: "Client Alpha",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        clientProfile: {
          create: {
            displayName: "Alpha",
          },
        },
      },
    });

    const cAProfile = await prisma.clientProfile.findUniqueOrThrow({
      where: { userId: clientAUser.id },
    });
    clientAProfileId = cAProfile.id;

    // Create Client B
    const clientBUser = await prisma.user.create({
      data: {
        email: "client-b@example.com",
        fullName: "Client Beta",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        clientProfile: {
          create: {
            displayName: "Beta",
          },
        },
      },
    });

    const cBProfile = await prisma.clientProfile.findUniqueOrThrow({
      where: { userId: clientBUser.id },
    });
    clientBProfileId = cBProfile.id;
  });

  async function createAppointment(data: {
    clientProfileId: string;
    startsAt: Date;
    endsAt: Date;
    status: AppointmentStatus;
    requestIdempotencyKey: string;
  }) {
    return prisma.appointment.create({
      data: {
        consultantProfileId,
        clientProfileId: data.clientProfileId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: data.status,
        consultationType: "ONLINE",
        priceMinor: 10000,
        currency: "USD",
        sessionDurationMinutes: 50,
        clientTimezone: "UTC",
        consultantTimezone: "UTC",
        requestIdempotencyKey: data.requestIdempotencyKey,
      },
    });
  }

  describe("Tab partitioning", () => {
    it("partitions appointments into exactly one tab per status/date", async () => {
      const now = new Date("2026-11-15T12:00:00Z");

      // 1. Future CONFIRMED -> upcoming
      const aptUpcoming = await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-16T10:00:00Z"),
        endsAt: new Date("2026-11-16T10:50:00Z"),
        status: "CONFIRMED",
        requestIdempotencyKey: "apt-upcoming-1",
      });

      // 2. Future PENDING -> upcoming
      const aptPending = await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-17T14:00:00Z"),
        endsAt: new Date("2026-11-17T14:50:00Z"),
        status: "PENDING",
        requestIdempotencyKey: "apt-upcoming-2",
      });

      // 3. Past COMPLETED -> past
      const aptCompleted = await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-10T10:00:00Z"),
        endsAt: new Date("2026-11-10T10:50:00Z"),
        status: "COMPLETED",
        requestIdempotencyKey: "apt-past-1",
      });

      // 4. Past NO_SHOW -> past
      const aptNoShow = await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-09T10:00:00Z"),
        endsAt: new Date("2026-11-09T10:50:00Z"),
        status: "NO_SHOW",
        requestIdempotencyKey: "apt-past-2",
      });

      // 5. Expired active (PENDING but startsAt in past) -> past
      const aptExpired = await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-14T10:00:00Z"),
        endsAt: new Date("2026-11-14T10:50:00Z"),
        status: "PENDING",
        requestIdempotencyKey: "apt-past-3",
      });

      // 6. CANCELLED -> cancelled
      const aptCancelled = await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-18T10:00:00Z"),
        endsAt: new Date("2026-11-18T10:50:00Z"),
        status: "CANCELLED",
        requestIdempotencyKey: "apt-cancelled-1",
      });

      // Fetch each tab
      const upcoming = await getClientAppointmentsByTab(clientAProfileId, "upcoming", { now });
      const past = await getClientAppointmentsByTab(clientAProfileId, "past", { now });
      const cancelled = await getClientAppointmentsByTab(clientAProfileId, "cancelled", { now });

      const upcomingIds = upcoming.appointments.map((a) => a.id);
      const pastIds = past.appointments.map((a) => a.id);
      const cancelledIds = cancelled.appointments.map((a) => a.id);

      // Verify counts
      expect(upcoming.total).toBe(2);
      expect(past.total).toBe(3);
      expect(cancelled.total).toBe(1);

      // Verify upcoming
      expect(upcomingIds).toContain(aptUpcoming.id);
      expect(upcomingIds).toContain(aptPending.id);

      // Verify past
      expect(pastIds).toContain(aptCompleted.id);
      expect(pastIds).toContain(aptNoShow.id);
      expect(pastIds).toContain(aptExpired.id);

      // Verify cancelled
      expect(cancelledIds).toContain(aptCancelled.id);

      // Acceptance criterion: Every appointment appears in exactly one tab
      const allFetchedIds = [...upcomingIds, ...pastIds, ...cancelledIds];
      const uniqueIds = new Set(allFetchedIds);
      expect(uniqueIds.size).toBe(allFetchedIds.length);
      expect(uniqueIds.size).toBe(6);
    });

    it("orders upcoming appointments ascending by startsAt", async () => {
      const now = new Date("2026-11-15T00:00:00Z");

      const apt2 = await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-20T10:00:00Z"),
        endsAt: new Date("2026-11-20T10:50:00Z"),
        status: "CONFIRMED",
        requestIdempotencyKey: "order-2",
      });

      const apt1 = await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-17T10:00:00Z"),
        endsAt: new Date("2026-11-17T10:50:00Z"),
        status: "CONFIRMED",
        requestIdempotencyKey: "order-1",
      });

      const result = await getClientAppointmentsByTab(clientAProfileId, "upcoming", { now });
      expect(result.appointments[0].id).toBe(apt1.id);
      expect(result.appointments[1].id).toBe(apt2.id);
    });
  });

  describe("Ownership filtering (IDOR defense)", () => {
    it("never returns Client B appointments when querying for Client A", async () => {
      const now = new Date("2026-11-15T00:00:00Z");

      const aptB = await createAppointment({
        clientProfileId: clientBProfileId,
        startsAt: new Date("2026-11-18T10:00:00Z"),
        endsAt: new Date("2026-11-18T10:50:00Z"),
        status: "CONFIRMED",
        requestIdempotencyKey: "apt-b-1",
      });

      // 1. List query
      const listA = await getClientAppointmentsByTab(clientAProfileId, "upcoming", { now });
      expect(listA.appointments).toHaveLength(0);

      // 2. Direct ID query by Client A for Client B's appointment returns null
      const singleA = await getClientAppointmentById(clientAProfileId, aptB.id);
      expect(singleA).toBeNull();

      // 3. Client B querying their own appointment succeeds
      const singleB = await getClientAppointmentById(clientBProfileId, aptB.id);
      expect(singleB).not.toBeNull();
      expect(singleB!.id).toBe(aptB.id);
    });
  });

  describe("Next upcoming appointment", () => {
    it("returns the earliest upcoming appointment for dashboard hero card", async () => {
      const now = new Date("2026-11-15T00:00:00Z");

      await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-25T10:00:00Z"),
        endsAt: new Date("2026-11-25T10:50:00Z"),
        status: "CONFIRMED",
        requestIdempotencyKey: "next-later",
      });

      const sooner = await createAppointment({
        clientProfileId: clientAProfileId,
        startsAt: new Date("2026-11-16T10:00:00Z"),
        endsAt: new Date("2026-11-16T10:50:00Z"),
        status: "CONFIRMED",
        requestIdempotencyKey: "next-sooner",
      });

      const next = await getNextClientAppointment(clientAProfileId, now);
      expect(next).not.toBeNull();
      expect(next!.id).toBe(sooner.id);
    });

    it("returns null if no upcoming appointments exist", async () => {
      const next = await getNextClientAppointment(clientAProfileId);
      expect(next).toBeNull();
    });
  });
});
