import "server-only";

import { db } from "@/db/client";

export interface ClientProfileData {
  id: string;
  userId: string;
  displayName: string;
  fullName: string;
  phone: string | null;
  dateOfBirth: string | null;
  timezone: string;
  languageIds: string[];
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

/** Fetches the client profile for a given user, including their language associations. */
export async function getClientProfile(userId: string): Promise<ClientProfileData | null> {
  const profile = await db.clientProfile.findUnique({
    where: { userId },
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
      languages: {
        select: { languageId: true },
      },
    },
  });

  if (!profile) return null;

  return {
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
  };
}

/** Returns the count of active sessions for the caller. */
export async function countActiveSessions(userId: string): Promise<number> {
  const [{ count }] = await db.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) AS count FROM "Session" WHERE "userId" = $1 AND "revokedAt" IS NULL`,
    userId,
  );
  return Number(count ?? 0);
}
