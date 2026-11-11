import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/db/generated/prisma/client";
import { Clock, CheckCircle, XCircle, AlertCircle, CalendarCheck } from "lucide-react";

interface StatusBadgeProps {
  status: AppointmentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "PENDING":
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10">
          <Clock className="h-3 w-3 mr-1" />
          Pending Confirmation
        </Badge>
      );
    case "CONFIRMED":
      return (
        <Badge variant="success">
          <CheckCircle className="h-3 w-3 mr-1" />
          Confirmed
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge variant="secondary">
          <CalendarCheck className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    case "NO_SHOW":
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          No Show
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
