"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/dal";
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/server/dal/notification";
import { markNotificationReadSchema } from "@/schemas/notification";

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "Unauthorized" };
  }

  const parsed = markNotificationReadSchema.safeParse({ notificationId });
  if (!parsed.success) {
    return { success: false, message: "Invalid notification ID" };
  }

  const updated = await markNotificationAsRead(user.id, parsed.data.notificationId);
  if (!updated) {
    return { success: false, message: "Notification not found or already read" };
  }

  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllReadAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "Unauthorized" };
  }

  const count = await markAllNotificationsAsRead(user.id);
  revalidatePath("/notifications");
  return { success: true, data: { count } };
}
