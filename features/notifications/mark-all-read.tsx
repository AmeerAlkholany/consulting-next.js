"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";
import { markAllReadAction } from "./actions";

interface MarkAllReadProps {
  onSuccess?: () => void;
  disabled?: boolean;
}

export function MarkAllRead({ onSuccess, disabled }: MarkAllReadProps) {
  const [isPending, startTransition] = useTransition();

  const handleMarkAll = () => {
    startTransition(async () => {
      const res = await markAllReadAction();
      if (res.success) {
        onSuccess?.();
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs h-8"
      onClick={handleMarkAll}
      disabled={isPending || disabled}
    >
      <CheckCheck className="h-3.5 w-3.5" />
      {isPending ? "Updating..." : "Mark all as read"}
    </Button>
  );
}
