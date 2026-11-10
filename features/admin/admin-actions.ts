"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdmin } from "@/server/authz/guards";
import {
  setUserStatus,
  changeUserRole,
  adminCancelAppointment,
} from "@/server/services/admin";
import {
  userStatusSchema,
  roleChangeSchema,
  adminCancelAppointmentSchema,
} from "@/schemas/admin";

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export async function setUserStatusAction(
  userId: string,
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED",
  reason: string,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = userStatusSchema.safeParse({ userId, status, reason });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid user status input",
    };
  }

  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ipHash = forwardedFor ? Buffer.from(forwardedFor).toString("base64").slice(0, 32) : undefined;

  try {
    const res = await setUserStatus({ actor, ipHash }, parsed.data);
    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { success: true, data: res };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to update user status",
    };
  }
}

export async function changeUserRoleAction(
  userId: string,
  role: "CLIENT" | "CONSULTANT" | "ADMIN",
  reason: string,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = roleChangeSchema.safeParse({ userId, role, reason });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid role change input",
    };
  }

  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ipHash = forwardedFor ? Buffer.from(forwardedFor).toString("base64").slice(0, 32) : undefined;

  try {
    const res = await changeUserRole({ actor, ipHash }, parsed.data);
    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { success: true, data: res };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to change user role",
    };
  }
}

export async function adminCancelAppointmentAction(
  appointmentId: string,
  reason: string,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = adminCancelAppointmentSchema.safeParse({ appointmentId, reason });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid cancellation input",
    };
  }

  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ipHash = forwardedFor ? Buffer.from(forwardedFor).toString("base64").slice(0, 32) : undefined;

  try {
    const res = await adminCancelAppointment({ actor, ipHash }, parsed.data);
    revalidatePath("/admin");
    revalidatePath("/admin/appointments");
    return { success: true, data: res };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to cancel appointment",
    };
  }
}
