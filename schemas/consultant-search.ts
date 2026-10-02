import { z } from "zod";

export const consultantSearchSchema = z
  .object({
    q: z.string().trim().max(80, "Search query too long.").optional().default("").catch(""),
    specializationIds: z.array(z.string().uuid()).optional().default([]).catch([]),
    languageIds: z.array(z.string().uuid()).optional().default([]).catch([]),
    consultationTypes: z.array(z.enum(["ONLINE", "IN_PERSON"])).optional().default([]).catch([]),
    priceMin: z.coerce.number().int().min(0).optional().catch(undefined),
    priceMax: z.coerce.number().int().min(0).optional().catch(undefined),
    minRating: z.coerce.number().min(0).max(5).optional().catch(undefined),
    availableWithinDays: z.coerce.number().int().min(1).max(90).optional().catch(undefined),
    sort: z.enum(["relevance", "price_asc", "price_desc", "rating"]).default("relevance").catch("relevance"),
    page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
  })
  .refine(
    (data) => {
      if (data.priceMin !== undefined && data.priceMax !== undefined) {
        return data.priceMin <= data.priceMax;
      }
      return true;
    },
    { message: "Minimum price cannot exceed maximum price.", path: ["priceMax"] },
  );

export const typeaheadQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(80),
  })
  .catch({ q: "" });

export type ConsultantSearchInput = z.infer<typeof consultantSearchSchema>;
export type TypeaheadQueryInput = z.infer<typeof typeaheadQuerySchema>;