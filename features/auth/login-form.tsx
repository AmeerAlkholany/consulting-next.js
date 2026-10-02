"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/schemas/auth";
import { loginAction } from "./actions";
import { initialAuthFormState } from "./form-state";

/**
 * The sign-in form (IMPLEMENTATION.md Step 4, "UI changes").
 *
 * Validation runs twice on purpose: `zodResolver` gives immediate, field-level
 * feedback in the browser, and the action re-parses the same schema on the
 * server, where its result is authoritative. The two can never disagree,
 * because there is one schema.
 */

export interface LoginFormProps {
  /** A validated same-origin path to return to once signed in. */
  nextPath?: string;
}

function LoginForm({ nextPath }: LoginFormProps) {
  const [state, dispatch, pending] = React.useActionState(loginAction, initialAuthFormState);
  const {
    register,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  function fieldError(field: keyof LoginInput): string | undefined {
    return state.fieldErrors[field]?.[0] ?? errors[field]?.message;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!(await trigger())) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    if (nextPath) {
      formData.set("next", nextPath);
    }

    React.startTransition(() => {
      dispatch(formData);
    });
  }

  const emailError = fieldError("email");
  const passwordError = fieldError("password");

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormMessage tone="error">{state.status === "error" ? state.message : null}</FormMessage>

      <FormField id="email" label="Email address" error={emailError}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-error" : undefined}
          {...register("email")}
        />
      </FormField>

      <FormField id="password" label="Password" error={passwordError}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(passwordError)}
          aria-describedby={passwordError ? "password-error" : undefined}
          {...register("password")}
        />
      </FormField>

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-sm text-muted-foreground">
        <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}

export { LoginForm };
