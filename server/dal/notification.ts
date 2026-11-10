import "server-only";

import { db } from "@/db/client";
import type { NotificationTypeEnum } from "@/schemas/notification";

export interface NotificationRow {
  id: string;
  userId: string;
  type: NotificationTypeEnum;
  payload: {
    title: string;
    message: string;
    appointmentId?: string;
    consultantProfileId?: string;
    link?: string;
  };
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Gets paginated notifications for the current authenticated user.
 * IDOR defense: Always filtered strictly by userId.
 */
export async function getNotifications(
  userId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<{ notifications: NotificationRow[]; total: number; unreadCount: number }> {
  const { page = 1, perPage = 20 } = options;

  const [records, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        userId: true,
        type: true,
        payload: true,
        readAt: true,
        createdAt: true,
      },
    }),
    db.notification.count({ where: { userId } }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  const notifications: NotificationRow[] = records.map((r) => ({
    id: r.id,
    userId: r.userId,
    type: r.type as NotificationTypeEnum,
    payload: (r.payload ?? {}) as NotificationRow["payload"],
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));

  return { notifications, total, unreadCount };
}

/**
 * Gets just the count of unread notifications for a user (for the header bell).
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, readAt: null },
  });
}

/**
 * Marks one notification as read for a user.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const result = await db.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });

  return result.count > 0;
}

/**
 * Marks all unread notifications as read for a user.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  return result.count;
}
