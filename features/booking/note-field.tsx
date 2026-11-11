"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock } from "lucide-react";

interface NoteFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function NoteField({ value, onChange, disabled }: NoteFieldProps) {
  const maxLength = 1000;
  const remaining = maxLength - value.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="clientNote" className="text-sm font-medium">
          Note for your consultant (Optional)
        </Label>
        <span
          className={`text-xs ${
            remaining < 50 ? "text-destructive font-medium" : "text-muted-foreground"
          }`}
        >
          {remaining} characters left
        </span>
      </div>

      <Textarea
        id="clientNote"
        name="clientNote"
        placeholder="Share what you'd like to discuss or any questions you have ahead of the consultation..."
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-h-[100px] resize-y"
      />

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          Private &amp; Confidential: Visible only to your consultant. Never shown to
          administrators.
        </span>
      </div>
    </div>
  );
}
