import { z } from "zod";

export const verificationDecisionSchema = z
  .object({
    consultantProfileId: z.string().uuid("Invalid consultant profile ID."),
    action: z.enum(["approve", "reject", "suspend", "reinstate"]),
    reason: z
      .string()
      .trim()
      .min(10, "Reason must be at least 10 characters.")
      .max(500, "Reason must be 500 characters or fewer.")
      .optional()
      .nullable(),
    internalNote: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (["reject", "suspend"].includes(data.action) && !data.reason) {
        return false;
      }
      return true;
    },
    { message: "Reason is required for reject and suspend actions.", path: ["reason"] },
  );

export const consultantFilterSchema = z.object({
  status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).default("ALL"),
  search: z.string().trim().max(80).optional().default(""),
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;
export type ConsultantFilterInput = z.infer<typeof consultantFilterSchema>;

export const userStatusSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
  reason: z
    .string()
    .trim()
    .min(10, "Reason must be at least 10 characters")
    .max(500, "Reason must not exceed 500 characters"),
});

export const roleChangeSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  role: z.enum(["CLIENT", "CONSULTANT", "ADMIN"]),
  reason: z
    .string()
    .trim()
    .min(10, "Reason must be at least 10 characters")
    .max(500, "Reason must not exceed 500 characters"),
});

export const adminCancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID"),
  reason: z
    .string()
    .trim()
    .min(10, "Cancellation reason must be at least 10 characters")
    .max(500, "Cancellation reason must not exceed 500 characters"),
});

export const userFilterSchema = z.object({
  search: z.string().optional().default(""),
  role: z.enum(["ALL", "CLIENT", "CONSULTANT", "ADMIN"]).optional().default("ALL"),
  status: z.enum(["ALL", "ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional().default("ALL"),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const appointmentFilterSchema = z.object({
  status: z
    .enum(["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional()
    .default("ALL"),
  search: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const auditFilterSchema = z.object({
  actorId: z.string().optional().default(""),
  action: z.string().optional().default("ALL"),
  entityType: z.string().optional().default("ALL"),
  search: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(25),
  days: z.coerce.number().int().min(1).max(90).optional().default(30),
});

export type UserStatusInput = z.infer<typeof userStatusSchema>;
export type RoleChangeInput = z.infer<typeof roleChangeSchema>;
export type AdminCancelAppointmentInput = z.infer<typeof adminCancelAppointmentSchema>;
export type UserFilterInput = z.infer<typeof userFilterSchema>;
export type AppointmentFilterInput = z.infer<typeof appointmentFilterSchema>;
export type AuditFilterInput = z.infer<typeof auditFilterSchema>;
