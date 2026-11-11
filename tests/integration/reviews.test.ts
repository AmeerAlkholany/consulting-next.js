import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import { createReview, updateReview, unpublishReview } from "@/server/services/reviews";
import {
  getPublicReviewsForConsultant,
  getConsultantReviews,
  getClientReviewableAppointments,
} from "@/server/dal/review";
import {
  formatAverageRating,
  formatClientPublicName,
  isWithinReviewEditWindow,
  isEligibleForReview,
} from "@/schemas/review";
import type { SessionUser } from "@/server/auth/dal";

describe("Reviews & Ratings Integration Tests", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  async function setupConsultantAndClient() {
    const consultantUser = await prisma.user.create({
      data: {
        email: `consultant-${crypto.randomUUID()}@example.com`,
        fullName: "Dr. Jane Doe",
        passwordHash: "dummy-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        consultantProfile: {
          create: {
            slug: `dr-jane-${crypto.randomUUID()}`,
            headline: "Clinical Psychologist",
            bio: "Experienced psychologist specializing in CBT and trauma recovery.",
            yearsOfExperience: 10,
            sessionPriceMinor: 10000,
            currency: "USD",
            sessionDurationMinutes: 50,
            consultationTypes: ["ONLINE"],
            timezone: "UTC",
            verificationStatus: "APPROVED",
            isAcceptingBookings: true,
            ratingSum: 0,
            ratingCount: 0,
          },
        },
      },
      include: { consultantProfile: true },
    });

    const clientUser = await prisma.user.create({
      data: {
        email: `client-${crypto.randomUUID()}@example.com`,
        fullName: "Jane Doe",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        clientProfile: {
          create: {
            displayName: "Jane Doe",
            phone: "+15551234567",
          },
        },
      },
      include: { clientProfile: true },
    });

    const clientSessionUser: SessionUser = {
      id: clientUser.id,
      email: clientUser.email,
      role: "CLIENT",
      status: "ACTIVE",
      fullName: clientUser.fullName,
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };

    return {
      consultantUser,
      consultantProfile: consultantUser.consultantProfile!,
      clientUser,
      clientProfile: clientUser.clientProfile!,
      clientSessionUser,
    };
  }

  describe("Unit & Helper Functions", () => {
    it("formats average rating correctly", () => {
      expect(formatAverageRating(0, 0)).toBe("—");
      expect(formatAverageRating(9, 2)).toBe("4.5");
      expect(formatAverageRating(15, 3)).toBe("5.0");
      expect(formatAverageRating(4, 1)).toBe("4.0");
    });

    it("anonymizes client names for public display (ARCHITECTURE.md §17)", () => {
      expect(formatClientPublicName("Jane Doe")).toBe("Jane D.");
      expect(formatClientPublicName("Alexander Hamilton")).toBe("Alexander H.");
      expect(formatClientPublicName("Madonna")).toBe("Madonna");
      expect(formatClientPublicName(null)).toBe("Verified Client");
      expect(formatClientPublicName("")).toBe("Verified Client");
    });

    it("evaluates 48-hour review edit window", () => {
      const now = new Date();
      const justNow = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
      const expired = new Date(now.getTime() - 1000 * 60 * 60 * 49); // 49 hours ago

      expect(isWithinReviewEditWindow(justNow, now)).toBe(true);
      expect(isWithinReviewEditWindow(expired, now)).toBe(false);
    });

    it("evaluates review eligibility based on status and completion age", () => {
      const now = new Date();
      const completedRecent = {
        status: "COMPLETED",
        endsAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
      };
      const completedExpired = {
        status: "COMPLETED",
        endsAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 35), // 35 days ago (> 30 days)
      };
      const pendingAppointment = {
        status: "PENDING",
        endsAt: new Date(now.getTime() + 1000 * 60 * 60),
      };

      expect(isEligibleForReview(completedRecent, now).eligible).toBe(true);
      expect(isEligibleForReview(completedExpired, now).eligible).toBe(false);
      expect(isEligibleForReview(pendingAppointment, now).eligible).toBe(false);
    });
  });

  describe("Appointment Review Eligibility & Constraints (BR-9)", () => {
    it("rejects review creation for appointments that are not COMPLETED", async () => {
      const { consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const pendingAppointment = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() + 86400000),
          endsAt: new Date(Date.now() + 86400000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "PENDING",
        },
      });

      const res = await createReview(clientSessionUser, {
        appointmentId: pendingAppointment.id,
        rating: 5,
        comment: "Great session!",
      });

      expect(res.status).toBe("error");
      if (res.status === "error") {
        expect(res.code).toBe("NOT_ELIGIBLE");
        expect(res.message).toContain("Only completed appointments can be reviewed");
      }
    });

    it("rejects review creation when review window (> 30 days) has expired", async () => {
      const { consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const expiredAppointment = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 32 * 86400000),
          endsAt: new Date(Date.now() - 32 * 86400000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
          completedAt: new Date(Date.now() - 32 * 86400000 + 3000000),
        },
      });

      const res = await createReview(clientSessionUser, {
        appointmentId: expiredAppointment.id,
        rating: 5,
        comment: "Review submitted too late",
      });

      expect(res.status).toBe("error");
      if (res.status === "error") {
        expect(res.code).toBe("REVIEW_WINDOW_CLOSED");
      }
    });

    it("rejects review creation by a non-attending client (BR-10)", async () => {
      const { consultantProfile, clientProfile } = await setupConsultantAndClient();

      const otherUser = await prisma.user.create({
        data: {
          email: `other-${crypto.randomUUID()}@example.com`,
          fullName: "Other Client",
          passwordHash: "dummy-hash",
          role: "CLIENT",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          clientProfile: {
            create: {
              displayName: "Other Client",
            },
          },
        },
      });

      const otherSessionUser: SessionUser = {
        id: otherUser.id,
        email: otherUser.email,
        role: "CLIENT",
        status: "ACTIVE",
        fullName: otherUser.fullName,
        timezone: "UTC",
        emailVerifiedAt: new Date(),
      };

      const appointment = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000),
          endsAt: new Date(Date.now() - 86400000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      await expect(
        createReview(otherSessionUser, {
          appointmentId: appointment.id,
          rating: 4,
          comment: "Intruder review",
        }),
      ).rejects.toThrow("You do not have access to review this appointment.");
    });
  });

  describe("Review Creation, Rating Aggregates & In-Transaction Notifications", () => {
    it("creates a review, increments aggregate ratingSum and ratingCount, and writes notification", async () => {
      const { consultantUser, consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const appointment = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000),
          endsAt: new Date(Date.now() - 86400000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      const res = await createReview(clientSessionUser, {
        appointmentId: appointment.id,
        rating: 5,
        comment: "Outstanding psychologist, very insightful session.",
      });

      expect(res.status).toBe("ok");
      if (res.status === "ok") {
        expect(res.reviewId).toBeDefined();

        // 1. Verify review in database
        const review = await prisma.review.findUnique({
          where: { id: res.reviewId },
        });
        expect(review).not.toBeNull();
        expect(review?.rating).toBe(5);
        expect(review?.comment).toBe("Outstanding psychologist, very insightful session.");
        expect(review?.isPublished).toBe(true);

        // 2. Verify consultant profile aggregate
        const updatedConsultant = await prisma.consultantProfile.findUnique({
          where: { id: consultantProfile.id },
          select: { ratingSum: true, ratingCount: true },
        });
        expect(updatedConsultant?.ratingSum).toBe(5);
        expect(updatedConsultant?.ratingCount).toBe(1);

        // 3. Verify notification to consultant
        const notification = await prisma.notification.findFirst({
          where: {
            userId: consultantUser.id,
            type: "REVIEW_RECEIVED",
          },
        });
        expect(notification).not.toBeNull();
        const payload = notification?.payload as Record<string, unknown>;
        expect(payload.title).toBe("New Review Received");
        expect(payload.message).toContain("5-star review");

        // 4. Verify email outbox entry
        const outbox = await prisma.emailOutbox.findFirst({
          where: {
            userId: consultantUser.id,
            template: "REVIEW_RECEIVED",
          },
        });
        expect(outbox).not.toBeNull();
        expect(outbox?.toEmail).toBe(consultantUser.email);
      }
    });

    it("prevents duplicate reviews on the same appointment (BR-9 / unique constraint)", async () => {
      const { consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const appointment = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000),
          endsAt: new Date(Date.now() - 86400000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      const firstRes = await createReview(clientSessionUser, {
        appointmentId: appointment.id,
        rating: 4,
        comment: "First review",
      });
      expect(firstRes.status).toBe("ok");

      // Attempt second review
      const secondRes = await createReview(clientSessionUser, {
        appointmentId: appointment.id,
        rating: 5,
        comment: "Duplicate review attempt",
      });

      expect(secondRes.status).toBe("error");
      if (secondRes.status === "error") {
        expect(secondRes.code).toBe("ALREADY_REVIEWED");
      }
    });

    it("maintains live database aggregate parity across multiple reviews", async () => {
      const { consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const appt1 = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000 * 3),
          endsAt: new Date(Date.now() - 86400000 * 3 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      const appt2 = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000 * 2),
          endsAt: new Date(Date.now() - 86400000 * 2 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      await createReview(clientSessionUser, { appointmentId: appt1.id, rating: 5 });
      await createReview(clientSessionUser, { appointmentId: appt2.id, rating: 3 });

      const profile = await prisma.consultantProfile.findUnique({
        where: { id: consultantProfile.id },
      });

      const liveAgg = await prisma.review.aggregate({
        where: { consultantProfileId: consultantProfile.id, isPublished: true },
        _sum: { rating: true },
        _count: { _all: true },
      });

      expect(profile?.ratingSum).toBe(liveAgg._sum.rating);
      expect(profile?.ratingCount).toBe(liveAgg._count._all);
      expect(profile?.ratingSum).toBe(8);
      expect(profile?.ratingCount).toBe(2);
    });
  });

  describe("48-Hour Review Editing Window", () => {
    it("allows editing rating and comment within 48 hours and adjusts ratingSum", async () => {
      const { consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const appointment = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000),
          endsAt: new Date(Date.now() - 86400000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      const createRes = await createReview(clientSessionUser, {
        appointmentId: appointment.id,
        rating: 3,
        comment: "Initial rating was 3",
      });
      expect(createRes.status).toBe("ok");
      const reviewId = (createRes as { reviewId: string }).reviewId;

      // Edit rating from 3 to 5
      const editRes = await updateReview(clientSessionUser, {
        reviewId,
        rating: 5,
        comment: "Upgraded rating to 5 after reflection.",
      });

      expect(editRes.status).toBe("ok");

      const updatedReview = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(updatedReview?.rating).toBe(5);
      expect(updatedReview?.comment).toContain("Upgraded rating to 5");

      // Verify aggregate difference was applied (+2)
      const updatedProfile = await prisma.consultantProfile.findUnique({
        where: { id: consultantProfile.id },
      });
      expect(updatedProfile?.ratingSum).toBe(5);
      expect(updatedProfile?.ratingCount).toBe(1);
    });

    it("rejects editing once the 48-hour edit window has expired", async () => {
      const { consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const appointment = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000 * 5),
          endsAt: new Date(Date.now() - 86400000 * 5 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      // Insert review with createdAt 50 hours ago
      const oldReview = await prisma.review.create({
        data: {
          appointmentId: appointment.id,
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          rating: 4,
          comment: "Old review",
          createdAt: new Date(Date.now() - 50 * 3600000),
        },
      });

      const editRes = await updateReview(clientSessionUser, {
        reviewId: oldReview.id,
        rating: 5,
        comment: "Trying to edit expired review",
      });

      expect(editRes.status).toBe("error");
      if (editRes.status === "error") {
        expect(editRes.code).toBe("EDIT_WINDOW_CLOSED");
      }
    });
  });

  describe("Admin Moderation & Unpublishing", () => {
    it("unpublishes a review, symmetrically decrements aggregates, and records an AuditLog", async () => {
      const { consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const adminUser = await prisma.user.create({
        data: {
          email: `admin-${crypto.randomUUID()}@example.com`,
          fullName: "Admin Moderator",
          passwordHash: "dummy-hash",
          role: "ADMIN",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });

      const adminSessionUser: SessionUser = {
        id: adminUser.id,
        email: adminUser.email,
        role: "ADMIN",
        status: "ACTIVE",
        fullName: adminUser.fullName,
        timezone: "UTC",
        emailVerifiedAt: new Date(),
      };

      const appointment = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000),
          endsAt: new Date(Date.now() - 86400000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      const createRes = await createReview(clientSessionUser, {
        appointmentId: appointment.id,
        rating: 4,
        comment: "Contains inappropriate terms.",
      });
      const reviewId = (createRes as { reviewId: string }).reviewId;

      // Verify aggregate before unpublish
      let profile = await prisma.consultantProfile.findUnique({
        where: { id: consultantProfile.id },
      });
      expect(profile?.ratingSum).toBe(4);
      expect(profile?.ratingCount).toBe(1);

      // Admin unpublishes
      const unpublishRes = await unpublishReview(adminSessionUser, {
        reviewId,
        reason: "Review violated platform policy regarding abusive language.",
      });

      expect(unpublishRes.status).toBe("ok");

      // Verify review state
      const review = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(review?.isPublished).toBe(false);
      expect(review?.moderatedById).toBe(adminUser.id);

      // Verify symmetrical decrement of aggregates
      profile = await prisma.consultantProfile.findUnique({
        where: { id: consultantProfile.id },
      });
      expect(profile?.ratingSum).toBe(0);
      expect(profile?.ratingCount).toBe(0);

      // Verify AuditLog written (BR-13)
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: "Review",
          entityId: reviewId,
          action: "REVIEW_UNPUBLISHED",
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(adminUser.id);
      const metadata = audit?.metadata as Record<string, unknown>;
      expect(metadata?.reason).toContain("Review violated platform policy");
    });

    it("refuses unpublishing by non-admin users", async () => {
      const { consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const appointment = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000),
          endsAt: new Date(Date.now() - 86400000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      const createRes = await createReview(clientSessionUser, {
        appointmentId: appointment.id,
        rating: 5,
      });
      const reviewId = (createRes as { reviewId: string }).reviewId;

      await expect(
        unpublishReview(clientSessionUser, {
          reviewId,
          reason: "I want to delete it",
        }),
      ).rejects.toThrow("Only administrators can moderate reviews.");
    });
  });

  describe("Public and Consultant DAL Queries", () => {
    it("returns anonymized names in public reviews and excludes unpublished reviews", async () => {
      const { consultantProfile, clientProfile, clientSessionUser } =
        await setupConsultantAndClient();

      const adminUser = await prisma.user.create({
        data: {
          email: `admin-${crypto.randomUUID()}@example.com`,
          fullName: "Admin Mod",
          passwordHash: "dummy-hash",
          role: "ADMIN",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });

      const adminSessionUser: SessionUser = {
        id: adminUser.id,
        email: adminUser.email,
        role: "ADMIN",
        status: "ACTIVE",
        fullName: adminUser.fullName,
        timezone: "UTC",
        emailVerifiedAt: new Date(),
      };

      const appt1 = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000 * 2),
          endsAt: new Date(Date.now() - 86400000 * 2 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      const appt2 = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000 * 1),
          endsAt: new Date(Date.now() - 86400000 * 1 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      const r1 = await createReview(clientSessionUser, {
        appointmentId: appt1.id,
        rating: 5,
        comment: "Public review",
      });
      const r2 = await createReview(clientSessionUser, {
        appointmentId: appt2.id,
        rating: 2,
        comment: "Moderated review",
      });

      // Unpublish r2
      await unpublishReview(adminSessionUser, {
        reviewId: (r2 as { reviewId: string }).reviewId,
        reason: "Moderated",
      });

      const publicReviews = await getPublicReviewsForConsultant(consultantProfile.id);
      expect(publicReviews.reviews.length).toBe(1);
      expect(publicReviews.reviews[0].id).toBe((r1 as { reviewId: string }).reviewId);
      expect(publicReviews.reviews[0].authorName).toBe("Jane D.");
      expect(
        (publicReviews.reviews[0] as unknown as Record<string, unknown>).email,
      ).toBeUndefined();

      // Consultant view includes unpublished with badge
      const consultantView = await getConsultantReviews(consultantProfile.id);
      expect(consultantView.reviews.length).toBe(2);
    });

    it("finds reviewable completed appointments for client dashboard prompt", async () => {
      const { consultantProfile, clientProfile } = await setupConsultantAndClient();

      const appt = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(Date.now() - 86400000),
          endsAt: new Date(Date.now() - 86400000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      const reviewable = await getClientReviewableAppointments(clientProfile.id);
      expect(reviewable.some((a) => a.id === appt.id)).toBe(true);
    });
  });
});
