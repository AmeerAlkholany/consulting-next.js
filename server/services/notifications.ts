import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import type { NotificationType } from "@/db/generated/prisma/client";

export interface NotificationPayload {
  appointmentId?: string;
  consultantName?: string;
  clientName?: string;
  startsAt?: string;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Notification service (IMPLEMENTATION.md Step 16).
 *
 * Creates notification records in the database. Email delivery is handled by
 * the outbox drain job (Step 18).
 */

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  await db.notification.create({
    data: {
      userId,
      type,
      payload: payload as never,
    },
  });

  logger.info({ userId, type }, "notification created");
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await db.notification.update({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  logger.info({ userId, count: result.count }, "notifications marked as read");
  return result.count;
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, readAt: null },
  });
}

export async function getUserNotifications(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<
  Array<{ id: string; type: string; payload: unknown; createdAt: Date; readAt: Date | null }>
> {
  const { limit = 20, offset = 0 } = options;

  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      type: true,
      payload: true,
      createdAt: true,
      readAt: true,
    },
  });
}

/** Helper to broadcast a notification to all admins. */
export async function notifyAdmins(
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });

  await Promise.all(admins.map((admin) => createNotification(admin.id, type, payload)));
}
