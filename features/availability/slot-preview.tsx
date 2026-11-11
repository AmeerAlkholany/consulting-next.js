"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";

export interface PreviewSlot {
  startsAt: string;
  endsAt: string;
}

export interface PreviewDay {
  date: string;
  slots: PreviewSlot[];
}

interface SlotPreviewProps {
  timezone: string;
  days: PreviewDay[];
}

export function SlotPreview({ timezone, days }: SlotPreviewProps) {
  const totalSlots = days.reduce((acc, day) => acc + day.slots.length, 0);

  function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    }).format(d);
  }

  function formatDayHeading(dateStr: string): string {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>Live Slot Preview (Next 14 Days)</CardTitle>
          <CardDescription>
            Calculated bookable slots in your local timezone ({timezone}).
          </CardDescription>
        </div>
        <Badge variant={totalSlots > 0 ? "success" : "secondary"}>
          {totalSlots} bookable {totalSlots === 1 ? "slot" : "slots"}
        </Badge>
      </CardHeader>
      <CardContent>
        {days.length === 0 || totalSlots === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No bookable slots found</p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Add active weekly availability rules or extra date hours. Verify that your rules
              don&apos;t fall entirely within your minimum lead time.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {days.map((day) => (
              <div key={day.date} className="p-3 border rounded-md bg-card/60">
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-border/40">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{formatDayHeading(day.date)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {day.slots.length} {day.slots.length === 1 ? "slot" : "slots"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {day.slots.map((slot, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-mono font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      {formatTime(slot.startsAt)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
