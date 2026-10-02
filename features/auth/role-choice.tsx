"use client";

import * as React from "react";
import { HeartHandshake, UserRound } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/cn";
import type { RegistrationRole } from "@/schemas/auth";

/**
 * The explicit role choice (IMPLEMENTATION.md Step 4, "UI changes").
 *
 * A person must say which side of the marketplace they are joining, because the
 * two accounts see different products and a consultant account cannot be turned
 * into a client one later. `ADMIN` is not offered here *and* is rejected by
 * `registrationRoleSchema` — the UI is not the control.
 */

const options: Array<{
  value: RegistrationRole;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: "CLIENT",
    label: "I am looking for support",
    description: "Book sessions, manage appointments, and review the care you received.",
    icon: <UserRound className="h-5 w-5" aria-hidden="true" />,
  },
  {
    value: "CONSULTANT",
    label: "I am a consultant",
    description: "Publish your availability and receive bookings once your profile is approved.",
    icon: <HeartHandshake className="h-5 w-5" aria-hidden="true" />,
  },
];

export interface RoleChoiceProps {
  value?: RegistrationRole;
  onChange: (value: RegistrationRole) => void;
  /** The hidden input's name, so the choice is part of the submitted form. */
  name: string;
  error?: string;
  hint?: React.ReactNode;
}

function RoleChoice({ value, onChange, name, error, hint }: RoleChoiceProps) {
  const groupId = `${name}-label`;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend id={groupId} className="text-sm font-medium text-foreground">
        Which describes you?
      </legend>
      <RadioGroup
        value={value ?? ""}
        onValueChange={(next) => onChange(next as RegistrationRole)}
        aria-labelledby={groupId}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className="gap-3"
      >
        {options.map((option) => {
          const optionId = `${name}-${option.value.toLowerCase()}`;

          return (
            <div
              key={option.value}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 transition-colors",
                value === option.value ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <RadioGroupItem id={optionId} value={option.value} />
              <div className="flex flex-col gap-1">
                <Label htmlFor={optionId} className="flex items-center gap-2 text-base">
                  {option.icon}
                  {option.label}
                </Label>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </div>
          );
        })}
      </RadioGroup>
      {/* Radix' radio group is a widget rather than a form control, so the value
          that is actually submitted lives in this input. */}
      <input type="hidden" name={name} value={value ?? ""} readOnly />
      {hint && !error ? (
        <p id={`${name}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export { RoleChoice };
