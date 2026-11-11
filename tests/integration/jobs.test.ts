import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import {
  completePastAppointments,
  sendAppointmentReminders,
  drainOutbox,
  pruneSystem,
  verifyCronSecret,
} from "@/server/services/jobs";
import { setEmailProviderForTest, type EmailProvider, type SendEmailOptions, type SendEmailResult } from "@/server/email/provider";
import { POST as completePost } from "@/app/api/cron/complete-appointments/route";
import { POST as remindersPost } from "@/app/api/cron/send-reminders/route";
import { POST as drainPost } from "@/app/api/cron/drain-outbox/route";
import { POST as prunePost } from "@/app/api/cron/prune/route";
import { NextRequest } from "next/server";
import { env } from "@/config/env";

describe("Scheduled Jobs & Email Delivery Pipeline (Step 18)", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
    setEmailProviderForTest(null);
  });

  beforeEach(async () => {
    await cleanDatabase();
    setEmailProviderForTest(null);
  });

  async function createFixtureConsultantAndClient() {
    const consultantUser = await prisma.user.create({
      data: {
        email: `consultant-${crypto.randomUUID()}@example.com`,
        fullName: "Dr. Jobs Consultant",
        passwordHash: "dummy-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        consultantProfile: {
          create: {
            slug: `dr-jobs-${crypto.randomUUID()}`,
            headline: "Expert Consultant",
            bio: "Clinical psychologist for jobs tests.",
            yearsOfExperience: 8,
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

    const clientUser = await prisma.user.create({
      data: {
        email: `client-${crypto.randomUUID()}@example.com`,
        fullName: "Job Client",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        clientProfile: {
          create: {
            displayName: "Job Client",
          },
        },
      },
      include: { clientProfile: true },
    });

    return {
      consultantUser,
      consultantProfile: consultantUser.consultantProfile!,
      clientUser,
      clientProfile: clientUser.clientProfile!,
    };
  }

  describe("Cron Secret Authorization & Route Handlers", () => {
    const validSecret = env.CRON_SECRET || "test-cron-secret-32-chars-long-abc123";

    it("timing-safe secret verifier accepts exact secret and rejects missing or incorrect secrets", () => {
      const validReq = new Request("http://localhost/api/cron/test", {
        headers: { Authorization: `Bearer ${validSecret}` },
      });
      expect(verifyCronSecret(validReq)).toBe(true);

      const wrongReq = new Request("http://localhost/api/cron/test", {
        headers: { Authorization: "Bearer wrong-secret-value-1234567890" },
      });
      expect(verifyCronSecret(wrongReq)).toBe(false);

      const missingReq = new Request("http://localhost/api/cron/test");
      expect(verifyCronSecret(missingReq)).toBe(false);
    });

    it("route handlers return 401 when Authorization header is missing or invalid", async () => {
      const req = new NextRequest("http://localhost/api/cron/complete-appointments", {
        method: "POST",
      });

      const res1 = await completePost(req);
      expect(res1.status).toBe(401);

      const res2 = await remindersPost(req);
      expect(res2.status).toBe(401);

      const res3 = await drainPost(req);
      expect(res3.status).toBe(401);

      const res4 = await prunePost(req);
      expect(res4.status).toBe(401);
    });

    it("route handlers succeed with 200 when valid Bearer secret is presented", async () => {
      const req = new NextRequest("http://localhost/api/cron/complete-appointments", {
        method: "POST",
        headers: { Authorization: `Bearer ${validSecret}` },
      });

      const res = await completePost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
    });
  });

  describe("completePastAppointments", () => {
    it("completes confirmed appointments past grace period and writes notifications idempotently", async () => {
      const { consultantProfile, clientProfile, clientUser } = await createFixtureConsultantAndClient();
      const now = new Date();

      // Appt 1: CONFIRMED, ended 3 hours ago (> 2h grace period)
      const pastConfirmed = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(now.getTime() - 4 * 3600000),
          endsAt: new Date(now.getTime() - 3 * 3600000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "CONFIRMED",
        },
      });

      // Appt 2: CONFIRMED, ended 30 minutes ago (< 2h grace period)
      const recentConfirmed = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(now.getTime() - 80 * 60000),
          endsAt: new Date(now.getTime() - 30 * 60000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "CONFIRMED",
        },
      });

      // Appt 3: CANCELLED, ended 3 hours ago
      const pastCancelled = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(now.getTime() - 4 * 3600000),
          endsAt: new Date(now.getTime() - 3 * 3600000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "CANCELLED",
        },
      });

      // First run: should complete Appt 1
      const res1 = await completePastAppointments(now);
      expect(res1.updated).toBe(1);

      const check1 = await prisma.appointment.findUnique({ where: { id: pastConfirmed.id } });
      expect(check1?.status).toBe("COMPLETED");
      expect(check1?.completedAt).not.toBeNull();

      // Appt 2 remains CONFIRMED (in grace period)
      const check2 = await prisma.appointment.findUnique({ where: { id: recentConfirmed.id } });
      expect(check2?.status).toBe("CONFIRMED");

      // Appt 3 remains CANCELLED
      const check3 = await prisma.appointment.findUnique({ where: { id: pastCancelled.id } });
      expect(check3?.status).toBe("CANCELLED");

      // Verify client received APPOINTMENT_COMPLETED notification and review prompt email
      const notif = await prisma.notification.findFirst({
        where: { userId: clientUser.id, type: "APPOINTMENT_COMPLETED" },
      });
      expect(notif).not.toBeNull();
      const payload = notif?.payload as Record<string, unknown>;
      expect(payload.link).toBe(`/appointments/${pastConfirmed.id}/review`);

      const outbox = await prisma.emailOutbox.findFirst({
        where: { userId: clientUser.id, template: "APPOINTMENT_COMPLETED" },
      });
      expect(outbox).not.toBeNull();

      // Idempotency: second run completes 0 appointments
      const res2 = await completePastAppointments(now);
      expect(res2.updated).toBe(0);
    });
  });

  describe("sendAppointmentReminders", () => {
    it("sends 24h and 1h reminders once and remains idempotent across overlapping runs", async () => {
      const { consultantProfile, clientProfile, clientUser, consultantUser } =
        await createFixtureConsultantAndClient();
      const now = new Date();

      // 1. Appointment starting in 24 hours
      const appt24h = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(now.getTime() + 24 * 3600000),
          endsAt: new Date(now.getTime() + 24 * 3600000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "CONFIRMED",
        },
      });

      // 2. Appointment starting in 60 minutes
      const appt1h = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(now.getTime() + 60 * 60000),
          endsAt: new Date(now.getTime() + 110 * 60000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "CONFIRMED",
        },
      });

      // 3. Appointment starting in 5 hours (neither window)
      await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(now.getTime() + 5 * 3600000),
          endsAt: new Date(now.getTime() + 5 * 3600000 + 3000000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "CONFIRMED",
        },
      });

      // First run: queues reminders for appt24h and appt1h
      const res1 = await sendAppointmentReminders(now);
      expect(res1.queued).toBe(2);

      // Verify notifications and outbox rows created for client and consultant
      const clientReminders = await prisma.notification.findMany({
        where: { userId: clientUser.id, type: "APPOINTMENT_REMINDER" },
      });
      expect(clientReminders.length).toBe(2);

      const consultantReminders = await prisma.notification.findMany({
        where: { userId: consultantUser.id, type: "APPOINTMENT_REMINDER" },
      });
      expect(consultantReminders.length).toBe(2);

      // Verify remindersSentAt array updated
      const updated24h = await prisma.appointment.findUnique({ where: { id: appt24h.id } });
      expect(updated24h?.remindersSentAt.length).toBe(1);

      const updated1h = await prisma.appointment.findUnique({ where: { id: appt1h.id } });
      expect(updated1h?.remindersSentAt.length).toBe(1);

      // Second run immediately: must be idempotent and queue 0
      const res2 = await sendAppointmentReminders(now);
      expect(res2.queued).toBe(0);
    });
  });

  describe("drainOutbox", () => {
    it("returns 503 when EMAIL_PROVIDER is none and not in test override mode", async () => {
      const res = await drainOutbox();
      if (env.EMAIL_PROVIDER === "none") {
        expect(res.status).toBe(503);
      }
    });

    it("processes pending outbox rows, updates SENT status, and applies exponential backoff on failure", async () => {
      const now = new Date();

      // Configure a test mock email provider
      const sentEmails: SendEmailOptions[] = [];
      let shouldFail = false;

      const mockProvider: EmailProvider = {
        name: "test-mock",
        async sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
          if (shouldFail) {
            return { success: false, error: "SMTP Connection Refused" };
          }
          sentEmails.push(opts);
          return { success: true, messageId: `mock-${crypto.randomUUID()}` };
        },
      };

      setEmailProviderForTest(mockProvider);

      // Create a pending outbox row
      const outboxRow = await prisma.emailOutbox.create({
        data: {
          toEmail: "test-client@example.com",
          template: "APPOINTMENT_CONFIRMED",
          payload: {
            subject: "Your appointment is confirmed",
            headline: "Confirmed",
            body: "Session is confirmed.",
          },
          status: "PENDING",
          availableAt: now,
        },
      });

      // 1. Successful send
      const res = await drainOutbox({ batchSize: 10, now, allowNullProviderInTest: true });
      expect(res.sent).toBe(1);
      expect(sentEmails.length).toBe(1);

      const updated = await prisma.emailOutbox.findUnique({ where: { id: outboxRow.id } });
      expect(updated?.status).toBe("SENT");
      expect(updated?.sentAt).not.toBeNull();

      // 2. Failed delivery with backoff
      shouldFail = true;
      const failingRow = await prisma.emailOutbox.create({
        data: {
          toEmail: "failing-client@example.com",
          template: "APPOINTMENT_REQUESTED",
          payload: {
            subject: "Failed email test",
            headline: "Request",
            body: "Body",
          },
          status: "PENDING",
          attempts: 1,
          availableAt: now,
        },
      });

      const failRes = await drainOutbox({ batchSize: 10, now, allowNullProviderInTest: true });
      expect(failRes.failed).toBe(1);

      const failedRecord = await prisma.emailOutbox.findUnique({ where: { id: failingRow.id } });
      expect(failedRecord?.status).toBe("PENDING");
      expect(failedRecord?.attempts).toBe(2);
      expect(failedRecord?.lastError).toContain("SMTP Connection Refused");
      expect(failedRecord?.availableAt.getTime()).toBeGreaterThan(now.getTime());

      // 3. Max attempts reached -> FAILED
      await prisma.emailOutbox.update({
        where: { id: failingRow.id },
        data: { attempts: 4, availableAt: now },
      });

      await drainOutbox({ batchSize: 10, now, allowNullProviderInTest: true });
      const permanentlyFailed = await prisma.emailOutbox.findUnique({ where: { id: failingRow.id } });
      expect(permanentlyFailed?.status).toBe("FAILED");
      expect(permanentlyFailed?.attempts).toBe(5);
    });
  });

  describe("pruneSystem", () => {
    it("deletes expired sessions, tokens, old notifications, and auto-cancels stale pending appointments", async () => {
      const { consultantProfile, clientProfile, clientUser, consultantUser } =
        await createFixtureConsultantAndClient();
      const now = new Date();

      // 1. Expired vs active session
      await prisma.session.create({
        data: {
          userId: clientUser.id,
          tokenHash: `hash-expired-${crypto.randomUUID()}`,
          expiresAt: new Date(now.getTime() - 1000), // expired
          lastUsedAt: new Date(),
        },
      });
      await prisma.session.create({
        data: {
          userId: clientUser.id,
          tokenHash: `hash-active-${crypto.randomUUID()}`,
          expiresAt: new Date(now.getTime() + 86400000), // active
          lastUsedAt: new Date(),
        },
      });

      // 2. Expired vs active token
      await prisma.verificationToken.create({
        data: {
          userId: clientUser.id,
          tokenHash: `token-expired-${crypto.randomUUID()}`,
          type: "EMAIL_VERIFICATION",
          expiresAt: new Date(now.getTime() - 1000), // expired
        },
      });
      await prisma.verificationToken.create({
        data: {
          userId: clientUser.id,
          tokenHash: `token-active-${crypto.randomUUID()}`,
          type: "EMAIL_VERIFICATION",
          expiresAt: new Date(now.getTime() + 86400000), // active
        },
      });

      // 3. Old notification (> 180 days) vs recent notification
      await prisma.notification.create({
        data: {
          userId: clientUser.id,
          type: "APPOINTMENT_REQUESTED",
          payload: { title: "Old", message: "Old" },
          createdAt: new Date(now.getTime() - 190 * 86400000), // > 180 days old
        },
      });
      await prisma.notification.create({
        data: {
          userId: clientUser.id,
          type: "APPOINTMENT_REQUESTED",
          payload: { title: "Recent", message: "Recent" },
          createdAt: new Date(now.getTime() - 5 * 86400000), // 5 days old
        },
      });

      // 4. Stale PENDING appointment past its start time
      const stalePending = await prisma.appointment.create({
        data: {
          clientProfileId: clientProfile.id,
          consultantProfileId: consultantProfile.id,
          startsAt: new Date(now.getTime() - 3600000), // started 1 hour ago
          endsAt: new Date(now.getTime() - 600000),
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          status: "PENDING",
        },
      });

      // Run prune
      const pruneResults = await pruneSystem(now);
      expect(pruneResults.expiredSessionsDeleted).toBe(1);
      expect(pruneResults.expiredTokensDeleted).toBe(1);
      expect(pruneResults.oldNotificationsDeleted).toBe(1);
      expect(pruneResults.stalePendingAppointmentsCancelled).toBe(1);

      // Verify active session kept
      const remainingSessions = await prisma.session.findMany({ where: { userId: clientUser.id } });
      expect(remainingSessions.length).toBe(1);

      // Verify active token kept
      const remainingTokens = await prisma.verificationToken.findMany({ where: { userId: clientUser.id } });
      expect(remainingTokens.length).toBe(1);

      // Verify stale appointment was cancelled by SYSTEM
      const checkStale = await prisma.appointment.findUnique({ where: { id: stalePending.id } });
      expect(checkStale?.status).toBe("CANCELLED");
      expect(checkStale?.cancelledBy).toBe("SYSTEM");

      // Verify cancellation notifications emitted to both parties
      const clientCancellation = await prisma.notification.findFirst({
        where: { userId: clientUser.id, type: "APPOINTMENT_CANCELLED" },
      });
      expect(clientCancellation).not.toBeNull();

      const consultantCancellation = await prisma.notification.findFirst({
        where: { userId: consultantUser.id, type: "APPOINTMENT_CANCELLED" },
      });
      expect(consultantCancellation).not.toBeNull();
    });
  });
});
