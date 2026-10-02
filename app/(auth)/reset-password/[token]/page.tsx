import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { inspectAuthToken } from "@/server/services/auth";
import { tokenParamSchema } from "@/schemas/auth";
import { notFound } from "next/navigation";

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Reset password",
};

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;

  const parsed = tokenParamSchema.safeParse(token);
  if (!parsed.success) {
    notFound();
  }

  const outcome = await inspectAuthToken(parsed.data, "PASSWORD_RESET");

  if (outcome.status === "invalid") {
    notFound();
  }

  return <ResetPasswordForm token={token} />;
}