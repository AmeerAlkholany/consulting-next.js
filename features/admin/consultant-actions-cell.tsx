"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  approveConsultantAction,
  rejectConsultantAction,
  suspendConsultantAction,
  reinstateConsultantAction,
} from "@/features/admin/actions";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useToast } from "@/components/feedback/toaster";
import { initialAuthFormState } from "@/features/auth/form-state";

interface ConsultantActionsCellProps {
  consultantId: string;
  consultantName: string;
  verificationStatus: string;
}

export function ConsultantActionsCell({
  consultantId,
  consultantName,
  verificationStatus,
}: ConsultantActionsCellProps) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const handleAction = (
    actionFn: typeof approveConsultantAction,
    actionName: string,
    successMessage: string,
  ) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", consultantId);
      formData.set("reason", `Admin ${actionName} applied`);
      const res = await actionFn(initialAuthFormState, formData);
      if (res.status === "success") {
        toast({ title: successMessage, variant: "success" });
      } else {
        toast({ title: res.message || `Failed to ${actionName}`, variant: "destructive" });
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {verificationStatus === "PENDING" && (
        <>
          <ConfirmDialog
            title={`Approve ${consultantName}?`}
            description={`Approving Dr. ${consultantName} will publish their profile on the platform and make their calendar available for client bookings.`}
            confirmLabel="Approve Consultant"
            tone="default"
            onConfirm={() =>
              handleAction(approveConsultantAction, "approve", `Approved ${consultantName}`)
            }
            trigger={
              <Button variant="ghost" size="sm" className="text-success hover:text-success/90">
                Approve
              </Button>
            }
          />
          <ConfirmDialog
            title={`Reject ${consultantName}'s application?`}
            description={`Rejecting Dr. ${consultantName}'s application will prevent them from accepting bookings. They will be notified of the decision.`}
            confirmLabel="Reject Application"
            tone="destructive"
            onConfirm={() =>
              handleAction(rejectConsultantAction, "reject", `Rejected ${consultantName}`)
            }
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive/90"
              >
                Reject
              </Button>
            }
          />
        </>
      )}

      {verificationStatus === "APPROVED" && (
        <ConfirmDialog
          title={`Suspend ${consultantName}?`}
          description={`Suspending Dr. ${consultantName} immediately revokes their active sessions, hides their profile from the public directory, and prevents new bookings.`}
          confirmLabel="Suspend Consultant"
          tone="destructive"
          onConfirm={() =>
            handleAction(suspendConsultantAction, "suspend", `Suspended ${consultantName}`)
          }
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive/90"
            >
              Suspend
            </Button>
          }
        />
      )}

      {verificationStatus === "SUSPENDED" && (
        <ConfirmDialog
          title={`Reinstate ${consultantName}?`}
          description={`Reinstating Dr. ${consultantName} will restore their public profile and allow clients to schedule appointments with them again.`}
          confirmLabel="Reinstate Consultant"
          tone="default"
          onConfirm={() =>
            handleAction(reinstateConsultantAction, "reinstate", `Reinstated ${consultantName}`)
          }
          trigger={
            <Button variant="ghost" size="sm" className="text-success hover:text-success/90">
              Reinstate
            </Button>
          }
        />
      )}
    </div>
  );
}
