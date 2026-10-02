import type { Metadata } from "next";
import { VerifyEmailForm } from "@/features/auth/verify-email-form";
import { inspectAuthToken } from "@/server/services/auth";
import { tokenParamSchema } from "@/schemas/auth";
import { notFound } from "next/navigation";

interface VerifyEmailPageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Verify email address",
};

export default async function VerifyEmailPage({ params }: VerifyEmailPageProps) {
  const { token } = await params;

  const parsed = tokenParamSchema.safeParse(token);
  if (!parsed.success) {
    notFound();
  }

  const outcome = await inspectAuthToken(parsed.data, "EMAIL_VERIFICATION");

  if (outcome.status === "invalid") {
    notFound();
  }

  return <VerifyEmailForm token={token} expiresAt={outcome.expiresAt} />;
}