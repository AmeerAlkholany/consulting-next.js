import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import {
  getConsultantAppointmentsByTab,
  getConsultantAppointmentById,
} from "@/server/dal/appointment";
import {
  confirmAppointment,
  declineAppointment,
  completeAppointment,
  markNoShowAppointment,
} from "@/server/services/booking";
import {
  getAppointmentNotes,
  upsertAppointmentNote,
  deleteAppointmentNote,
} from "@/server/services/appointment-notes";
import type { SessionUser } from "@/server/auth/dal";

describe("Consultant appointment workspace integration tests", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  let consultantAUser: SessionUser;
  let consultantBUser: SessionUser;
  let clientUser: SessionUser;

  let consultantAProfileId: string;
  let consultantBProfileId: string;
  let clientProfileId: string;

  beforeEach(async () => {
    await cleanDatabase();

    // 1. Consultant A
    const uConsultantA = await prisma.user.create({
      data: {
        email: "consultantA@example.com",
        fullName: "Dr. Alice",
        passwordHash: "dummy-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        consultantProfile: {
          create: {
            slug: "dr-alice",
            headline: "Senior Psychologist",
            bio: "Experienced psychologist specializing in CBT and anxiety disorders.",
            yearsOfExperience: 10,
            sessionPriceMinor: 12000,
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
    consultantAUser = {
      id: uConsultantA.id,
      email: uConsultantA.email,
      fullName: uConsultantA.fullName,
      role: "CONSULTANT",
      status: "ACTIVE",
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };
    consultantAProfileId = uConsultantA.consultantProfile!.id;

    // 2. Consultant B
    const uConsultantB = await prisma.user.create({
      data: {
        email: "consultantB@example.com",
        fullName: "Dr. Bob",
        passwordHash: "dummy-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        consultantProfile: {
          create: {
            slug: "dr-bob",
            headline: "Child Psychologist",
            bio: "Specializing in child and adolescent behavioral therapies.",
            yearsOfExperience: 8,
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
    consultantBUser = {
      id: uConsultantB.id,
      email: uConsultantB.email,
      fullName: uConsultantB.fullName,
      role: "CONSULTANT",
      status: "ACTIVE",
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };
    consultantBProfileId = uConsultantB.consultantProfile!.id;

    // 3. Client
    const uClient = await prisma.user.create({
      data: {
        email: "client@example.com",
        fullName: "Charlie Client",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        clientProfile: {
          create: {
            displayName: "Charlie",
            phone: "+15551234567",
          },
        },
      },
      include: { clientProfile: true },
    });
    clientUser = {
      id: uClient.id,
      email: uClient.email,
      fullName: uClient.fullName,
      role: "CLIENT",
      status: "ACTIVE",
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };
    clientProfileId = uClient.clientProfile!.id;

    // 4. Admin
    await prisma.user.create({
      data: {
        email: "admin@example.com",
        fullName: "Super Admin",
        passwordHash: "dummy-hash",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  });

  describe("Lifecycle state transitions and guards", () => {
    it("confirms a PENDING future appointment and reveals contact details", async () => {
      const now = new Date();
      const startsAt = new Date(now.getTime() + 2 * 3600 * 1000);
      const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt,
          endsAt,
          status: "PENDING",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      // While PENDING, client email and phone are hidden in the DTO
      const pendingDetail = await getConsultantAppointmentById(consultantAProfileId, apt.id);
      expect(pendingDetail?.clientEmail).toBeNull();
      expect(pendingDetail?.clientPhone).toBeNull();

      // Confirm
      const confirmResult = await confirmAppointment(consultantAUser, apt.id);
      expect(confirmResult.status).toBe("ok");

      const confirmedDetail = await getConsultantAppointmentById(consultantAProfileId, apt.id);
      expect(confirmedDetail?.status).toBe("CONFIRMED");
      expect(confirmedDetail?.confirmedAt).toBeDefined();
      expect(confirmedDetail?.clientEmail).toBe("client@example.com");
      expect(confirmedDetail?.clientPhone).toBe("+15551234567");
    });

    it("declines a PENDING appointment with a required cancellation reason", async () => {
      const now = new Date();
      const startsAt = new Date(now.getTime() + 2 * 3600 * 1000);
      const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt,
          endsAt,
          status: "PENDING",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      // Decline without reason fails
      const emptyRes = await declineAppointment(consultantAUser, {
        appointmentId: apt.id,
        reason: "   ",
      });
      expect(emptyRes.status).toBe("error");

      // Decline with reason succeeds
      const declineRes = await declineAppointment(consultantAUser, {
        appointmentId: apt.id,
        reason: "Scheduling conflict with clinical seminar",
      });
      expect(declineRes.status).toBe("ok");

      const declined = await prisma.appointment.findUniqueOrThrow({
        where: { id: apt.id },
      });
      expect(declined.status).toBe("CANCELLED");
      expect(declined.cancelledBy).toBe("CONSULTANT");
      expect(declined.cancellationReason).toBe("Scheduling conflict with clinical seminar");
    });

    it("enforces TOO_EARLY guard when attempting to complete before endsAt", async () => {
      const now = new Date();
      // Future appointment: starts in 2 hours, ends in 2 hours 50 mins
      const startsAt = new Date(now.getTime() + 2 * 3600 * 1000);
      const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt,
          endsAt,
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      const completeRes = await completeAppointment(consultantAUser, apt.id);
      expect(completeRes.status).toBe("error");
      if (completeRes.status === "error") {
        expect(completeRes.message).toContain("TOO_EARLY");
      }

      const noShowRes = await markNoShowAppointment(consultantAUser, apt.id);
      expect(noShowRes.status).toBe("error");
      if (noShowRes.status === "error") {
        expect(noShowRes.message).toContain("TOO_EARLY");
      }
    });

    it("marks completed and no-show once endsAt has passed", async () => {
      const now = new Date();
      // Past appointment
      const startsAt = new Date(now.getTime() - 2 * 3600 * 1000);
      const endsAt = new Date(now.getTime() - 1 * 3600 * 1000);

      const apt1 = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt,
          endsAt,
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      const completeRes = await completeAppointment(consultantAUser, apt1.id);
      expect(completeRes.status).toBe("ok");

      const apt1Db = await prisma.appointment.findUniqueOrThrow({ where: { id: apt1.id } });
      expect(apt1Db.status).toBe("COMPLETED");
      expect(apt1Db.completedAt).toBeDefined();

      const apt2 = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt,
          endsAt,
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      const noShowRes = await markNoShowAppointment(consultantAUser, apt2.id);
      expect(noShowRes.status).toBe("ok");

      const apt2Db = await prisma.appointment.findUniqueOrThrow({ where: { id: apt2.id } });
      expect(apt2Db.status).toBe("NO_SHOW");
    });
  });

  describe("IDOR and Cross-consultant partition isolation (BR-10)", () => {
    it("returns null when Consultant B accesses Consultant A's appointment", async () => {
      const now = new Date();
      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt: new Date(now.getTime() + 3600 * 1000),
          endsAt: new Date(now.getTime() + 2 * 3600 * 1000),
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      // Consultant A sees it
      const aptA = await getConsultantAppointmentById(consultantAProfileId, apt.id);
      expect(aptA).not.toBeNull();
      expect(aptA?.id).toBe(apt.id);

      // Consultant B gets null (which triggers notFound 404 in page.tsx)
      const aptB = await getConsultantAppointmentById(consultantBProfileId, apt.id);
      expect(aptB).toBeNull();

      // Consultant B cannot perform actions on Consultant A's appointment
      const confirmAttempt = await confirmAppointment(consultantBUser, apt.id);
      expect(confirmAttempt.status).toBe("error");
      if (confirmAttempt.status === "error") {
        expect(confirmAttempt.message).toBe("Appointment not found.");
      }
    });

    it("partitions tabs correctly (needs_response, upcoming, past, cancelled)", async () => {
      const now = new Date();

      // 1. Pending future (needs response & upcoming)
      await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt: new Date(now.getTime() + 3600 * 1000),
          endsAt: new Date(now.getTime() + 2 * 3600 * 1000),
          status: "PENDING",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      // 2. Confirmed future (upcoming)
      await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt: new Date(now.getTime() + 3 * 3600 * 1000),
          endsAt: new Date(now.getTime() + 4 * 3600 * 1000),
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      // 3. Completed (past)
      await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt: new Date(now.getTime() - 5 * 3600 * 1000),
          endsAt: new Date(now.getTime() - 4 * 3600 * 1000),
          status: "COMPLETED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      // 4. Cancelled
      await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt: new Date(now.getTime() + 6 * 3600 * 1000),
          endsAt: new Date(now.getTime() + 7 * 3600 * 1000),
          status: "CANCELLED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      const needsResponse = await getConsultantAppointmentsByTab(
        consultantAProfileId,
        "needs_response",
        { now },
      );
      expect(needsResponse.total).toBe(1);

      const upcoming = await getConsultantAppointmentsByTab(consultantAProfileId, "upcoming", {
        now,
      });
      expect(upcoming.total).toBe(2);

      const past = await getConsultantAppointmentsByTab(consultantAProfileId, "past", { now });
      expect(past.total).toBe(1);

      const cancelled = await getConsultantAppointmentsByTab(consultantAProfileId, "cancelled", {
        now,
      });
      expect(cancelled.total).toBe(1);
    });
  });

  describe("Encrypted session notes (AES-256-GCM, BR-10, BR-11)", () => {
    it("encrypts note body at rest and decrypts accurately on read", async () => {
      const now = new Date();
      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt: new Date(now.getTime() + 3600 * 1000),
          endsAt: new Date(now.getTime() + 2 * 3600 * 1000),
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      const sensitiveText =
        "Client presented with acute social anxiety symptoms. Recommended somatic exercises.";

      // Create note through service
      const createdNote = await upsertAppointmentNote(consultantAUser, {
        appointmentId: apt.id,
        body: sensitiveText,
      });

      expect(createdNote.body).toBe(sensitiveText);

      // Verify at rest in database: stored row MUST be ciphertext envelope, NOT plaintext
      const rawDbRow = await prisma.appointmentNote.findUniqueOrThrow({
        where: { id: createdNote.id },
      });

      expect(rawDbRow.body).not.toContain("anxiety");
      expect(rawDbRow.body).not.toContain("somatic");
      expect(rawDbRow.body).toMatch(/^enc:v1:k1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);

      // Reading notes through DAL decrypts cleanly
      const fetchedNotes = await getAppointmentNotes(consultantAUser, apt.id);
      expect(fetchedNotes).toHaveLength(1);
      expect(fetchedNotes[0]?.body).toBe(sensitiveText);

      // Updating note
      const updatedText = "Updated assessment: client responded well to mindfulness intervention.";
      const updatedNote = await upsertAppointmentNote(consultantAUser, {
        appointmentId: apt.id,
        noteId: createdNote.id,
        body: updatedText,
      });
      expect(updatedNote.body).toBe(updatedText);

      // Delete note
      const delRes = await deleteAppointmentNote(consultantAUser, apt.id, createdNote.id);
      expect(delRes.success).toBe(true);

      const afterDelete = await getAppointmentNotes(consultantAUser, apt.id);
      expect(afterDelete).toHaveLength(0);
    });

    it("prevents cross-consultant or unauthorized access to notes", async () => {
      const now = new Date();
      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId: consultantAProfileId,
          startsAt: new Date(now.getTime() + 3600 * 1000),
          endsAt: new Date(now.getTime() + 2 * 3600 * 1000),
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      await upsertAppointmentNote(consultantAUser, {
        appointmentId: apt.id,
        body: "Top secret session note",
      });

      // Consultant B attempts to read Consultant A's notes -> NotFoundError (IDOR shield)
      await expect(getAppointmentNotes(consultantBUser, apt.id)).rejects.toThrow(
        "Appointment not found",
      );

      // Client attempts to read notes -> AuthorizationError
      await expect(getAppointmentNotes(clientUser, apt.id)).rejects.toThrow(
        "Only registered consultants can view appointment notes",
      );
    });
  });
});
