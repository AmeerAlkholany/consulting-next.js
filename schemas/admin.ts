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

export const consultantFilterSchema = z
  .object({
    status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).default("ALL"),
    search: z.string().trim().max(80).optional().default(""),
    page: z.coerce.number().int().min(1).max(500).default(1),
    perPage: z.coerce.number().int().min(1).max(50).default(20),
  });

export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;
export type ConsultantFilterInput = z.infer<typeof consultantFilterSchema>;