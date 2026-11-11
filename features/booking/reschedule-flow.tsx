"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { rescheduleAppointmentAction } from "@/features/booking/actions";
import { initialAuthFormState, type AuthFormState } from "@/features/auth/form-state";
import { Calendar, Clock, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

interface Slot {
  startsAt: string;
  endsAt: string;
}

interface DaySlots {
  date: string;
  slots: Slot[];
}

interface RescheduleFlowProps {
  appointmentId: string;
  consultantSlug: string;
  consultantName: string;
  currentStartsAt: string;
  currentEndsAt?: string;
  consultantTimezone?: string;
  viewerTimezone: string;
}

export function RescheduleFlow({
  appointmentId,
  consultantSlug,
  consultantName,
  currentStartsAt,
  currentEndsAt: _currentEndsAt,
  consultantTimezone: _consultantTimezone,
  viewerTimezone,
}: RescheduleFlowProps) {
  const router = useRouter();
  const [days, setDays] = useState<DaySlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AuthFormState>(initialAuthFormState);

  useEffect(() => {
    async function loadAvailability() {
      setLoading(true);
      setFetchError(null);
      try {
        const from = new Date().toISOString().split("T")[0];
        const toDate = new Date();
        toDate.setDate(toDate.getDate() + 21);
        const to = toDate.toISOString().split("T")[0];

        const params = new URLSearchParams({ from, to, tz: viewerTimezone });
        const res = await fetch(
          `/api/consultants/${consultantSlug}/availability?${params.toString()}`,
        );
        if (!res.ok) {
          setFetchError("Unable to load available slots for rescheduling.");
          return;
        }
        const json = await res.json();
        setDays(json.data?.days ?? []);
      } catch {
        setFetchError("Network error loading availability.");
      } finally {
        setLoading(false);
      }
    }

    loadAvailability();
  }, [consultantSlug, viewerTimezone]);

  function formatDateTime(isoString: string): string {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: viewerTimezone,
    }).format(d);
  }

  function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: viewerTimezone,
    }).format(d);
  }

  const handleReschedule = () => {
    if (!selectedSlot) return;
    setState(initialAuthFormState);

    const formData = new FormData();
    formData.set("appointmentId", appointmentId);
    formData.set("startsAt", selectedSlot.startsAt);
    formData.set("endsAt", selectedSlot.endsAt);

    startTransition(async () => {
      const result = await rescheduleAppointmentAction(initialAuthFormState, formData);
      setState(result);
      if (result.status === "success") {
        router.push("/appointments");
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Reschedule Appointment
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a new time slot with {consultantName}. Your previous slot will be released upon
          confirmation.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Current Appointment
          </CardTitle>
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span>{formatDateTime(currentStartsAt)}</span>
            <span className="text-xs text-muted-foreground font-normal">({viewerTimezone})</span>
          </div>
        </CardHeader>
      </Card>

      {state.status === "error" && state.message && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{state.message}</p>
        </div>
      )}

      {selectedSlot && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Proposed New Time
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm line-through text-muted-foreground">
                  {formatDateTime(currentStartsAt)}
                </span>
                <ArrowRight className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {formatDateTime(selectedSlot.startsAt)}
                </span>
              </div>
            </div>
            <Button onClick={handleReschedule} disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rescheduling...
                </span>
              ) : (
                "Confirm Reschedule"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select a New Slot</CardTitle>
          <CardDescription>
            Showing available hours in your local timezone ({viewerTimezone}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fetchError ? (
            <div className="flex items-center gap-2 py-6 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p>{fetchError}</p>
            </div>
          ) : days.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No available slots found in the next 3 weeks.
            </p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {days.map((day) => (
                <div key={day.date} className="p-3 border rounded-md">
                  <div className="flex items-center gap-1.5 text-sm font-semibold mb-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{day.date}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {day.slots.map((slot, idx) => {
                      const isSelected = selectedSlot?.startsAt === slot.startsAt;
                      return (
                        <Button
                          key={idx}
                          type="button"
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          className="font-mono text-xs"
                          onClick={() => setSelectedSlot(slot)}
                          disabled={isPending}
                        >
                          {formatTime(slot.startsAt)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" asChild>
          <Link href="/appointments">Back to Appointments</Link>
        </Button>
      </div>
    </div>
  );
}
