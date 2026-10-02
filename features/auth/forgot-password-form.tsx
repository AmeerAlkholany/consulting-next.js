"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestResetSchema } from "@/schemas/auth";
import { requestPasswordResetAction } from "./actions";
import { initialAuthFormState } from "./form-state";

/**
 * Starting a password reset (IMPLEMENTATION.md Step 4, "UI changes").
 *
 * The confirmation is deliberately vague — "if that address can be registered…"
 * — because a specific answer would tell a stranger which addresses have
 * accounts. The server returns that same sentence whether or not the address
 * exists.
 */

function ForgotPasswordForm() {
  const [state, dispatch, pending] = React.useActionState(
    requestPasswordResetAction,
    initialAuthFormState,
  );
  const {
    register,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(requestResetSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!(await trigger())) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    React.startTransition(() => {
      dispatch(formData);
    });
  }

  const emailError = state.fieldErrors.email?.[0] ?? errors.email?.message;

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage tone="success">{state.message}</FormMessage>
        <p className="text-sm text-muted-foreground">
          The link expires in one hour. If it has expired, request another one from this page.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormMessage tone="error">{state.status === "error" ? state.message : null}</FormMessage>

      <FormField
        id="email"
        label="Email address"
        hint="Use the address you registered with."
        error={emailError}
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-error" : "email-hint"}
          {...register("email")}
        />
      </FormField>

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export { ForgotPasswordForm };
