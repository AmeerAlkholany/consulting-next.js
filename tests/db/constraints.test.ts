import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { assertDatabaseReady, cleanDatabase, disconnectDatabase, prisma } from "../helpers/db";
import {
  UserRole,
  UserStatus,
  AppointmentStatus,
  ConsultationType,
} from "@/db/generated/prisma/enums";

describe("Database constraints & behavior", () => {
  beforeAll(async () => {
    await assertDatabaseReady();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  async function createFixture() {
    const consultantUser = await prisma.user.create({
      data: {
        email: "consultant@example.com",
        passwordHash: "dummy-hash",
        fullName: "Dr. Consultant",
        role: UserRole.CONSULTANT,
        status: UserStatus.ACTIVE,
      },
    });

    const consultantProfile = await prisma.consultantProfile.create({
      data: {
        userId: consultantUser.id,
        slug: "dr-consultant",
        headline: "Clinical Psychologist",
        bio: "Experienced therapist working with CBT and psychodynamic models.",
        yearsOfExperience: 10,
        timezone: "UTC",
        sessionPriceMinor: 10000,
        currency: "USD",
        consultationTypes: [ConsultationType.ONLINE],
        sessionDurationMinutes: 50,
      },
    });

    const clientUser1 = await prisma.user.create({
      data: {
        email: "client1@example.com",
        passwordHash: "dummy-hash",
        fullName: "Client One",
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      },
    });

    const clientProfile1 = await prisma.clientProfile.create({
      data: {
        userId: clientUser1.id,
        displayName: "Client One",
      },
    });

    const clientUser2 = await prisma.user.create({
      data: {
        email: "client2@example.com",
        passwordHash: "dummy-hash",
        fullName: "Client Two",
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      },
    });

    const clientProfile2 = await prisma.clientProfile.create({
      data: {
        userId: clientUser2.id,
        displayName: "Client Two",
      },
    });

    return { consultantProfile, clientProfile1, clientProfile2, consultantUser, clientUser1 };
  }

  it("enforces appointment_consultant_no_overlap exclusion constraint for PENDING / CONFIRMED", async () => {
    const { consultantProfile, clientProfile1, clientProfile2 } = await createFixture();

    const start = new Date("2026-10-01T10:00:00Z");
    const end = new Date("2026-10-01T10:50:00Z");

    await prisma.appointment.create({
      data: {
        consultantProfileId: consultantProfile.id,
        clientProfileId: clientProfile1.id,
        startsAt: start,
        endsAt: end,
        sessionDurationMinutes: 50,
        consultationType: ConsultationType.ONLINE,
        status: AppointmentStatus.CONFIRMED,
        priceMinor: 10000,
        currency: "USD",
        clientTimezone: "UTC",
        consultantTimezone: "UTC",
      },
    });

    // Overlapping slot for same consultant with client2
    await expect(
      prisma.appointment.create({
        data: {
          consultantProfileId: consultantProfile.id,
          clientProfileId: clientProfile2.id,
          startsAt: new Date("2026-10-01T10:30:00Z"),
          endsAt: new Date("2026-10-01T11:20:00Z"),
          sessionDurationMinutes: 50,
          consultationType: ConsultationType.ONLINE,
          status: AppointmentStatus.PENDING,
          priceMinor: 10000,
          currency: "USD",
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      }),
    ).rejects.toThrow(/23P01/);
  });

  it("enforces appointment_client_no_overlap exclusion constraint for PENDING / CONFIRMED", async () => {
    const { consultantProfile, clientProfile1 } = await createFixture();

    const consultantUser2 = await prisma.user.create({
      data: {
        email: "consultant2@example.com",
        passwordHash: "dummy-hash",
        fullName: "Dr. Consultant Two",
        role: UserRole.CONSULTANT,
        status: UserStatus.ACTIVE,
      },
    });

    const consultantProfile2 = await prisma.consultantProfile.create({
      data: {
        userId: consultantUser2.id,
        slug: "dr-consultant-2",
        headline: "Clinical Psychologist 2",
        bio: "Experienced therapist working with CBT.",
        yearsOfExperience: 5,
        timezone: "UTC",
        sessionPriceMinor: 10000,
        currency: "USD",
        consultationTypes: [ConsultationType.ONLINE],
        sessionDurationMinutes: 50,
      },
    });

    const start = new Date("2026-10-01T14:00:00Z");
    const end = new Date("2026-10-01T14:50:00Z");

    await prisma.appointment.create({
      data: {
        consultantProfileId: consultantProfile.id,
        clientProfileId: clientProfile1.id,
        startsAt: start,
        endsAt: end,
        sessionDurationMinutes: 50,
        consultationType: ConsultationType.ONLINE,
        status: AppointmentStatus.CONFIRMED,
        priceMinor: 10000,
        currency: "USD",
        clientTimezone: "UTC",
        consultantTimezone: "UTC",
      },
    });

    // Overlapping slot for same client with another consultant
    await expect(
      prisma.appointment.create({
        data: {
          consultantProfileId: consultantProfile2.id,
          clientProfileId: clientProfile1.id,
          startsAt: new Date("2026-10-01T14:15:00Z"),
          endsAt: new Date("2026-10-01T15:05:00Z"),
          sessionDurationMinutes: 50,
          consultationType: ConsultationType.ONLINE,
          status: AppointmentStatus.PENDING,
          priceMinor: 10000,
          currency: "USD",
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      }),
    ).rejects.toThrow(/23P01/);
  });

  it("allows overlapping slot when previous appointment is CANCELLED", async () => {
    const { consultantProfile, clientProfile1, clientProfile2 } = await createFixture();

    const start = new Date("2026-10-01T16:00:00Z");
    const end = new Date("2026-10-01T16:50:00Z");

    await prisma.appointment.create({
      data: {
        consultantProfileId: consultantProfile.id,
        clientProfileId: clientProfile1.id,
        startsAt: start,
        endsAt: end,
        sessionDurationMinutes: 50,
        consultationType: ConsultationType.ONLINE,
        status: AppointmentStatus.CANCELLED,
        priceMinor: 10000,
        currency: "USD",
        clientTimezone: "UTC",
        consultantTimezone: "UTC",
      },
    });

    const second = await prisma.appointment.create({
      data: {
        consultantProfileId: consultantProfile.id,
        clientProfileId: clientProfile2.id,
        startsAt: start,
        endsAt: end,
        sessionDurationMinutes: 50,
        consultationType: ConsultationType.ONLINE,
        status: AppointmentStatus.CONFIRMED,
        priceMinor: 10000,
        currency: "USD",
        clientTimezone: "UTC",
        consultantTimezone: "UTC",
      },
    });

    expect(second.id).toBeDefined();
    expect(second.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it("enforces rule_minutes_valid check constraint on AvailabilityRule", async () => {
    const { consultantProfile } = await createFixture();

    await expect(
      prisma.availabilityRule.create({
        data: {
          consultantProfileId: consultantProfile.id,
          weekday: 1,
          startMinute: 600,
          endMinute: 500, // end < start
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    ).rejects.toThrow(/23514/);
  });

  it("enforces review_rating_range check constraint", async () => {
    const { consultantProfile, clientProfile1 } = await createFixture();

    const appt = await prisma.appointment.create({
      data: {
        consultantProfileId: consultantProfile.id,
        clientProfileId: clientProfile1.id,
        startsAt: new Date("2026-09-01T10:00:00Z"),
        endsAt: new Date("2026-09-01T10:50:00Z"),
        sessionDurationMinutes: 50,
        consultationType: ConsultationType.ONLINE,
        status: AppointmentStatus.COMPLETED,
        priceMinor: 10000,
        currency: "USD",
        clientTimezone: "UTC",
        consultantTimezone: "UTC",
      },
    });

    await expect(
      prisma.review.create({
        data: {
          appointmentId: appt.id,
          consultantProfileId: consultantProfile.id,
          clientProfileId: clientProfile1.id,
          rating: 6, // > 5
        },
      }),
    ).rejects.toThrow(/23514/);
  });

  it("enforces consultant_price_positive check constraint", async () => {
    const user = await prisma.user.create({
      data: {
        email: "zero-price@example.com",
        passwordHash: "dummy-hash",
        fullName: "Zero Price Therapist",
        role: UserRole.CONSULTANT,
      },
    });

    await expect(
      prisma.consultantProfile.create({
        data: {
          userId: user.id,
          slug: "zero-price",
          headline: "Zero Price Therapist",
          bio: "Test biography description.",
          yearsOfExperience: 3,
          timezone: "UTC",
          sessionPriceMinor: 0, // <= 0
          currency: "USD",
          consultationTypes: [ConsultationType.ONLINE],
          sessionDurationMinutes: 50,
        },
      }),
    ).rejects.toThrow(/23514/);
  });

  it("enforces unique constraint on Review.appointmentId", async () => {
    const { consultantProfile, clientProfile1 } = await createFixture();

    const appt = await prisma.appointment.create({
      data: {
        consultantProfileId: consultantProfile.id,
        clientProfileId: clientProfile1.id,
        startsAt: new Date("2026-09-01T10:00:00Z"),
        endsAt: new Date("2026-09-01T10:50:00Z"),
        sessionDurationMinutes: 50,
        consultationType: ConsultationType.ONLINE,
        status: AppointmentStatus.COMPLETED,
        priceMinor: 10000,
        currency: "USD",
        clientTimezone: "UTC",
        consultantTimezone: "UTC",
      },
    });

    await prisma.review.create({
      data: {
        appointmentId: appt.id,
        consultantProfileId: consultantProfile.id,
        clientProfileId: clientProfile1.id,
        rating: 5,
        comment: "Excellent session",
      },
    });

    await expect(
      prisma.review.create({
        data: {
          appointmentId: appt.id,
          consultantProfileId: consultantProfile.id,
          clientProfileId: clientProfile1.id,
          rating: 4,
          comment: "Duplicate review attempt",
        },
      }),
    ).rejects.toThrow(/unique|23505/i);
  });

  it("restricts deleting User while appointments exist", async () => {
    const { consultantProfile, clientProfile1, consultantUser } = await createFixture();

    await prisma.appointment.create({
      data: {
        consultantProfileId: consultantProfile.id,
        clientProfileId: clientProfile1.id,
        startsAt: new Date("2026-10-01T10:00:00Z"),
        endsAt: new Date("2026-10-01T10:50:00Z"),
        sessionDurationMinutes: 50,
        consultationType: ConsultationType.ONLINE,
        status: AppointmentStatus.CONFIRMED,
        priceMinor: 10000,
        currency: "USD",
        clientTimezone: "UTC",
        consultantTimezone: "UTC",
      },
    });

    await expect(
      prisma.user.delete({
        where: { id: consultantUser.id },
      }),
    ).rejects.toThrow(/foreign key|restrict|23503/i);
  });

  it("cascades User deletion to sessions and profiles, but is restricted by appointments", async () => {
    const { consultantUser, clientUser1, clientProfile1, clientProfile2, consultantProfile } =
      await createFixture();

    await prisma.session.create({
      data: {
        userId: clientUser1.id,
        tokenHash: "a".repeat(64),
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        lastUsedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    // No appointments yet: the delete cascades through sessions and profile rows.
    await prisma.user.delete({ where: { id: clientUser1.id } });

    expect(await prisma.session.count({ where: { userId: clientUser1.id } })).toBe(0);
    expect(await prisma.clientProfile.findUnique({ where: { id: clientProfile1.id } })).toBeNull();
    expect(await prisma.clientProfile.count({ where: { userId: clientUser1.id } })).toBe(0);

    // With an appointment referencing the consultant profile, RESTRICT wins.
    await prisma.appointment.create({
      data: {
        consultantProfileId: consultantProfile.id,
        clientProfileId: clientProfile2.id,
        startsAt: new Date("2026-10-01T10:00:00Z"),
        endsAt: new Date("2026-10-01T10:50:00Z"),
        sessionDurationMinutes: 50,
        consultationType: ConsultationType.ONLINE,
        status: AppointmentStatus.CONFIRMED,
        priceMinor: 10000,
        currency: "USD",
        clientTimezone: "UTC",
        consultantTimezone: "UTC",
      },
    });

    await expect(prisma.user.delete({ where: { id: consultantUser.id } })).rejects.toThrow(
      /foreign key|restrict|23503/i,
    );
  });

  it("restricts deleting Specialization while referenced", async () => {
    const { consultantProfile } = await createFixture();

    // The seeded taxonomy is preserved by `cleanDatabase`, so this row needs a
    // unique natural key rather than a fixed one.
    const suffix = randomUUID();
    const spec = await prisma.specialization.create({
      data: {
        name: `Test Anxiety Specialization ${suffix}`,
        slug: `test-anxiety-specialization-${suffix}`,
      },
    });

    await prisma.consultantSpecialization.create({
      data: {
        consultantProfileId: consultantProfile.id,
        specializationId: spec.id,
      },
    });

    await expect(
      prisma.specialization.delete({
        where: { id: spec.id },
      }),
    ).rejects.toThrow(/foreign key|restrict|23503/i);

    // The association does not delete the specialization either.
    expect(await prisma.specialization.findUnique({ where: { id: spec.id } })).not.toBeNull();
  });

  it("exposes every hand-written constraint, index, and extension", async () => {
    // A migration that drops, renames, or weakens one of these fails here even
    // if no test above happens to exercise it.
    const constraints = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
        AND conname IN (
          'appointment_consultant_no_overlap',
          'appointment_client_no_overlap',
          'appointment_end_after_start',
          'rule_minutes_valid',
          'review_rating_range',
          'consultant_price_positive'
        )
      ORDER BY conname
    `;

    expect(constraints.map((row) => row.name)).toEqual([
      "appointment_client_no_overlap",
      "appointment_consultant_no_overlap",
      "appointment_end_after_start",
      "consultant_price_positive",
      "review_rating_range",
      "rule_minutes_valid",
    ]);

    const indexes = await prisma.$queryRaw<Array<{ name: string; definition: string }>>`
      SELECT indexname AS name, indexdef AS definition
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('notification_unread_idx', 'consultant_search_idx')
      ORDER BY indexname
    `;

    expect(indexes.map((row) => row.name)).toEqual([
      "consultant_search_idx",
      "notification_unread_idx",
    ]);

    // Partial, not just present: the unread badge must not index read rows.
    expect(indexes[0]?.definition).toMatch(/USING gin/i);
    expect(indexes[0]?.definition).toMatch(/to_tsvector\('english'::regconfig/i);
    expect(indexes[1]?.definition).toMatch(/WHERE \("readAt" IS NULL\)/i);

    const [extension] = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT extname AS name FROM pg_extension WHERE extname = 'btree_gist'
    `;
    expect(extension?.name).toBe("btree_gist");
  });
});
