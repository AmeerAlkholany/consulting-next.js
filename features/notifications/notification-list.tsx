"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationItem } from "./notification-item";
import { MarkAllRead } from "./mark-all-read";
import { BellOff } from "lucide-react";
import type { NotificationRow } from "@/server/dal/notification";

interface NotificationListProps {
  initialNotifications: NotificationRow[];
  unreadCount: number;
}

export function NotificationList({
  initialNotifications,
  unreadCount: initialUnreadCount,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<NotificationRow[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);

  const handleItemMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleAllMarkRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date() })));
    setUnreadCount(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "All notifications read"}
        </p>
        <MarkAllRead onSuccess={handleAllMarkRead} disabled={unreadCount === 0} />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <BellOff className="h-10 w-10 text-muted-foreground/60 mx-auto" />
              <p className="text-sm font-medium text-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground">
                You&apos;re all caught up! Updates regarding consultations will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleItemMarkRead}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
