"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-field";
import { verifyEmailAction } from "./actions";
import { initialAuthFormState } from "./form-state";

/**
 * Confirming an email address (IMPLEMENTATION.md Step 4, "UI changes").
 *
 * Opening the link never spends the token: a page that verified on GET could be
 * triggered by a mail scanner or a prefetch, and the person would find a "link
 * already used" message they never caused. The token is consumed by this POST,
 * which is an explicit action.
 */

export interface VerifyEmailFormProps {
  token: string;
  expiresAt: Date;
}

function VerifyEmailForm({ token, expiresAt }: VerifyEmailFormProps) {
  const [state, dispatch, pending] = React.useActionState(verifyEmailAction, initialAuthFormState);
  const expiresAtFormatted = expiresAt.toLocaleString();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    React.startTransition(() => {
      dispatch(formData);
    });
  }

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage tone="success">{state.message}</FormMessage>
        <p className="text-sm text-muted-foreground">
          You can now book sessions, or receive bookings once your consultant profile is approved.
        </p>
        <Button asChild>
          <Link href="/">Continue</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} readOnly />

      <FormMessage tone="error">{state.status === "error" ? state.message : null}</FormMessage>

      <p className="text-sm text-muted-foreground">
        This link expires on <time dateTime={expiresAt.toISOString()}>{expiresAtFormatted}</time>.
      </p>

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Confirming…" : "Confirm my email address"}
      </Button>
    </form>
  );
}

export { VerifyEmailForm };
