import { Container } from "@/components/layout/container";

export const metadata = {
  title: "Privacy Policy",
  description: "Platform privacy policy and clinical data confidentiality standards.",
};

export default function PrivacyPage() {
  return (
    <Container className="py-16 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Effective Date: November 2026</p>

      <div className="prose prose-slate dark:prose-invert space-y-6 text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">
            1. Clinical Notes Confidentiality (BR-10, BR-11)
          </h2>
          <p className="text-sm leading-relaxed">
            Clinical private notes created by consultants are encrypted at rest using AES-256-GCM.
            These notes are cryptographically partitioned and accessible strictly by the authoring
            consultant. Platform administrators and database operators have zero access to the
            plaintext content of clinical notes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. Account &amp; Booking Information</h2>
          <p className="text-sm leading-relaxed">
            We store client profiles, consultant verification records, appointment timestamps, and
            communication outboxes solely to facilitate mental health consultations and secure
            scheduling.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. Anonymized Public Reviews (BR-9)</h2>
          <p className="text-sm leading-relaxed">
            Reviews left by clients following completed consultations are displayed with abbreviated
            initials (e.g., &quot;Jane D.&quot;) to protect client identity while maintaining
            platform transparency.
          </p>
        </section>
      </div>
    </Container>
  );
}
