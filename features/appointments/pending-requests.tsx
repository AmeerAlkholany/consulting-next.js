import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, ChevronRight, AlertCircle } from "lucide-react";
import type { ConsultantAppointmentRow } from "@/server/dal/appointment";

interface PendingRequestsProps {
  requests: ConsultantAppointmentRow[];
}

export function PendingRequests({ requests }: PendingRequestsProps) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Booking Requests Requiring Response ({requests.length})
          </CardTitle>
          <Button variant="link" size="sm" asChild className="text-xs p-0 h-auto">
            <Link href="/consultant/appointments?tab=needs_response">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {requests.slice(0, 3).map((req) => {
          const startsAt = new Date(req.startsAt);
          const endsAt = new Date(req.endsAt);

          return (
            <div
              key={req.id}
              className="flex items-center justify-between p-3 rounded-md bg-background border text-sm"
            >
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {req.clientDisplayName}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {format(startsAt, "MMM d, h:mm a")} – {format(endsAt, "h:mm a")} ({req.consultantTimezone})
                  </span>
                </div>
              </div>
              <Button size="sm" asChild className="gap-1 text-xs">
                <Link href={`/consultant/appointments/${req.id}`}>
                  Review
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
