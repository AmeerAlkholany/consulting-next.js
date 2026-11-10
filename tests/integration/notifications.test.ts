import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import {
  createBooking,
  confirmAppointment,
  declineAppointment,
  completeAppointment,
} from "@/server/services/booking";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/server/dal/notification";
import { adminCancelAppointment } from "@/server/services/admin";
import { getPublicAvailability, upsertRule } from "@/server/services/availability";
import type { SessionUser } from "@/server/auth/dal";

describe("Notifications integration tests", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  let clientUser: SessionUser;
  let consultantUser: SessionUser;
  let adminUser: SessionUser;

  let clientProfileId: string;
  let consultantProfileId: string;

  beforeEach(async () => {
    await cleanDatabase();

    // 1. Consultant
    const uConsultant = await prisma.user.create({
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
            bio: "Experienced psychologist specializing in CBT.",
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
      include: { consultantProfile: true },
    });

    consultantUser = {
      id: uConsultant.id,
      email: uConsultant.email,
      fullName: uConsultant.fullName,
      role: "CONSULTANT",
      status: "ACTIVE",
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };
    consultantProfileId = uConsultant.consultantProfile!.id;

    // Create availability rules for booking
    for (let day = 0; day <= 6; day++) {
      await upsertRule(
        { id: uConsultant.id },
        {
          consultantProfileId,
          weekday: day,
          startMinute: 480,
          endMinute: 1080,
          isActive: true,
        },
      );
    }

    // 2. Client
    const uClient = await prisma.user.create({
      data: {
        email: "client@example.com",
        fullName: "Alice Client",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        clientProfile: {
          create: {
            displayName: "Alice",
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

    // 3. Admin
    const uAdmin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        fullName: "Super Admin",
        passwordHash: "dummy-hash",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    adminUser = {
      id: uAdmin.id,
      email: uAdmin.email,
      fullName: uAdmin.fullName,
      role: "ADMIN",
      status: "ACTIVE",
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };
  });

  describe("Lifecycle event notification & email outbox emission", () => {
    it("emits APPOINTMENT_REQUESTED on booking creation inside same transaction", async () => {
      const from = new Date();
      from.setDate(from.getDate() + 1);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);

      const availability = await getPublicAvailability("dr-jane-doe", from, to, "UTC");
      expect(availability).not.toBeNull();
      expect(availability!.days.length).toBeGreaterThan(0);

      const firstSlot = availability!.days[0].slots[0];
      const startsAt = firstSlot.startsAt.toISOString();
      const endsAt = firstSlot.endsAt.toISOString();

      const bookingRes = await createBooking(clientUser, {
        consultantProfileId,
        startsAt,
        endsAt,
        consultationType: "ONLINE",
        idempotencyKey: crypto.randomUUID(),
        clientNote: "SENSITIVE NOTE: this clinical content must not leak into notifications",
      });

      expect(bookingRes.status).toBe("ok");
      if (bookingRes.status !== "ok") return;

      // Consultant should have an in-app notification
      const consultantNotifs = await getNotifications(consultantUser.id);
      expect(consultantNotifs.notifications).toHaveLength(1);
      const notif = consultantNotifs.notifications[0]!;
      expect(notif.type).toBe("APPOINTMENT_REQUESTED");
      expect(notif.payload.title).toBe("New Booking Request");

      // Verify payload and email outbox contain ZERO text from clientNote
      expect(notif.payload.message).not.toContain("SENSITIVE NOTE");
      expect(notif.payload.message).not.toContain("clinical content");

      // EmailOutbox check
      const outboxEntries = await prisma.emailOutbox.findMany({
        where: { userId: consultantUser.id },
      });
      expect(outboxEntries).toHaveLength(1);
      expect(outboxEntries[0]!.template).toBe("APPOINTMENT_REQUESTED");
      const outboxPayload = JSON.stringify(outboxEntries[0]!.payload);
      expect(outboxPayload).not.toContain("SENSITIVE NOTE");
    });

    it("emits APPOINTMENT_CONFIRMED to client when consultant confirms", async () => {
      const now = new Date();
      const startsAt = new Date(now.getTime() + 2 * 3600 * 1000);
      const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId,
          startsAt,
          endsAt,
          status: "PENDING",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      const confirmRes = await confirmAppointment(consultantUser, apt.id);
      expect(confirmRes.status).toBe("ok");

      const clientNotifs = await getNotifications(clientUser.id);
      expect(clientNotifs.notifications).toHaveLength(1);
      expect(clientNotifs.notifications[0]!.type).toBe("APPOINTMENT_CONFIRMED");

      const outbox = await prisma.emailOutbox.findFirst({
        where: { userId: clientUser.id, template: "APPOINTMENT_CONFIRMED" },
      });
      expect(outbox).not.toBeNull();
    });

    it("emits APPOINTMENT_CANCELLED to client when consultant declines", async () => {
      const now = new Date();
      const startsAt = new Date(now.getTime() + 2 * 3600 * 1000);
      const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId,
          startsAt,
          endsAt,
          status: "PENDING",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      const declineRes = await declineAppointment(consultantUser, {
        appointmentId: apt.id,
        reason: "Unavailable during requested session time.",
      });
      expect(declineRes.status).toBe("ok");

      const clientNotifs = await getNotifications(clientUser.id);
      expect(clientNotifs.notifications).toHaveLength(1);
      expect(clientNotifs.notifications[0]!.type).toBe("APPOINTMENT_CANCELLED");
    });

    it("emits APPOINTMENT_COMPLETED to client when session finishes", async () => {
      const now = new Date();
      const startsAt = new Date(now.getTime() - 2 * 3600 * 1000);
      const endsAt = new Date(now.getTime() - 1 * 3600 * 1000);

      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId,
          startsAt,
          endsAt,
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      const completeRes = await completeAppointment(consultantUser, apt.id);
      expect(completeRes.status).toBe("ok");

      const clientNotifs = await getNotifications(clientUser.id);
      expect(clientNotifs.notifications).toHaveLength(1);
      expect(clientNotifs.notifications[0]!.type).toBe("APPOINTMENT_COMPLETED");
    });

    it("notifies both client and consultant on admin cancellation", async () => {
      const now = new Date();
      const startsAt = new Date(now.getTime() + 2 * 3600 * 1000);
      const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId,
          startsAt,
          endsAt,
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 10000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      await adminCancelAppointment(
        { actor: adminUser },
        {
          appointmentId: apt.id,
          reason: "Platform security review.",
        },
      );

      const [clientNotifs, consultantNotifs] = await Promise.all([
        getNotifications(clientUser.id),
        getNotifications(consultantUser.id),
      ]);

      expect(clientNotifs.notifications).toHaveLength(1);
      expect(clientNotifs.notifications[0]!.type).toBe("APPOINTMENT_CANCELLED");

      expect(consultantNotifs.notifications).toHaveLength(1);
      expect(consultantNotifs.notifications[0]!.type).toBe("APPOINTMENT_CANCELLED");
    });
  });

  describe("Read state management & IDOR defenses", () => {
    it("marks a single notification as read and decrements unread count", async () => {
      const notif = await prisma.notification.create({
        data: {
          userId: clientUser.id,
          type: "APPOINTMENT_CONFIRMED",
          payload: { title: "Test", message: "Test message" },
        },
      });

      const initialCount = await getUnreadNotificationCount(clientUser.id);
      expect(initialCount).toBe(1);

      const marked = await markNotificationAsRead(clientUser.id, notif.id);
      expect(marked).toBe(true);

      const updatedCount = await getUnreadNotificationCount(clientUser.id);
      expect(updatedCount).toBe(0);
    });

    it("refuses marking another user's notification as read (IDOR defense)", async () => {
      const notif = await prisma.notification.create({
        data: {
          userId: consultantUser.id,
          type: "APPOINTMENT_REQUESTED",
          payload: { title: "Test", message: "Test message" },
        },
      });

      // Client attempts to mark consultant's notification as read
      const result = await markNotificationAsRead(clientUser.id, notif.id);
      expect(result).toBe(false);

      // Notification is still unread for consultant
      const count = await getUnreadNotificationCount(consultantUser.id);
      expect(count).toBe(1);
    });

    it("marks all notifications as read in bulk", async () => {
      await prisma.notification.createMany({
        data: [
          { userId: clientUser.id, type: "APPOINTMENT_CONFIRMED", payload: { title: "1", message: "1" } },
          { userId: clientUser.id, type: "APPOINTMENT_COMPLETED", payload: { title: "2", message: "2" } },
        ],
      });

      const before = await getUnreadNotificationCount(clientUser.id);
      expect(before).toBe(2);

      const count = await markAllNotificationsAsRead(clientUser.id);
      expect(count).toBe(2);

      const after = await getUnreadNotificationCount(clientUser.id);
      expect(after).toBe(0);
    });
  });
});
