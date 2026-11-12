import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { getUnreadNotificationCount } from "@/server/dal/notification";

export async function GET() {
  const user = await getCurrentUser();

  let unreadCount = 0;

  if (user) {
    try {
      unreadCount = await getUnreadNotificationCount(user.id);
    } catch (_err) {
      unreadCount = 0;
    }
  }

  return NextResponse.json({ unreadCount });
}