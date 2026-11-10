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
import { changeUserRoleAction } from "./admin-actions";

interface RoleChangeDialogProps {
  userId: string;
  userName: string;
  currentRole: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RoleChangeDialog({
  userId,
  userName,
  currentRole,
  isOpen,
  onOpenChange,
  onSuccess,
}: RoleChangeDialogProps) {
  const [targetRole, setTargetRole] = useState<"CLIENT" | "CONSULTANT" | "ADMIN">(
    (currentRole as "CLIENT" | "CONSULTANT" | "ADMIN") || "CLIENT",
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
      const res = await changeUserRoleAction(userId, targetRole, reason.trim());
      if (!res.success) {
        setError(res.message || "Failed to update role");
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
          <DialogTitle>Change User Role</DialogTitle>
          <DialogDescription>
            Change authorization role for <span className="font-semibold text-foreground">{userName}</span>.
            Role changes rotate all active sessions and adjust profile records.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="target-role" className="text-sm font-medium">New Role</label>
            <Select
              value={targetRole}
              onValueChange={(val) => setTargetRole(val as typeof targetRole)}
            >
              <SelectTrigger id="target-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLIENT">CLIENT (Book appointments)</SelectItem>
                <SelectItem value="CONSULTANT">CONSULTANT (Provide consultations)</SelectItem>
                <SelectItem value="ADMIN">ADMIN (Platform administration)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="role-reason" className="text-sm font-medium">
              Administrative Reason (Required, min 10 chars)
            </label>
            <Textarea
              id="role-reason"
              placeholder="e.g., Staff promotion to platform moderator..."
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
            onClick={handleSubmit}
            disabled={isPending || targetRole === currentRole || reason.trim().length < 10}
          >
            {isPending ? "Updating..." : "Confirm Role Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
