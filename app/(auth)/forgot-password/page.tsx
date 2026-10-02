import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { getSession } from "@/server/auth/dal";
import { SIGNED_IN_LANDING_PATH } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default async function ForgotPasswordPage() {
  const session = await getSession();

  // Signed-in users visiting /forgot-password are redirected to their dashboard
  if (session) {
    redirect(SIGNED_IN_LANDING_PATH);
  }

  return <ForgotPasswordForm />;
}