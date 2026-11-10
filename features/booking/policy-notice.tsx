import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Info } from "lucide-react";

interface PolicyNoticeProps {
  cancellationWindowHours?: number;
  autoConfirm?: boolean;
}

export function PolicyNotice({
  cancellationWindowHours = 24,
  autoConfirm = false,
}: PolicyNoticeProps) {
  return (
    <Card className="bg-muted/40 border-muted">
      <CardContent className="p-4 space-y-3 text-sm">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-foreground">Cancellation Policy: </span>
            <span className="text-muted-foreground">
              You can cancel or reschedule freely up to {cancellationWindowHours} hours before the session starts.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-muted-foreground">
            {autoConfirm ? (
              <span>
                <strong className="text-foreground">Instant Confirmation: </strong>
                This consultant accepts bookings automatically. Your session will be confirmed immediately.
              </span>
            ) : (
              <span>
                <strong className="text-foreground">Booking Request: </strong>
                Your request will be submitted for the consultant to review and confirm.
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

