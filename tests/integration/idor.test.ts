import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import {
  cancelAppointment,
  rescheduleAppointment,
  confirmAppointment,
  declineAppointment,
} from "@/server/services/booking";
import {
  getAppointmentNotes,
  upsertAppointmentNote,
} from "@/server/services/appointment-notes";
import { updateReview } from "@/server/services/reviews";
import { deleteRule } from "@/server/services/availability";
import { markNotificationAsRead } from "@/server/dal/notification";
import type { SessionUser } from "@/server/auth/dal";

describe("IDOR Matrix & Multi-Tenant Partitioning Integration Tests (Step 19)", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  async function createTwoClientsAndConsultants() {
    // Consultant A
    const uConsA = await prisma.user.create({
      data: {
        email: `consa-${crypto.randomUUID()}@example.com`,
        fullName: "Dr. Consultant A",
        passwordHash: "dummy-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        consultantProfile: {
          create: {
            slug: `dr-a-${crypto.randomUUID()}`,
            headline: "Consultant A",
            bio: "Bio A",
            yearsOfExperience: 5,
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
      include: { consultantProfile: true },
    });

    // Consultant B
    const uConsB = await prisma.user.create({
      data: {
        email: `consb-${crypto.randomUUID()}@example.com`,
        fullName: "Dr. Consultant B",
        passwordHash: "dummy-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        consultantProfile: {
          create: {
            slug: `dr-b-${crypto.randomUUID()}`,
            headline: "Consultant B",
            bio: "Bio B",
            yearsOfExperience: 7,
            sessionPriceMinor: 15000,
            currency: "USD",
            sessionDurationMinutes: 50,
            consultationTypes: ["ONLINE"],
            timezone: "UTC",
            verificationStatus: "APPROVED",
            isAcceptingBookings: true,
          },
        },
      },
      include: { consultantProfile: true },
    });

    // Client A
    const uClientA = await prisma.user.create({
      data: {
        email: `clienta-${crypto.randomUUID()}@example.com`,
        fullName: "Client A",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        clientProfile: {
          create: {
            displayName: "Client A",
          },
        },
      },
      include: { clientProfile: true },
    });

    // Client B
    const uClientB = await prisma.user.create({
      data: {
        email: `clientb-${crypto.randomUUID()}@example.com`,
        fullName: "Client B",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        clientProfile: {
          create: {
            displayName: "Client B",
          },
        },
      },
      include: { clientProfile: true },
    });

    const sessionConsA: SessionUser = {
      id: uConsA.id,
      email: uConsA.email,
      role: "CONSULTANT",
      status: "ACTIVE",
      fullName: uConsA.fullName,
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };

    const sessionConsB: SessionUser = {
      id: uConsB.id,
      email: uConsB.email,
      role: "CONSULTANT",
      status: "ACTIVE",
      fullName: uConsB.fullName,
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };

    const sessionClientA: SessionUser = {
      id: uClientA.id,
      email: uClientA.email,
      role: "CLIENT",
      status: "ACTIVE",
      fullName: uClientA.fullName,
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };

    const sessionClientB: SessionUser = {
      id: uClientB.id,
      email: uClientB.email,
      role: "CLIENT",
      status: "ACTIVE",
      fullName: uClientB.fullName,
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };

    return {
      sessionConsA,
      sessionConsB,
      sessionClientA,
      sessionClientB,
      profileConsA: uConsA.consultantProfile!,
      profileConsB: uConsB.consultantProfile!,
      profileClientA: uClientA.clientProfile!,
      profileClientB: uClientB.clientProfile!,
    };
  }

  describe("Appointment Ownership IDOR Defenses", () => {
    it("refuses client cancellation or rescheduling of another client's appointment (throws AuthorizationError)", async () => {
      const { sessionClientB, profileConsA, profileClientA } =
        await createTwoClientsAndConsultants();

      // Appointment belonging to Client A
      const appointmentA = await prisma.appointment.create({
        data: {
          clientProfileId: profileClientA.id,
          consultantProfileId: profileConsA.id,
          startsAt: new Date(Date.now() + 48 * 3600000),
          endsAt: new Date(Date.now() + 48 * 3600000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "CONFIRMED",
        },
      });

      // Client B attempts to cancel Client A's appointment
      await expect(
        cancelAppointment(sessionClientB, {
          appointmentId: appointmentA.id,
          reason: "Malicious cancellation attempt",
        })
      ).rejects.toThrow("You don't have access to this appointment.");

      // Client B attempts to reschedule Client A's appointment
      await expect(
        rescheduleAppointment(sessionClientB, {
          appointmentId: appointmentA.id,
          startsAt: new Date(Date.now() + 72 * 3600000).toISOString(),
          endsAt: new Date(Date.now() + 72 * 3600000 + 3000000).toISOString(),
        })
      ).rejects.toThrow("You don't have access to this appointment.");
    });

    it("refuses consultant confirmation or decline of another consultant's appointment", async () => {
      const { sessionConsB, profileConsA, profileClientA } =
        await createTwoClientsAndConsultants();

      // Appointment assigned to Consultant A
      const appointmentA = await prisma.appointment.create({
        data: {
          clientProfileId: profileClientA.id,
          consultantProfileId: profileConsA.id,
          startsAt: new Date(Date.now() + 24 * 3600000),
          endsAt: new Date(Date.now() + 24 * 3600000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "PENDING",
        },
      });

      // Consultant B attempts to confirm Consultant A's appointment
      const confirmRes = await confirmAppointment(sessionConsB, appointmentA.id);
      expect(confirmRes.status).toBe("error");
      if (confirmRes.status === "error") {
        expect(confirmRes.message).toBe("Appointment not found.");
      }

      // Consultant B attempts to decline Consultant A's appointment
      const declineRes = await declineAppointment(sessionConsB, {
        appointmentId: appointmentA.id,
        reason: "Malicious decline",
      });
      expect(declineRes.status).toBe("error");
      if (declineRes.status === "error") {
        expect(declineRes.message).toBe("Appointment not found.");
      }
    });
  });

  describe("Clinical Notes IDOR & Privacy Defenses (BR-10, BR-11)", () => {
    it("refuses cross-consultant access to encrypted session notes", async () => {
      const { sessionConsA, sessionConsB, profileConsA, profileClientA } =
        await createTwoClientsAndConsultants();

      const appointmentA = await prisma.appointment.create({
        data: {
          clientProfileId: profileClientA.id,
          consultantProfileId: profileConsA.id,
          startsAt: new Date(Date.now() - 3600000),
          endsAt: new Date(Date.now() - 600000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      // Consultant A creates note
      await upsertAppointmentNote(sessionConsA, {
        appointmentId: appointmentA.id,
        body: "Confidential diagnostic observations by Dr A.",
      });

      // Consultant B attempts to read Consultant A's session notes
      await expect(
        getAppointmentNotes(sessionConsB, appointmentA.id)
      ).rejects.toThrow("Appointment not found");
    });
  });

  describe("Availability Rules IDOR Defenses", () => {
    it("refuses modification or deletion of another consultant's availability rules", async () => {
      const { sessionConsB, profileConsA } = await createTwoClientsAndConsultants();

      // Rule created for Consultant A
      const ruleA = await prisma.availabilityRule.create({
        data: {
          consultantProfileId: profileConsA.id,
          weekday: 1,
          startMinute: 540,
          endMinute: 1020,
        },
      });

      // Consultant B attempts to delete Consultant A's rule
      await expect(
        deleteRule({ id: sessionConsB.id }, profileConsA.id, ruleA.id)
      ).rejects.toThrow("Not your profile.");
    });
  });

  describe("Review Editing IDOR Defenses", () => {
    it("refuses editing another client's review", async () => {
      const { sessionClientB, profileConsA, profileClientA } =
        await createTwoClientsAndConsultants();

      const appt = await prisma.appointment.create({
        data: {
          clientProfileId: profileClientA.id,
          consultantProfileId: profileConsA.id,
          startsAt: new Date(Date.now() - 3600000),
          endsAt: new Date(Date.now() - 600000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "COMPLETED",
        },
      });

      // Review submitted by Client A
      const reviewA = await prisma.review.create({
        data: {
          appointmentId: appt.id,
          clientProfileId: profileClientA.id,
          consultantProfileId: profileConsA.id,
          rating: 5,
          comment: "Client A review",
        },
      });

      // Client B attempts to edit Client A's review
      await expect(
        updateReview(sessionClientB, {
          reviewId: reviewA.id,
          rating: 1,
          comment: "Hijacked review",
        })
      ).rejects.toThrow("You do not have access to edit this review.");
    });
  });

  describe("Notification IDOR Defenses", () => {
    it("refuses marking another user's notification as read (returns false)", async () => {
      const { sessionClientA, sessionClientB } = await createTwoClientsAndConsultants();

      // Notification belonging to Client A
      const notifA = await prisma.notification.create({
        data: {
          userId: sessionClientA.id,
          type: "APPOINTMENT_REQUESTED",
          payload: { title: "Title", message: "Message" },
        },
      });

      // Client B attempts to mark Client A's notification as read
      const updated = await markNotificationAsRead(sessionClientB.id, notifA.id);
      expect(updated).toBe(false);
    });
  });
});
