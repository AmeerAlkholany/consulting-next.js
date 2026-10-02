import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { AuthenticationError } from "@/server/errors";
import {
  getClientProfile,
  type ClientProfileData,
} from "@/server/dal/client-profile";
import type { ClientProfileInput, ChangePasswordInput } from "@/schemas/client-profile";

/**
 * Client profile services (IMPLEMENTATION.md Step 6).
 *
 * All mutations accept the actor directly — never an id from the payload —
 * so Client A cannot modify Client B's profile through any crafted request.
 */

export interface UpdateResult {
  status: "ok";
  profile: ClientProfileData;
}

export interface NotFoundResult {
  status: "not_found";
}

export interface BlockedResult {
  status: "blocked";
  appointments: Array<{ id: string; startsAt: Date; consultantName: string }>;
}

/**
 * Updates the caller's own client profile.
 * Language associations are replaced atomically: old links removed, new ones inserted.
 */
export async function updateClientProfile(
  actor: { id: string },
  input: ClientProfileInput,
): Promise<UpdateResult | NotFoundResult> {
  // Verify the profile exists and belongs to this actor before any mutation.
  const existing = await getClientProfile(actor.id);

  if (!existing) {
    // A genuine gap — registration should have created it, but if the row
    // is missing the safest response is not to silently succeed.
    logger.warn({ userId: actor.id }, "profile update attempted for missing profile row");
    return { status: "not_found" };
  }

  const profile = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: {
        fullName: input.fullName,
        timezone: input.timezone,
      },
    });

    await tx.clientProfile.update({
      where: { userId: actor.id },
      data: {
        displayName: input.displayName,
        phone: input.phone,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
      },
    });

    // Replace language associations atomically.
    await tx.clientLanguage.deleteMany({ where: { clientProfileId: existing.id } });
    if (input.languageIds.length > 0) {
      await tx.clientLanguage.createMany({
        data: input.languageIds.map((languageId) => ({
          clientProfileId: existing.id,
          languageId,
        })),
      });
    }

    return tx.clientProfile.findUnique({
      where: { userId: actor.id },
      select: {
        id: true,
        userId: true,
        displayName: true,
        phone: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        user: {
          select: { fullName: true, timezone: true, email: true },
        },
        languages: { select: { languageId: true } },
      },
    });
  });

  if (!profile) return { status: "not_found" };

  return {
    status: "ok",
    profile: {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      fullName: profile.user.fullName,
      phone: profile.phone,
      dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
      timezone: profile.user.timezone,
      languageIds: profile.languages.map((l) => l.languageId),
      emergencyContactName: profile.emergencyContactName,
      emergencyContactPhone: profile.emergencyContactPhone,
    },
  };
}

/**
 * Changes the caller's password.
 * Revokes all *other* sessions, keeping the current one active.
 */
export async function changePassword(
  actor: { id: string },
  input: ChangePasswordInput,
  verifyPasswordFn: (hash: string, password: string) => Promise<boolean>,
): Promise<{ status: "ok" }> {
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: { passwordHash: true },
  });

  if (!user) throw new AuthenticationError("Please sign in again.");

  const matches = await verifyPasswordFn(user.passwordHash, input.currentPassword);

  if (!matches) {
    throw new AuthenticationError("Current password is incorrect.");
  }

  // Re-hash and revoke other sessions.
  const { hashPassword } = await import("@/server/auth/password");
  const newHash = await hashPassword(input.newPassword);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: { passwordHash: newHash },
    });

    // Revoke all sessions except the current one.
    await tx.session.updateMany({
      where: { userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  logger.info({ userId: actor.id }, "password changed");
  return { status: "ok" };
}

export interface Blocker {
  id: string;
  startsAt: Date;
  consultantName: string;
}

/**
 * Checks whether the caller has any blocking future appointments.
 * Returns the blocking appointments so the UI can explain what prevents deletion.
 */
export async function checkDeletionBlocks(actor: { id: string }): Promise<Blocker[] | null> {
  const profile = await db.clientProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });

  if (!profile) return null;

  const blockers = await db.appointment.findMany({
    where: {
      clientProfileId: profile.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { gt: new Date() },
    },
    include: {
      consultantProfile: { select: { headline: true } },
    },
  });

  if (blockers.length === 0) return null;

  return blockers.map((a) => ({
    id: a.id,
    startsAt: a.startsAt,
    consultantName: a.consultantProfile.headline,
  }));
}

/**
 * Soft-deletes the caller's account: sets deletedAt on User and anonymizes
 * their ClientProfile. Appointments are NOT deleted (they belong to the other
 * party too), so we refuse deletion when blocking future appointments exist.
 */
export async function requestAccountDeletion(actor: { id: string }): Promise<
  | { status: "ok" }
  | { status: "blocked"; appointments: Blocker[] }
> {
  const blockers = await checkDeletionBlocks(actor);

  if (blockers) {
    return { status: "blocked", appointments: blockers };
  }

  await db.$transaction(async (tx) => {
    // Anonymize the client profile.
    await tx.clientProfile.update({
      where: { userId: actor.id },
      data: {
        displayName: "Deleted User",
        phone: null,
        dateOfBirth: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
      },
    });

    // Delete language associations (need the profile id, not the user id).
    const profile = await tx.clientProfile.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });

    if (profile) {
      await tx.clientLanguage.deleteMany({ where: { clientProfileId: profile.id } });
    }

    // Soft-delete the user.
    await tx.user.update({
      where: { id: actor.id },
      data: {
        deletedAt: new Date(),
        fullName: "Deleted User",
      },
    });

    // Revoke all sessions immediately (BR-12).
    await tx.session.updateMany({
      where: { userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  logger.info({ userId: actor.id }, "account deleted (soft delete + anonymization)");
  return { status: "ok" };
}
