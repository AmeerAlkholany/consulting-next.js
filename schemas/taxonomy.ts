import { z } from "zod";

/** Generate a URL-safe slug from a name. */
export function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const specializationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(60, "Name must be 60 characters or fewer."),
    description: z
      .string()
      .trim()
      .max(300, "Description must be 300 characters or fewer.")
      .optional()
      .nullable(),
    sortOrder: z.coerce.number().int().min(0, "Sort order must be non-negative.").default(0),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => data.name.trim().length >= 2,
    { message: "Name must be at least 2 characters.", path: ["name"] },
  );

export const updateSpecializationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(60, "Name must be 60 characters or fewer."),
    description: z
      .string()
      .trim()
      .max(300, "Description must be 300 characters or fewer.")
      .optional()
      .nullable(),
    sortOrder: z.coerce.number().int().min(0, "Sort order must be non-negative.").default(0),
    isActive: z.boolean().default(true),
  });

export const reorderSpecializationsSchema = z.array(
  z.object({
    id: z.string().uuid("Invalid specialization ID."),
    sortOrder: z.number().int().min(0),
  }),
);

export const specializationIdSchema = z.string().uuid("Invalid specialization ID.");

export type SpecializationInput = z.infer<typeof specializationSchema>;
export type UpdateSpecializationInput = z.infer<typeof updateSpecializationSchema>;
export type ReorderSpecializationsInput = z.infer<typeof reorderSpecializationsSchema>;