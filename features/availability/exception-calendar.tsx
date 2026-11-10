"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  upsertAvailabilityExceptionAction,
  deleteAvailabilityExceptionAction,
} from "@/features/availability/actions";
import { initialAuthFormState, type AuthFormState } from "@/features/auth/form-state";
import { Trash2, Plus, CalendarOff, AlertCircle, Clock } from "lucide-react";

export interface SerializedAvailabilityException {
  id: string;
  date: string;
  type: "BLOCK" | "EXTRA";
  startMinute: number | null;
  endMinute: number | null;
  reason: string | null;
}

interface ExceptionCalendarProps {
  exceptions: SerializedAvailabilityException[];
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function ExceptionCalendar({ exceptions }: ExceptionCalendarProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AuthFormState>(initialAuthFormState);
  const [actionError, setActionError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState<string>(todayStr);
  const [type, setType] = useState<"BLOCK" | "EXTRA">("BLOCK");
  const [isAllDay, setIsAllDay] = useState<boolean>(true);
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("17:00");
  const [reason, setReason] = useState<string>("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState(initialAuthFormState);

    const formData = new FormData();
    formData.set("date", date);
    formData.set("type", type);
    if (reason) formData.set("reason", reason);

    if (type === "EXTRA" || !isAllDay) {
      const startMinute = timeToMinutes(startTime);
      const endMinute = timeToMinutes(endTime);

      if (startMinute >= endMinute) {
        setState({
          status: "error",
          message: "End time must be after start time.",
          fieldErrors: { endMinute: ["End time must be after start time."] },
        });
        return;
      }

      formData.set("startMinute", String(startMinute));
      formData.set("endMinute", String(endMinute));
    }

    startTransition(async () => {
      const result = await upsertAvailabilityExceptionAction(initialAuthFormState, formData);
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        setReason("");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to remove this date exception?")) return;
    setActionError(null);

    const formData = new FormData();
    formData.set("id", id);

    startTransition(async () => {
      const result = await deleteAvailabilityExceptionAction(initialAuthFormState, formData);
      if (result.status === "error") {
        setActionError(result.message);
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle>Date Exceptions &amp; Overrides</CardTitle>
          <CardDescription>
            Block time off (vacations, holidays) or offer extra hours on specific dates.
          </CardDescription>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Exception
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Date Exception</DialogTitle>
              <DialogDescription>
                Override your standard weekly availability for a specific calendar date.
              </DialogDescription>
            </DialogHeader>

            {state.status === "error" && state.message && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{state.message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exceptionDate">Date</Label>
                <Input
                  id="exceptionDate"
                  type="date"
                  min={todayStr}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Type of Override</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={type === "BLOCK" ? "default" : "outline"}
                    className="w-full justify-center"
                    onClick={() => {
                      setType("BLOCK");
                      setIsAllDay(true);
                    }}
                  >
                    Block Time (Unavailable)
                  </Button>
                  <Button
                    type="button"
                    variant={type === "EXTRA" ? "default" : "outline"}
                    className="w-full justify-center"
                    onClick={() => {
                      setType("EXTRA");
                      setIsAllDay(false);
                    }}
                  >
                    Extra Hours (Available)
                  </Button>
                </div>
              </div>

              {type === "BLOCK" && (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="allDay"
                    checked={isAllDay}
                    onCheckedChange={(checked) => setIsAllDay(Boolean(checked))}
                  />
                  <Label htmlFor="allDay" className="text-sm font-normal cursor-pointer">
                    Block entire day
                  </Label>
                </div>
              )}

              {(type === "EXTRA" || !isAllDay) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="excStartTime">Start Time</Label>
                    <Input
                      id="excStartTime"
                      type="time"
                      step="300"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="excEndTime">End Time</Label>
                    <Input
                      id="excEndTime"
                      type="time"
                      step="300"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Input
                  id="reason"
                  placeholder="e.g. Doctor's appointment, public holiday"
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Exception"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {actionError && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{actionError}</p>
          </div>
        )}

        {exceptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
            <CalendarOff className="h-9 w-9 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No date exceptions scheduled</p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Add an exception to block specific days or open up extra consultation slots.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {exceptions.map((exc) => (
              <div
                key={exc.id}
                className="flex items-center justify-between p-3 rounded-md border bg-card text-sm"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={exc.type === "BLOCK" ? "destructive" : "success"}>
                    {exc.type === "BLOCK" ? "Blocked" : "Extra Hours"}
                  </Badge>

                  <span className="font-medium font-mono">
                    {exc.date.split("T")[0]}
                  </span>

                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {exc.startMinute != null && exc.endMinute != null
                      ? `${minutesToTime(exc.startMinute)} – ${minutesToTime(exc.endMinute)}`
                      : "Entire Day"}
                  </span>

                  {exc.reason && (
                    <span className="text-xs text-muted-foreground italic">
                      ({exc.reason})
                    </span>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(exc.id)}
                  disabled={isPending}
                  aria-label="Delete exception"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

