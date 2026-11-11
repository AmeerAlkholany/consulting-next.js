import { createSession } from "@/server/auth/session";
import type { SessionUser } from "@/server/auth/dal";
import type { User } from "@/db/generated/prisma/client";

export function userToSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    timezone: user.timezone,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export async function createAuthenticatedTestSession(user: User): Promise<{
  sessionUser: SessionUser;
  cookieHeader: string;
}> {
  const sessionUser = userToSessionUser(user);
  const issued = await createSession(user.id, { ipHash: "test-hash", userAgent: "vitest-agent" });

  return {
    sessionUser,
    cookieHeader: `${issued.cookie.name}=${issued.cookie.value}`,
  };
}
