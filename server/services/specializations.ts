import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { writeAuditLog, type AuditContext, type AuditAction } from "./audit";
import { generateSlug } from "@/schemas/taxonomy";
import type { SpecializationInput, UpdateSpecializationInput, ReorderSpecializationsInput } from "@/schemas/taxonomy";

/**
 * Specialization management service (IMPLEMENTATION.md Step 7).
 *
 * Admins manage the taxonomy. Slug is generated from name and never changes
 * on rename, so URLs and filters remain stable. Disabling hides from new
 * selections but keeps existing consultant links intact (RESTRICT FK).
 */

export interface SpecializationResult {
  status: "ok";
  specialization: { id: string; slug: string; name: string; isActive: boolean };
}

export interface NotFoundResult {
  status: "not_found";
}

export interface ConflictResult {
  status: "conflict";
  field: "slug" | "name";
  message: string;
}

type MutationResult = SpecializationResult | NotFoundResult | ConflictResult;

/** Creates a new specialization. */
export async function createSpecialization(
  ctx: AuditContext,
  input: SpecializationInput,
): Promise<MutationResult> {
  const slug = generateSlug(input.name);

  // Check for conflicts inside the transaction.
  const result = await db.$transaction(async (tx) => {
    const existingBySlug = await tx.specialization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingBySlug) {
      return { status: "conflict", field: "slug" as const, message: "A specialization with this name already exists (slug collision)." } as ConflictResult;
    }

    const existingByName = await tx.specialization.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" } },
      select: { id: true },
    });

    if (existingByName) {
      return { status: "conflict", field: "name" as const, message: "A specialization with this name already exists." } as ConflictResult;
    }

    // Find max sortOrder to append at the end.
    const maxOrder = await tx.specialization.aggregate({
      _max: { sortOrder: true },
    });

    const created = await tx.specialization.create({
      data: {
        slug,
        name: input.name.trim(),
        description: input.description ?? null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        isActive: input.isActive ?? true,
      },
      select: { id: true, slug: true, name: true, isActive: true },
    });

    return { status: "ok" as const, specialization: created } as SpecializationResult;
  });

  if (result.status === "ok") {
    await writeAuditLog(ctx, {
      action: "SPECIALIZATION_CREATED" as AuditAction,
      entityType: "Specialization",
      entityId: result.specialization.id,
      metadata: { slug: result.specialization.slug, name: result.specialization.name },
    });
  }

  return result;
}

/** Updates an existing specialization (name, description, sortOrder, isActive). Slug never changes. */
export async function updateSpecialization(
  ctx: AuditContext,
  id: string,
  input: UpdateSpecializationInput,
): Promise<MutationResult> {
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.specialization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) return { status: "not_found" } as NotFoundResult;

    // Check name uniqueness (case-insensitive) excluding self.
    if (input.name && input.name.trim() !== existing.name) {
      const nameConflict = await tx.specialization.findFirst({
        where: { name: { equals: input.name.trim(), mode: "insensitive" }, id: { not: id } },
        select: { id: true },
      });

      if (nameConflict) {
        return { status: "conflict", field: "name" as const, message: "A specialization with this name already exists." } as ConflictResult;
      }
    }

    const updated = await tx.specialization.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description: input.description ?? undefined,
        sortOrder: input.sortOrder ?? undefined,
        isActive: input.isActive ?? undefined,
      },
      select: { id: true, slug: true, name: true, isActive: true },
    });

    return { status: "ok" as const, specialization: updated } as SpecializationResult;
  });

  if (result.status === "ok") {
    await writeAuditLog(ctx, {
      action: "SPECIALIZATION_UPDATED",
      entityType: "Specialization",
      entityId: result.specialization.id,
      metadata: { slug: result.specialization.slug, name: result.specialization.name },
    });
  }

  return result;
}

/** Reorders specializations by their sortOrder. */
export async function reorderSpecializations(
  ctx: AuditContext,
  input: ReorderSpecializationsInput,
): Promise<{ status: "ok" } | { status: "not_found" }> {
  const ids = input.map((i) => i.id);

  // Verify all exist.
  const count = await db.specialization.count({ where: { id: { in: ids } } });
  if (count !== ids.length) return { status: "not_found" };

  await db.$transaction(async (tx) => {
    for (const item of input) {
      await tx.specialization.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      });
    }
  });

  await writeAuditLog(ctx, {
    action: "SPECIALIZATION_UPDATED",
    entityType: "Specialization",
    entityId: "batch",
    metadata: { count: ids.length },
  });

  return { status: "ok" };
}

/** Disables a specialization (hides from new selections). */
export async function disableSpecialization(
  ctx: AuditContext,
  id: string,
): Promise<MutationResult> {
  const spec = await db.specialization.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true, isActive: true },
  });

  if (!spec) return { status: "not_found" };

  if (!spec.isActive) {
    return { status: "ok", specialization: spec };
  }

  await db.specialization.update({
    where: { id },
    data: { isActive: false },
  });

  await writeAuditLog(ctx, {
    action: "SPECIALIZATION_DISABLED",
    entityType: "Specialization",
    entityId: id,
    metadata: { slug: spec.slug, name: spec.name },
  });

  return { status: "ok", specialization: { ...spec, isActive: false } };
}

/** Re-enables a specialization. */
export async function enableSpecialization(
  ctx: AuditContext,
  id: string,
): Promise<MutationResult> {
  const spec = await db.specialization.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true, isActive: true },
  });

  if (!spec) return { status: "not_found" };

  if (spec.isActive) {
    return { status: "ok", specialization: spec };
  }

  await db.specialization.update({
    where: { id },
    data: { isActive: true },
  });

  await writeAuditLog(ctx, {
    action: "SPECIALIZATION_UPDATED",
    entityType: "Specialization",
    entityId: id,
    metadata: { slug: spec.slug, name: spec.name },
  });

  return { status: "ok", specialization: { ...spec, isActive: true } };
}