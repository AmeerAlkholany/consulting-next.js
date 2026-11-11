"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

interface RatingInputProps {
  name?: string;
  defaultValue?: number;
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function RatingInput({
  name = "rating",
  defaultValue = 5,
  value: controlledValue,
  onChange,
  disabled = false,
  required = true,
  className,
}: RatingInputProps) {
  const [internalRating, setInternalRating] = useState<number>(defaultValue);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const rating = controlledValue !== undefined ? controlledValue : internalRating;

  const handleSelect = (val: number) => {
    if (disabled) return;
    setInternalRating(val);
    onChange?.(val);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <input type="hidden" name={name} value={rating} required={required} />
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Rating out of 5 stars"
        onMouseLeave={() => setHoverRating(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = (hoverRating !== null ? hoverRating : rating) >= star;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              disabled={disabled}
              onClick={() => handleSelect(star)}
              onMouseEnter={() => !disabled && setHoverRating(star)}
              className={cn(
                "p-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                isFilled ? "text-yellow-500" : "text-muted-foreground/30 hover:text-yellow-500/60"
              )}
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-transform active:scale-95",
                  isFilled ? "fill-current" : "fill-none"
                )}
              />
            </button>
          );
        })}
        <span className="text-sm font-medium text-muted-foreground ml-2">
          {hoverRating !== null ? hoverRating : rating} of 5 stars
        </span>
      </div>
    </div>
  );
}
