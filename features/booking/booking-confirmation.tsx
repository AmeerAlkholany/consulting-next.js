"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BookingSummary } from "@/features/booking/booking-summary";
import { NoteField } from "@/features/booking/note-field";
import { PolicyNotice } from "@/features/booking/policy-notice";
import { bookAppointmentAction } from "@/features/booking/actions";
import { initialAuthFormState, type AuthFormState } from "@/features/auth/form-state";
import { AlertCircle, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface BookingConfirmationProps {
  consultantProfileId: string;
  consultantSlug: string;
  consultantName: string;
  consultantHeadline: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  consultationTypes: Array<"ONLINE" | "IN_PERSON">;
  cancellationWindowHours: number;
  autoConfirm: boolean;
  consultantTimezone: string;
  viewerTimezone: string;
}

export function BookingConfirmation({
  consultantProfileId,
  consultantSlug,
  consultantName,
  consultantHeadline,
  startsAt,
  endsAt,
  durationMinutes,
  priceMinor,
  currency,
  consultationTypes,
  cancellationWindowHours,
  autoConfirm,
  consultantTimezone,
  viewerTimezone,
}: BookingConfirmationProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AuthFormState>(initialAuthFormState);
  const [consultationType, setConsultationType] = useState<"ONLINE" | "IN_PERSON">(
    consultationTypes[0] ?? "ONLINE",
  );
  const [clientNote, setClientNote] = useState<string>("");

  const isSlotTaken = state.message?.includes("SLOT_TAKEN");
  const isDoubleBooked = state.message?.includes("CLIENT_DOUBLE_BOOKED");

  const handleConfirm = () => {
    setState(initialAuthFormState);

    // Generate unique idempotency key
    const idempotencyKey = `${consultantProfileId}-${startsAt}-${Date.now()}`;

    const formData = new FormData();
    formData.set("consultantProfileId", consultantProfileId);
    formData.set("startsAt", startsAt);
    formData.set("endsAt", endsAt);
    formData.set("consultationType", consultationType);
    if (clientNote.trim()) formData.set("clientNote", clientNote.trim());
    formData.set("idempotencyKey", idempotencyKey);

    startTransition(async () => {
      const result = await bookAppointmentAction(initialAuthFormState, formData);
      setState(result);
      if (result.status === "success") {
        router.push("/appointments");
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/consultants/${consultantSlug}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Profile
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Confirm Your Appointment
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review session details and policies before confirming your booking.
        </p>
      </div>

      {state.status === "error" && state.message && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">{state.message}</p>
              {isSlotTaken && (
                <div className="pt-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/consultants/${consultantSlug}#availability`}>
                      Choose Another Slot
                    </Link>
                  </Button>
                </div>
              )}
              {isDoubleBooked && (
                <div className="pt-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/appointments">View My Appointments</Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {state.status === "success" && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
            <p className="text-sm font-medium text-success">{state.message}</p>
          </CardContent>
        </Card>
      )}

      <BookingSummary
        consultantName={consultantName}
        consultantHeadline={consultantHeadline}
        startsAt={startsAt}
        endsAt={endsAt}
        consultationType={consultationType}
        durationMinutes={durationMinutes}
        priceMinor={priceMinor}
        currency={currency}
        viewerTimezone={viewerTimezone}
        consultantTimezone={consultantTimezone}
      />

      {consultationTypes.length > 1 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Session Format</Label>
          <div className="grid grid-cols-2 gap-3">
            {consultationTypes.includes("ONLINE") && (
              <Button
                type="button"
                variant={consultationType === "ONLINE" ? "default" : "outline"}
                className="w-full justify-center"
                onClick={() => setConsultationType("ONLINE")}
                disabled={isPending}
              >
                Online Video
              </Button>
            )}
            {consultationTypes.includes("IN_PERSON") && (
              <Button
                type="button"
                variant={consultationType === "IN_PERSON" ? "default" : "outline"}
                className="w-full justify-center"
                onClick={() => setConsultationType("IN_PERSON")}
                disabled={isPending}
              >
                In Person
              </Button>
            )}
          </div>
        </div>
      )}

      <NoteField value={clientNote} onChange={setClientNote} disabled={isPending} />

      <PolicyNotice cancellationWindowHours={cancellationWindowHours} autoConfirm={autoConfirm} />

      <div className="pt-4 flex items-center justify-between gap-4">
        <Button variant="outline" asChild disabled={isPending}>
          <Link href={`/consultants/${consultantSlug}`}>Cancel</Link>
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isPending || isSlotTaken}
          className="min-w-[160px]"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Confirming...
            </span>
          ) : autoConfirm ? (
            "Confirm & Book"
          ) : (
            "Request Booking"
          )}
        </Button>
      </div>
    </div>
  );
}
