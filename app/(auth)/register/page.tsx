import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/features/auth/register-form";
import { getSession } from "@/server/auth/dal";
import { SIGNED_IN_LANDING_PATH } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Create an account",
};

export default async function RegisterPage() {
  const session = await getSession();

  // Signed-in users visiting /register are redirected to their dashboard
  if (session) {
    redirect(SIGNED_IN_LANDING_PATH);
  }

  return <RegisterForm />;
}