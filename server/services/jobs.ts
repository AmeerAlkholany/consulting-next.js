import "server-only";

import crypto from "crypto";
import { db } from "@/db/client";
import { env } from "@/config/env";
import { BOOKING_POLICY } from "@/config/booking";
import { logger } from "@/server/logger";
import { sendNotification } from "@/server/services/notifications";
import {
  getAppointmentCompletedTemplate,
  getAppointmentReminderTemplate,
  getAppointmentCancelledTemplate,
  type EmailTemplateData,
} from "@/lib/notification-templates";
import { getEmailProvider } from "@/server/email/provider";
import { renderEmail } from "@/server/email/templates";
import { formatDateTimeInZone } from "@/lib/datetime";

/**
 * Validates the Authorization Bearer header using timing-safe comparison (ARCHITECTURE.md §16).
 */
export function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  const configuredSecret = env.CRON_SECRET;
  if (!configuredSecret) {
    logger.warn("CRON_SECRET is not configured on the server");
    return false;
  }

  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(configuredSecret);

  if (tokenBuffer.length !== secretBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
}

/**
 * Completes confirmed appointments whose endsAt passed more than the grace period ago.
 * Default grace period: 2 hours (BOOKING_POLICY.completionGracePeriodHours).
 * Atomically transitions status to COMPLETED and emits notification + review invitation.
 */
export async function completePastAppointments(now: Date = new Date()): Promise<{ updated: number }> {
  const gracePeriodMs = BOOKING_POLICY.completionGracePeriodHours * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - gracePeriodMs);

  const eligibleAppointments = await db.appointment.findMany({
    where: {
      status: "CONFIRMED",
      endsAt: { lte: cutoff },
    },
    select: {
      id: true,
      endsAt: true,
      clientProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          user: { select: { email: true, fullName: true } },
        },
      },
      consultantProfile: {
        select: {
          id: true,
          user: { select: { fullName: true } },
        },
      },
    },
  });

  let updatedCount = 0;

  for (const appt of eligibleAppointments) {
    await db.$transaction(async (tx) => {
      // Transition status to COMPLETED
      await tx.appointment.update({
        where: { id: appt.id },
        data: {
          status: "COMPLETED",
          completedAt: appt.endsAt,
        },
      });

      // Emit APPOINTMENT_COMPLETED notification and review prompt email to client
      const clientName = appt.clientProfile.displayName || appt.clientProfile.user.fullName;
      const consultantName = appt.consultantProfile.user.fullName;

      const emailTemplate = getAppointmentCompletedTemplate({
        clientName,
        consultantName,
        appointmentId: appt.id,
      });

      await sendNotification(
        {
          userId: appt.clientProfile.userId,
          type: "APPOINTMENT_COMPLETED",
          payload: {
            title: "Consultation Completed",
            message: `Your session with ${consultantName} has completed. Please consider sharing your review.`,
            appointmentId: appt.id,
            link: `/appointments/${appt.id}/review`,
          },
          emailDetails: {
            toEmail: appt.clientProfile.user.email,
            template: "APPOINTMENT_COMPLETED",
            data: emailTemplate,
          },
        },
        tx
      );

      updatedCount++;
    });

    logger.info({ appointmentId: appt.id }, "appointment auto-completed by scheduled job");
  }

  return { updated: updatedCount };
}

/**
 * Sweeps for upcoming confirmed appointments and sends 24-hour and 1-hour reminders.
 * Idempotent: uses remindersSentAt timestamp array on Appointment.
 */
