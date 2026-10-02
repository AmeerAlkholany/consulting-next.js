"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assessPasswordStrength, describePasswordRequirements } from "@/lib/password-strength";
import { resetPasswordSchema } from "@/schemas/auth";
import { resetPasswordAction } from "./actions";
import { initialAuthFormState } from "./form-state";

/**
 * The reset form behind `/reset-password/[token]`
 * (IMPLEMENTATION.md Step 4, "UI changes").
 *
 * The token travels in a hidden field rather than the URL of the POST: the link
 * has already been consumed by the time anyone could read a query string out of
 * a referrer, and Server Actions are POST-only.
 */

export interface ResetPasswordFormProps {
  token: string;
}

function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, dispatch, pending] = React.useActionState(resetPasswordAction, initialAuthFormState);
  const {
    register,
    trigger,
    watch,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<any>({
    // @ts-expect-error Zod v4 schema shape incompatibility with @hookform/resolvers
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const passwordValue = watch("password") ?? "";
  const strength = assessPasswordStrength(passwordValue);

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

  const passwordError = state.fieldErrors.password?.[0] ?? errors.password?.message;
  const confirmError = state.fieldErrors.confirmPassword?.[0] ?? errors.confirmPassword?.message;

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage tone="success">{state.message}</FormMessage>
        <p className="text-sm text-muted-foreground">
          Every device that was signed in to your account has been signed out.
        </p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {/* The token is carried with the submission; it is never rendered as text. */}
      <input type="hidden" {...register("token")} />

      <FormMessage tone="error">{state.status === "error" ? state.message : null}</FormMessage>

      <FormField
        id="password"
        label="New password"
        hint={describePasswordRequirements()}
        error={passwordError}
      >
        <>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? "password-error" : "password-hint"}
            {...register("password")}
          />
          {watch("password") ? (
            <p className="text-sm text-muted-foreground">
              Password strength: <span className="font-medium text-foreground">{strength.label}</span>
              {strength.missing.length > 0 ? ` — ${strength.missing[0]}` : null}
            </p>
          ) : null}
        </>
      </FormField>

      <FormField id="confirmPassword" label="Repeat new password" error={confirmError}>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(confirmError)}
          aria-describedby={confirmError ? "confirmPassword-error" : undefined}
          {...register("confirmPassword")}
        />
      </FormField>

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}

export { ResetPasswordForm };
