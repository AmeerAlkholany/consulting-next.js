import { Container } from "@/components/layout/container";
import { getSession } from "@/server/auth/dal";
import { ResendVerificationForm } from "./resend-verification-form";

/**
 * The verification banner (IMPLEMENTATION.md Step 4, "UI changes").
 *
 * Unverified accounts may browse and manage their profile but cannot book or be
 * booked (§9 registration step 6), so the state is stated plainly on every page
 * the person visits rather than discovered at the moment a booking is refused.
 *
 * This is a Server Component: it reads the session through the cached DAL, so it
 * costs nothing extra on a page that already knows who is signed in. The layout
 * renders it inside `<Suspense>`, so the shell streams while this resolves.
 */
async function VerificationBanner() {
  const session = await getSession();

  if (!session || session.user.emailVerifiedAt !== null) {
    return null;
  }

  return (
    <div className="border-b border-warning/40 bg-warning/10">
      <Container className="flex flex-wrap items-center justify-between gap-4 py-3">
        <p className="max-w-measure text-sm text-foreground">
          <span className="font-medium">Verify your email address.</span> We sent a link to{" "}
          <span className="font-medium">{session.user.email}</span>. You can browse and set up your
          profile now, but booking stays unavailable until the address is verified.
        </p>
        <ResendVerificationForm />
      </Container>
    </div>
  );
}

export { VerificationBanner };
