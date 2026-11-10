"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationBellProps {
  initialUnreadCount?: number;
}

export function NotificationBell({ initialUnreadCount = 0 }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);

  useEffect(() => {
    let isMounted = true;

    async function fetchUnreadCount() {
      // Only poll when the document tab is visible to conserve client resources
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      try {
        const res = await fetch("/api/notifications/unread-count");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.unreadCount === "number") {
            setUnreadCount(data.unreadCount);
          }
        }
      } catch (_err) {
        // Fail silently without disrupting UX
      }
    }

    // 30-second polling interval
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className="relative p-2 h-9 w-9 text-muted-foreground hover:text-foreground"
      aria-label={`Notifications (${unreadCount} unread)`}
    >
      <Link href="/notifications">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
