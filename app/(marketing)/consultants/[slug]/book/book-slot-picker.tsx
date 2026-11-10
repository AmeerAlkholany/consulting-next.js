"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, Loader2, AlertCircle } from "lucide-react";
import { bookAppointmentAction } from "@/features/booking/actions";
import { initialAuthFormState } from "@/features/auth/form-state";

interface Slot {
  startsAt: string;
  endsAt: string;
}

interface DaySlots {
  date: string;
  slots: Slot[];
}

interface AvailabilityData {
  timezone: string;
  viewerTimezone: string;
  days: DaySlots[];
}

interface BookSlotPickerProps {
  slug: string;
  consultantName: string;
  defaultFrom: string;
  defaultTo: string;
  defaultTz: string;
}

export default function BookSlotPicker({
  slug,
  consultantName,
  defaultFrom,
  defaultTo,
  defaultTz,
}: BookSlotPickerProps) {
  const router = useRouter();
  const [data, setData] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [consultationType, setConsultationType] = useState<"ONLINE" | "IN_PERSON">("ONLINE");
  const [clientNote, setClientNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(
    null,
  );

  // The server cannot know the visitor's zone (`Intl` there reports the server's),
  // so resolve it here and let the API bucket slots by the viewer's local date.
  const viewerTimezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : defaultTz;

  useEffect(() => {
    async function fetchAvailability() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          from: defaultFrom,
          to: defaultTo,
          tz: viewerTimezone,
        });
        const res = await fetch(`/api/consultants/${slug}/availability?${params.toString()}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("This consultant is not available for bookings.");
          } else {
            setError("Failed to load availability.");
          }
          return;
        }
        const json = await res.json();
        setData(json.data);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchAvailability();
  }, [slug, defaultFrom, defaultTo, viewerTimezone]);

  async function handleBook() {
    if (!selectedSlot || !data) return;

    setSubmitting(true);
    setSubmitResult(null);

    const idempotencyKey = `${slug}-${selectedSlot.startsAt}-${Date.now()}`;

    const formData = new FormData();
    // Use empty string for consultantProfileId - server will resolve from slug
    formData.set("consultantProfileId", "");
    formData.set("startsAt", selectedSlot.startsAt);
    formData.set("endsAt", selectedSlot.endsAt);
    formData.set("consultationType", consultationType);
    formData.set("clientNote", clientNote || "");
    formData.set("idempotencyKey", idempotencyKey);

    try {
      const result = await bookAppointmentAction(initialAuthFormState, formData);
      if (result.status === "error") {
        setSubmitResult({ success: false, message: result.message ?? "An error occurred" });
      } else {
        setSubmitResult({ success: true, message: result.message ?? "Success" });
        router.replace("/appointments");
      }
    } catch {
      setSubmitResult({ success: false, message: "An error occurred. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function formatSlotTime(isoString: string): string {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: data?.viewerTimezone ?? defaultTz,
    }).format(date);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.days.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CalendarIcon className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No available slots</p>
          <p className="text-muted-foreground text-center max-w-md">
            {consultantName} doesn&apos;t have any available slots in the selected range. Try
            adjusting the dates.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Select a Time Slot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.days.map((day) => (
              <div key={day.date} className="space-y-2">
                <p className="text-sm font-medium">{day.date}</p>
                <div className="flex flex-wrap gap-2">
                  {day.slots.map((slot) => (
                    <Button
                      key={slot.startsAt}
                      variant={selectedSlot?.startsAt === slot.startsAt ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSlot(slot)}
                      className="font-mono text-xs"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {formatSlotTime(slot.startsAt)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedSlot && (
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{selectedSlot.startsAt.split("T")[0]}</span>
              <Clock className="h-4 w-4 text-muted-foreground ml-2" />
              <span className="text-sm">
                {formatSlotTime(selectedSlot.startsAt)} &mdash;{" "}
                {formatSlotTime(selectedSlot.endsAt)}
              </span>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="consultationType"
                  value="ONLINE"
                  checked={consultationType === "ONLINE"}
                  onChange={() => setConsultationType("ONLINE")}
                />
                <span className="text-sm">Online</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="consultationType"
                  value="IN_PERSON"
                  checked={consultationType === "IN_PERSON"}
                  onChange={() => setConsultationType("IN_PERSON")}
                />
                <span className="text-sm">In-Person</span>
              </label>
            </div>
            <input type="hidden" name="consultationType" value={consultationType} />

            <div className="flex flex-col gap-2">
              <label htmlFor="clientNote" className="text-sm font-medium">
                Note (optional)
              </label>
              <textarea
                id="clientNote"
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                placeholder="Anything you would like the consultant to know..."
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={1000}
              />
            </div>

            {submitResult && (
              <div
                className={`rounded-md p-3 text-sm ${submitResult.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
              >
                {submitResult.message}
              </div>
            )}

            <Button onClick={handleBook} disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                "Confirm Booking"
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
