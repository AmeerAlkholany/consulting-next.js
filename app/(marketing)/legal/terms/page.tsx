import { Container } from "@/components/layout/container";

export const metadata = {
  title: "Terms of Service",
  description: "Platform terms of service, cancellation policies, and professional conduct requirements.",
};

export default function TermsPage() {
  return (
    <Container className="py-16 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Effective Date: November 2026</p>

      <div className="prose prose-slate dark:prose-invert space-y-6 text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. Crisis Disclaimer (Not an Emergency Service)</h2>
          <p className="text-sm leading-relaxed">
            This platform facilitates scheduled appointments with licensed psychological consultants. 
            It is not an emergency hotline, crisis center, or hospital facility. If you are experiencing acute distress 
            or thinking about self-harm, please visit our <a href="/crisis-resources" className="text-primary underline">Crisis Resources</a> page 
            or contact your local emergency response service immediately.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. Booking, Cancellation &amp; Rescheduling (BR-8)</h2>
          <p className="text-sm leading-relaxed">
            Consultations can be cancelled or rescheduled up to the consultant&apos;s specified cancellation window 
            (typically 24 hours prior to session start). Inside this window, client cancellations are locked to prevent provider loss.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. Professional Verification (BR-2, BR-3)</h2>
          <p className="text-sm leading-relaxed">
            Consultants must undergo manual administrator verification of their credentials, licenses, and background 
            prior to publishing availability or accepting bookings on the platform.
          </p>
        </section>
      </div>
    </Container>
  );
}