export async function sendAppointmentReminders(now: Date = new Date()): Promise<{ queued: number }> {
  const nowMs = now.getTime();

  // Window definitions
  const h24Start = new Date(nowMs + 23 * 60 * 60 * 1000);
  const h24End = new Date(nowMs + 25 * 60 * 60 * 1000);

  const m60Start = new Date(nowMs + 50 * 60 * 1000);
  const m60End = new Date(nowMs + 70 * 60 * 1000);

  // Find all confirmed appointments in either window
  const appointments = await db.appointment.findMany({
    where: {
      status: "CONFIRMED",
      OR: [
        { startsAt: { gte: h24Start, lte: h24End } },
        { startsAt: { gte: m60Start, lte: m60End } },
      ],
    },
    select: {
      id: true,
      startsAt: true,
      clientTimezone: true,
      consultantTimezone: true,
      remindersSentAt: true,
      clientProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          user: { select: { email: true, fullName: true } },
        },
      },
      consultantProfile: {
        select: {
          id: true,
          userId: true,
          user: { select: { email: true, fullName: true } },
        },
      },
    },
  });

  let queuedCount = 0;

  for (const appt of appointments) {
    const timeUntilStartMs = appt.startsAt.getTime() - nowMs;
    const is24h = timeUntilStartMs > 12 * 60 * 60 * 1000;
    const timeframeText = is24h ? "tomorrow" : "in 1 hour";

    // Idempotency: check if reminder was already sent for this window
    // 24h reminder check: already sent if any timestamp recorded within the past 12h
    // 1h reminder check: already sent if any timestamp recorded within the past 2h
    const thresholdMs = is24h ? 12 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
    const alreadySent = appt.remindersSentAt.some(
      (sentTime) => nowMs - sentTime.getTime() < thresholdMs
    );

    if (alreadySent) {
      continue;
    }

    await db.$transaction(async (tx) => {
      // Record reminder timestamp
      await tx.appointment.update({
        where: { id: appt.id },
        data: {
          remindersSentAt: { push: now },
        },
      });

      const clientName = appt.clientProfile.displayName || appt.clientProfile.user.fullName;
      const consultantName = appt.consultantProfile.user.fullName;

      const formattedForClient = formatDateTimeInZone(appt.startsAt, appt.clientTimezone);
      const formattedForConsultant = formatDateTimeInZone(appt.startsAt, appt.consultantTimezone);

      // 1. Client reminder
      const clientEmailData = getAppointmentReminderTemplate({
        recipientName: clientName,
        otherPartyName: consultantName,
        startsAtFormatted: formattedForClient,
        appointmentId: appt.id,
        timeframeText,
      });

      await sendNotification(
        {
          userId: appt.clientProfile.userId,
          type: "APPOINTMENT_REMINDER",
          payload: {
            title: `Consultation Reminder (${timeframeText})`,
            message: `Your consultation with ${consultantName} is scheduled for ${formattedForClient}.`,
            appointmentId: appt.id,
            link: `/appointments/${appt.id}`,
          },
          emailDetails: {
            toEmail: appt.clientProfile.user.email,
            template: "APPOINTMENT_REMINDER",
            data: clientEmailData,
          },
        },
        tx
      );

      // 2. Consultant reminder
      const consultantEmailData = getAppointmentReminderTemplate({
        recipientName: consultantName,
        otherPartyName: clientName,
        startsAtFormatted: formattedForConsultant,
        appointmentId: appt.id,
        timeframeText,
      });

      await sendNotification(
        {
          userId: appt.consultantProfile.userId,
          type: "APPOINTMENT_REMINDER",
          payload: {
            title: `Session Reminder (${timeframeText})`,
            message: `Your consultation with ${clientName} is scheduled for ${formattedForConsultant}.`,
            appointmentId: appt.id,
            link: `/consultant/appointments/${appt.id}`,
          },
          emailDetails: {
            toEmail: appt.consultantProfile.user.email,
            template: "APPOINTMENT_REMINDER",
            data: consultantEmailData,
          },
        },
        tx
      );

      queuedCount++;
    });

    logger.info({ appointmentId: appt.id, timeframe: timeframeText }, "reminders queued for appointment");
  }

  return { queued: queuedCount };
}

/**
 * Drains pending EmailOutbox rows in bounded batches with capped exponential backoff retries.
 * Returns 503 error if EMAIL_PROVIDER=none unless explicitly allowed for testing.
 */
export async function drainOutbox(options?: {
  batchSize?: number;
  now?: Date;
  allowNullProviderInTest?: boolean;
}): Promise<{
  processed: number;
  sent: number;
  failed: number;
  status: number;
  error?: string;
}> {
  const batchSize = Math.min(100, options?.batchSize ?? 50);
  const now = options?.now ?? new Date();

  // Return 503 when provider is none (ARCHITECTURE.md §20 / IMPLEMENTATION.md Step 18)
  if (env.EMAIL_PROVIDER === "none" && !options?.allowNullProviderInTest) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      status: 503,
      error: "EMAIL_PROVIDER is set to 'none'. Outbox draining is disabled.",
    };
  }

  const pendingRows = await db.emailOutbox.findMany({
    where: {
      status: "PENDING",
      availableAt: { lte: now },
      attempts: { lt: 5 },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  const provider = getEmailProvider();
  let sentCount = 0;
  let failedCount = 0;

  for (const row of pendingRows) {
    const templateData = row.payload as unknown as EmailTemplateData;
    const rendered = renderEmail(templateData);

    try {
      const sendResult = await provider.sendEmail({
        to: row.toEmail,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });

      if (sendResult.success) {
        await db.emailOutbox.update({
          where: { id: row.id },
          data: {
            status: "SENT",
            sentAt: now,
            attempts: { increment: 1 },
          },
        });
        sentCount++;
      } else {
        const nextAttempts = row.attempts + 1;
        const isFinalFailure = nextAttempts >= 5;

        // Exponential backoff: 2^attempts minutes
        const backoffMs = Math.pow(2, nextAttempts) * 60 * 1000;
        const nextAvailableAt = new Date(now.getTime() + backoffMs);

        await db.emailOutbox.update({
          where: { id: row.id },
          data: {
            status: isFinalFailure ? "FAILED" : "PENDING",
            attempts: nextAttempts,
            availableAt: nextAvailableAt,
            lastError: sendResult.error || "Delivery failed",
          },
        });
        failedCount++;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const nextAttempts = row.attempts + 1;
      const isFinalFailure = nextAttempts >= 5;
      const backoffMs = Math.pow(2, nextAttempts) * 60 * 1000;

      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: isFinalFailure ? "FAILED" : "PENDING",
          attempts: nextAttempts,
          availableAt: new Date(now.getTime() + backoffMs),
          lastError: errorMsg,
        },
      });
      failedCount++;
    }
  }

  logger.info({ processed: pendingRows.length, sent: sentCount, failed: failedCount }, "outbox drain run completed");

  return {
    processed: pendingRows.length,
    sent: sentCount,
    failed: failedCount,
    status: 200,
  };
}

