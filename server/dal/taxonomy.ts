import "server-only";

import { db } from "@/db/client";

export interface SpecializationRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  consultantCount: number;
}

export interface LanguageRow {
  id: string;
  code: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  consultantCount: number;
  clientCount: number;
}

/** Fetches all specializations with consultant usage counts. */
export async function getSpecializations(): Promise<SpecializationRow[]> {
  const rows = await db.$queryRawUnsafe<SpecializationRow[]>(
    `SELECT "s"."id", "s"."slug", "s"."name", "s"."description", "s"."isActive", "s"."sortOrder", "s"."createdAt", "s"."updatedAt",
            COALESCE("cs"."cnt", 0) AS "consultantCount"
     FROM "Specialization" "s"
     LEFT JOIN (
       SELECT "specializationId", COUNT(*) AS "cnt"
       FROM "ConsultantSpecialization"
       GROUP BY "specializationId"
     ) "cs" ON "cs"."specializationId" = "s"."id"
     ORDER BY "s"."sortOrder" ASC, "s"."name" ASC`,
  );
  return rows;
}

/** Fetches a single specialization by ID. */
export async function getSpecializationById(id: string): Promise<SpecializationRow | null> {
  const rows = await db.$queryRawUnsafe<SpecializationRow[]>(
    `SELECT "s"."id", "s"."slug", "s"."name", "s"."description", "s"."isActive", "s"."sortOrder", "s"."createdAt", "s"."updatedAt",
            COALESCE("cs"."cnt", 0) AS "consultantCount"
     FROM "Specialization" "s"
     LEFT JOIN (
       SELECT "specializationId", COUNT(*) AS "cnt"
       FROM "ConsultantSpecialization"
       GROUP BY "specializationId"
     ) "cs" ON "cs"."specializationId" = "s"."id"
     WHERE "s"."id" = $1`,
    id,
  );
  return rows[0] ?? null;
}

/** Fetches active specializations for selection lists. */
export async function getActiveSpecializations(): Promise<Pick<SpecializationRow, "id" | "slug" | "name">[]> {
  const rows = await db.specialization.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true },
  });
  return rows;
}

/** Fetches all languages with usage counts. */
export async function getLanguages(): Promise<LanguageRow[]> {
  const rows = await db.$queryRawUnsafe<LanguageRow[]>(
    `SELECT "l"."id", "l"."code", "l"."name", "l"."createdAt", "l"."updatedAt",
            COALESCE("cl"."cnt", 0) AS "consultantCount",
            COALESCE("cli"."cnt", 0) AS "clientCount"
     FROM "Language" "l"
     LEFT JOIN (
       SELECT "languageId", COUNT(*) AS "cnt"
       FROM "ConsultantLanguage"
       GROUP BY "languageId"
     ) "cl" ON "cl"."languageId" = "l"."id"
     LEFT JOIN (
       SELECT "languageId", COUNT(*) AS "cnt"
       FROM "ClientLanguage"
       GROUP BY "languageId"
     ) "cli" ON "cli"."languageId" = "l"."id"
     ORDER BY "l"."name" ASC`,
  );
  return rows;
}

/** Fetches active languages for selection lists. */
export async function getActiveLanguages(): Promise<Pick<LanguageRow, "id" | "code" | "name">[]> {
  const rows = await db.language.findMany({
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
  return rows;
}