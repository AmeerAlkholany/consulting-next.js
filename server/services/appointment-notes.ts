import "server-only";

import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { AuthorizationError, NotFoundError, ValidationError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/dal";
import { encryptText, decryptText } from "@/lib/crypto";
import type { NoteVisibility } from "@/db/generated/prisma/client";
import { getConsultantProfile } from "@/server/dal/consultant-profile";

export interface DecryptedAppointmentNote {
  id: string;
  appointmentId: string;
  authorUserId: string;
  body: string;
  visibility: NoteVisibility;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Gets private session notes for an appointment.
 * Only the author consultant can read these notes (BR-10, BR-11).
 * Admins have no read path to note bodies in the DAL.
 */
export async function getAppointmentNotes(
  actor: SessionUser,
  appointmentId: string,
): Promise<DecryptedAppointmentNote[]> {
  const consultantProfile = await getConsultantProfile(actor.id);
  if (!consultantProfile) {
    throw new AuthorizationError("Only registered consultants can view appointment notes");
  }

  // Verify consultant owns this appointment
  const appointment = await db.appointment.findFirst({
    where: {
      id: appointmentId,
      consultantProfileId: consultantProfile.id,
    },
    select: { id: true },
  });

  if (!appointment) {
    throw new NotFoundError("Appointment not found");
  }

  const rawNotes = await db.appointmentNote.findMany({
    where: {
      appointmentId,
      authorUserId: actor.id,
    },
    orderBy: { createdAt: "desc" },
  });

  return rawNotes.map((n) => {
    const decryptedBody = decryptText(n.body);
    return {
      id: n.id,
      appointmentId: n.appointmentId,
      authorUserId: n.authorUserId,
      body: decryptedBody ?? "[Encrypted note could not be opened]",
      visibility: n.visibility,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  });
}

/**
 * Creates or updates an encrypted session note for an appointment.
 */
export async function upsertAppointmentNote(
  actor: SessionUser,
  input: {
    appointmentId: string;
    noteId?: string;
    body: string;
    visibility?: NoteVisibility;
  },
): Promise<DecryptedAppointmentNote> {
  const consultantProfile = await getConsultantProfile(actor.id);
  if (!consultantProfile) {
    throw new AuthorizationError("Only consultants can create appointment notes");
  }

  const appointment = await db.appointment.findFirst({
    where: {
      id: input.appointmentId,
      consultantProfileId: consultantProfile.id,
    },
    select: { id: true },
  });

  if (!appointment) {
    throw new NotFoundError("Appointment not found");
  }

  if (input.body.length > 5000) {
    throw new ValidationError("Note body exceeds 5000 characters");
  }

  const encryptedBody = encryptText(input.body);
  const visibility = input.visibility ?? "CONSULTANT_ONLY";

  if (input.noteId) {
    // Verify ownership of the existing note
    const existing = await db.appointmentNote.findFirst({
      where: {
        id: input.noteId,
        appointmentId: input.appointmentId,
        authorUserId: actor.id,
      },
    });

    if (!existing) {
      throw new NotFoundError("Note not found or unauthorized");
    }

    const updated = await db.appointmentNote.update({
      where: { id: input.noteId },
      data: {
        body: encryptedBody,
        visibility,
      },
    });

    logger.info({ noteId: updated.id, appointmentId: input.appointmentId }, "Updated appointment note");

    return {
      id: updated.id,
      appointmentId: updated.appointmentId,
      authorUserId: updated.authorUserId,
      body: input.body,
      visibility: updated.visibility,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  const created = await db.appointmentNote.create({
    data: {
      appointmentId: input.appointmentId,
      authorUserId: actor.id,
      body: encryptedBody,
      visibility,
    },
  });

  logger.info({ noteId: created.id, appointmentId: input.appointmentId }, "Created appointment note");

  return {
    id: created.id,
    appointmentId: created.appointmentId,
    authorUserId: created.authorUserId,
    body: input.body,
    visibility: created.visibility,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * Deletes an appointment note.
 */
export async function deleteAppointmentNote(
  actor: SessionUser,
  appointmentId: string,
  noteId: string,
): Promise<{ success: true }> {
  const consultantProfile = await getConsultantProfile(actor.id);
  if (!consultantProfile) {
    throw new AuthorizationError("Only consultants can delete appointment notes");
  }

  const existing = await db.appointmentNote.findFirst({
    where: {
      id: noteId,
      appointmentId,
      authorUserId: actor.id,
    },
  });

  if (!existing) {
    throw new NotFoundError("Note not found or unauthorized");
  }

  await db.appointmentNote.delete({
    where: { id: noteId },
  });

  logger.info({ noteId, appointmentId }, "Deleted appointment note");

  return { success: true };
}

