import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import type { Prisma } from "@/db/generated/prisma/client";
import type { NotificationTypeEnum, NotificationPayload } from "@/schemas/notification";
import { notificationPayloadSchema } from "@/schemas/notification";
import type { EmailTemplateData } from "@/lib/notification-templates";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationTypeEnum;
  payload: NotificationPayload;
  emailDetails?: {
    toEmail: string;
    template: string;
    data: EmailTemplateData;
  };
}

/**
 * Creates an in-app Notification and an EmailOutbox row.
 * If a Prisma TransactionClient (`tx`) is provided, operations execute within
 * that transaction to guarantee atomic rollbacks (ARCHITECTURE.md §20).
 */
export async function sendNotification(
  params: CreateNotificationParams,
  tx?: Prisma.TransactionClient,
): Promise<{ notificationId: string }> {
  // Validate payload before writing to ensure renderer never receives malformed json
  const validatedPayload = notificationPayloadSchema.parse(params.payload);

  const client = tx ?? db;

  const notification = await client.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      payload: validatedPayload as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  if (params.emailDetails) {
    await client.emailOutbox.create({
      data: {
        userId: params.userId,
        toEmail: params.emailDetails.toEmail,
        template: params.emailDetails.template,
        payload: params.emailDetails.data as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });
  }

  logger.info(
    { userId: params.userId, type: params.type, notificationId: notification.id },
    "notification created and email outbox queued",
  );

  return { notificationId: notification.id };
}
