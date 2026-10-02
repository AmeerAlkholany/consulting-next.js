"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-field";
import { resendVerificationAction } from "./actions";
import { initialAuthFormState } from "./form-state";

/**
 * The resend control inside the verification banner (IMPLEMENTATION.md Step 4,
 * "UI changes": "an unverified account… banner with a resend action").
 */
function ResendVerificationForm() {
  const [state, dispatch, pending] = React.useActionState(
    resendVerificationAction,
    initialAuthFormState,
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    React.startTransition(() => {
      dispatch(new FormData());
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-start gap-2">
      <Button type="submit" variant="outline" size="sm" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Resend verification link"}
      </Button>
      {state.message ? (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>{state.message}</FormMessage>
      ) : null}
    </form>
  );
}

export { ResendVerificationForm };
