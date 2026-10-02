"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessPasswordStrength, describePasswordRequirements } from "@/lib/password-strength";
import { registerSchema, type RegisterInput } from "@/schemas/auth";
import { registerAction } from "./actions";
import { initialAuthFormState } from "./form-state";
import { RoleChoice } from "./role-choice";

/**
 * The registration form (IMPLEMENTATION.md Step 4, "UI changes").
 *
 * Four things it must do beyond collecting values: make the role a deliberate
 * choice, show what a password still lacks before it is submitted, keep the
 * browser's IANA timezone so every later instant can be displayed in the
 * person's own zone (§19, BR-15), and stay truthful when the server cannot
 * create the account (a duplicate address is answered generically).
 */

function RegisterForm() {
  const [state, dispatch, pending] = React.useActionState(registerAction, initialAuthFormState);
  const {
    register,
    control,
    trigger,
    watch,
    setValue,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<any>({
    // @ts-expect-error Zod v4 schema shape incompatibility with @hookform/resolvers
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: undefined,
      acceptTerms: false,
      timezone: "",
    },
  });

  const role = watch("role");
  const accepted = watch("acceptTerms");
  const passwordValue = watch("password") ?? "";
  const passwordStrength = assessPasswordStrength(passwordValue);

  // The zone is captured in the browser: the server cannot know it, and a
  // person's own zone is what every time in the product is rendered in.
  React.useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (zone) {
      setValue("timezone", zone);
    }
  }, [setValue]);

  function fieldError(field: keyof RegisterInput): string | undefined {
    return state.fieldErrors[field]?.[0] ?? errors[field]?.message;
  }

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

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage tone="success">{state.message}</FormMessage>
        <p className="text-sm text-muted-foreground">
          If you already had an account, sign in or reset your password from the sign-in page.
        </p>
      </div>
    );
  }

  const nameError = fieldError("fullName");
  const emailError = fieldError("email");
  const passwordError = fieldError("password");
  const confirmError = fieldError("confirmPassword");
  const roleError = fieldError("role");
  const termsError = fieldError("acceptTerms");


  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormMessage tone="error">{state.status === "error" ? state.message : null}</FormMessage>

      <FormField
        id="fullName"
        label="Full name"
        hint="This is the name your consultant sees. You can change how it is displayed later."
        error={nameError}
      >
        <Input
          id="fullName"
          autoComplete="name"
          invalid={Boolean(nameError)}
          aria-describedby={nameError ? "fullName-error" : "fullName-hint"}
          {...register("fullName")}
        />
      </FormField>

      <FormField id="email" label="Email address" error={emailError}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-error" : undefined}
          {...register("email")}
        />
      </FormField>

      <RoleChoice
        name="role"
        value={role}
        onChange={(next) => setValue("role", next, { shouldValidate: true })}
        error={roleError}
        hint="Consultant accounts are reviewed before they become visible to clients."
      />

      <FormField
        id="password"
        label="Password"
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
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="font-medium text-foreground">{passwordStrength.label}</span>
              {passwordStrength.missing.length > 0 ? ` — ${passwordStrength.missing[0]}` : null}
            </p>
          ) : null}
        </>
      </FormField>

      <FormField id="confirmPassword" label="Repeat password" error={confirmError}>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(confirmError)}
          aria-describedby={confirmError ? "confirmPassword-error" : undefined}
          {...register("confirmPassword")}
        />
      </FormField>

      <Controller
        name="acceptTerms"
        control={control}
        render={({ field }) => (
          <div className="flex items-start gap-3">
            <Checkbox
              id="acceptTerms"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? "acceptTerms-error" : undefined}
            />
            <Label htmlFor="acceptTerms" className="text-sm font-normal leading-snug">
              I accept the terms of service and the privacy policy, and I understand that this
              platform is not an emergency service.
            </Label>
          </div>
        )}
      />
      {termsError ? (
        <p id="acceptTerms-error" role="alert" className="text-sm font-medium text-danger">
          {termsError}
        </p>
      ) : null}

      {/* Carried with the submission rather than shown. Without JavaScript it
          stays empty, which the server normalises to UTC. */}
      <input type="hidden" {...register("timezone")} />
      <input type="hidden" name="acceptTerms" value={accepted ? "on" : "off"} readOnly />

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}

export { RegisterForm };