/**
 * Periodic system cleanup:
 * 1. Expired sessions
 * 2. Consumed/expired verification tokens
 * 3. Notifications older than 180 days
 * 4. Stale PENDING appointments past their start time (cancelledBy = SYSTEM)
 */
export async function pruneSystem(now: Date = new Date()): Promise<{
  expiredSessionsDeleted: number;
  expiredTokensDeleted: number;
  oldNotificationsDeleted: number;
  stalePendingAppointmentsCancelled: number;
}> {
  // 1. Expired sessions
  const sessionsResult = await db.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // 2. Expired verification tokens
  const tokensResult = await db.verificationToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // 3. Notifications older than 180 days
  const oneHundredEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const notificationsResult = await db.notification.deleteMany({
    where: { createdAt: { lt: oneHundredEightyDaysAgo } },
  });

  // 4. Stale PENDING appointments past their start time
  const stalePendingAppointments = await db.appointment.findMany({
    where: {
      status: "PENDING",
      startsAt: { lt: now },
    },
    select: {
      id: true,
      clientProfile: {
        select: {
          userId: true,
          displayName: true,
          user: { select: { email: true, fullName: true } },
        },
      },
      consultantProfile: {
        select: {
          userId: true,
          user: { select: { email: true, fullName: true } },
        },
      },
    },
  });

  let cancelledCount = 0;

  for (const appt of stalePendingAppointments) {
    await db.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appt.id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelledBy: "SYSTEM",
          cancellationReason: "Expired without confirmation before appointment start time.",
        },
      });

      const clientName = appt.clientProfile.displayName || appt.clientProfile.user.fullName;
      const consultantName = appt.consultantProfile.user.fullName;

      // Notify client
      const clientEmail = getAppointmentCancelledTemplate({
        recipientName: clientName,
        cancelledByName: "System",
        reason: "The booking request expired unconfirmed before the session start time.",
        appointmentId: appt.id,
      });

      await sendNotification(
        {
          userId: appt.clientProfile.userId,
          type: "APPOINTMENT_CANCELLED",
          payload: {
            title: "Appointment Request Expired",
            message: `Your booking request with ${consultantName} was cancelled as it was not confirmed before the scheduled start.`,
            appointmentId: appt.id,
            link: "/appointments",
          },
          emailDetails: {
            toEmail: appt.clientProfile.user.email,
            template: "APPOINTMENT_CANCELLED",
            data: clientEmail,
          },
        },
        tx
      );

      // Notify consultant
      const consultantEmail = getAppointmentCancelledTemplate({
        recipientName: consultantName,
        cancelledByName: "System",
        reason: "The booking request expired unconfirmed before the session start time.",
        appointmentId: appt.id,
      });

      await sendNotification(
        {
          userId: appt.consultantProfile.userId,
          type: "APPOINTMENT_CANCELLED",
          payload: {
            title: "Booking Request Expired",
            message: `A booking request from ${clientName} expired without confirmation.`,
            appointmentId: appt.id,
            link: "/consultant/appointments",
          },
          emailDetails: {
            toEmail: appt.consultantProfile.user.email,
            template: "APPOINTMENT_CANCELLED",
            data: consultantEmail,
          },
        },
        tx
      );

      cancelledCount++;
    });

    logger.info({ appointmentId: appt.id }, "stale pending appointment auto-cancelled by prune job");
  }

  return {
    expiredSessionsDeleted: sessionsResult.count,
    expiredTokensDeleted: tokensResult.count,
    oldNotificationsDeleted: notificationsResult.count,
    stalePendingAppointmentsCancelled: cancelledCount,
  };
}
