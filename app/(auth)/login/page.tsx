import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { getSession } from "@/server/auth/dal";
import { SIGNED_IN_LANDING_PATH } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await getSession();

  // Signed-in users visiting /login are redirected to their dashboard
  if (session) {
    redirect(SIGNED_IN_LANDING_PATH);
  }

  return <LoginForm />;
}