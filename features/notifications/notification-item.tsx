"use client";

import { useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarPlus,
  CalendarCheck,
  CalendarX,
  RefreshCw,
  Clock,
  Award,
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationReadAction } from "./actions";
import type { NotificationRow } from "@/server/dal/notification";

interface NotificationItemProps {
  notification: NotificationRow;
  onMarkRead?: (id: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const [isPending, startTransition] = useTransition();

  const isUnread = !notification.readAt;

  const handleMarkRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      onMarkRead?.(notification.id);
      await markNotificationReadAction(notification.id);
    });
  };

  const getIcon = () => {
    switch (notification.type) {
      case "APPOINTMENT_REQUESTED":
        return <CalendarPlus className="h-4 w-4 text-primary" />;
      case "APPOINTMENT_CONFIRMED":
        return <CalendarCheck className="h-4 w-4 text-emerald-600" />;
      case "APPOINTMENT_CANCELLED":
        return <CalendarX className="h-4 w-4 text-destructive" />;
      case "APPOINTMENT_RESCHEDULED":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case "APPOINTMENT_REMINDER":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "APPOINTMENT_COMPLETED":
        return <Award className="h-4 w-4 text-primary" />;
      case "REVIEW_RECEIVED":
        return <Star className="h-4 w-4 text-amber-400 fill-amber-400" />;
      case "CONSULTANT_APPROVED":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "CONSULTANT_REJECTED":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "CONSULTANT_SUSPENDED":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const destinationLink =
    notification.payload.link ||
    (notification.payload.appointmentId
      ? `/appointments/${notification.payload.appointmentId}`
      : undefined);

  const content = (
    <div
      className={`p-4 flex items-start gap-3 transition-colors ${
        isUnread ? "bg-muted/30 font-medium" : "bg-card hover:bg-muted/10"
      }`}
    >
      <div className="mt-0.5 shrink-0 rounded-full bg-background p-2 border">{getIcon()}</div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{notification.payload.title}</p>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {notification.payload.message}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0 self-center">
        {isUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title="Mark as read"
            onClick={handleMarkRead}
            disabled={isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        {destinationLink && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );

  return (
    <div className="border-b last:border-b-0">
      {destinationLink ? (
        <Link href={destinationLink as unknown as "/appointments"} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
