"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUserStatusAction } from "./admin-actions";

interface StatusChangeDialogProps {
  userId: string;
  userName: string;
  currentStatus: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function StatusChangeDialog({
  userId,
  userName,
  currentStatus,
  isOpen,
  onOpenChange,
  onSuccess,
}: StatusChangeDialogProps) {
  const [targetStatus, setTargetStatus] = useState<"ACTIVE" | "SUSPENDED" | "DEACTIVATED">(
    currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters long.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await setUserStatusAction(userId, targetStatus, reason.trim());
      if (!res.success) {
        setError(res.message || "Failed to update status");
        return;
      }
      onOpenChange(false);
      setReason("");
      onSuccess?.();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Account Status</DialogTitle>
          <DialogDescription>
            Update status for <span className="font-semibold text-foreground">{userName}</span>.
            Suspending an account revokes all active sessions immediately.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">{error}</div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="target-status" className="text-sm font-medium">
              New Status
            </label>
            <Select
              value={targetStatus}
              onValueChange={(val) => setTargetStatus(val as typeof targetStatus)}
            >
              <SelectTrigger id="target-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">ACTIVE (Normal Access)</SelectItem>
                <SelectItem value="SUSPENDED">SUSPENDED (Sessions Revoked)</SelectItem>
                <SelectItem value="DEACTIVATED">DEACTIVATED (Account Closed)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="status-reason" className="text-sm font-medium">
              Administrative Reason (Required, min 10 chars)
            </label>
            <Textarea
              id="status-reason"
              placeholder="e.g., Investigation of reported policy violation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">{reason.length}/500 characters</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={targetStatus === "ACTIVE" ? "default" : "destructive"}
            onClick={handleSubmit}
            disabled={isPending || reason.trim().length < 10}
          >
            {isPending ? "Updating..." : "Confirm Status Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
