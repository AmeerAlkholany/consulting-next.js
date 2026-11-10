import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { Calendar, Clock, Video, MapPin, User, Globe } from "lucide-react";

interface BookingSummaryProps {
  consultantName: string;
  consultantHeadline: string;
  startsAt: string;
  endsAt: string;
  consultationType: "ONLINE" | "IN_PERSON";
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  viewerTimezone: string;
  consultantTimezone: string;
}

export function BookingSummary({
  consultantName,
  consultantHeadline,
  startsAt,
  endsAt,
  consultationType,
  durationMinutes,
  priceMinor,
  currency,
  viewerTimezone,
  consultantTimezone,
}: BookingSummaryProps) {
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: viewerTimezone,
  }).format(startDate);

  const formattedViewerTime = `${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: viewerTimezone,
  }).format(startDate)} – ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: viewerTimezone,
  }).format(endDate)}`;

  const isDifferentTimezone = viewerTimezone !== consultantTimezone;

  const formattedConsultantTime = isDifferentTimezone
    ? `${new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: consultantTimezone,
      }).format(startDate)} – ${new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: consultantTimezone,
      }).format(endDate)}`
    : null;

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg">{consultantName}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{consultantHeadline}</p>
          </div>
          <Badge variant={consultationType === "ONLINE" ? "default" : "secondary"}>
            {consultationType === "ONLINE" ? (
              <span className="flex items-center gap-1">
                <Video className="h-3 w-3" /> Online Video
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> In Person
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-foreground">{formattedDate}</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div>
            <span className="font-medium text-foreground">{formattedViewerTime}</span>
            <span className="text-xs text-muted-foreground ml-1.5">({viewerTimezone})</span>
          </div>
        </div>

        {isDifferentTimezone && formattedConsultantTime && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Globe className="h-4 w-4 flex-shrink-0" />
            <span>
              Consultant local time: {formattedConsultantTime} ({consultantTimezone})
            </span>
          </div>
        )}

        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Session Duration:</span>
          <span className="font-medium">{durationMinutes} minutes</span>
        </div>

        <div className="flex items-center justify-between text-base font-semibold pt-1">
          <span>Total Fee:</span>
          <span className="text-primary font-mono">{formatMoney(priceMinor, currency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

