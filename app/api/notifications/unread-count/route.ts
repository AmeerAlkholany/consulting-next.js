import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { getUnreadNotificationCount } from "@/server/dal/notification";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ unreadCount: 0 }, { status: 401 });
  }

  try {
    const unreadCount = await getUnreadNotificationCount(user.id);
    return NextResponse.json({ unreadCount });
  } catch (_err) {
    return NextResponse.json({ unreadCount: 0 }, { status: 500 });
  }
}
