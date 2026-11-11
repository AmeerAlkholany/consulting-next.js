import { prisma } from "@/tests/helpers/db";
import { hashPassword } from "@/server/auth/password";
import type { User, ConsultantProfile } from "@/db/generated/prisma/client";

export async function createTestUser(
  params?: Partial<{
    email: string;
    fullName: string;
    role: "CLIENT" | "CONSULTANT" | "ADMIN";
    status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
    timezone: string;
    emailVerified: boolean;
  }>,
): Promise<User> {
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword("ValidPassword123!");
  const role = params?.role ?? "CLIENT";
  const emailVerifiedAt = params?.emailVerified !== false ? new Date() : null;

  return prisma.user.create({
    data: {
      email: params?.email ?? `user-${id}@example.com`,
      fullName: params?.fullName ?? `Test User ${id.slice(0, 6)}`,
      passwordHash,
      role,
      status: params?.status ?? "ACTIVE",
      timezone: params?.timezone ?? "UTC",
      emailVerifiedAt,
      ...(role === "CLIENT"
        ? {
            clientProfile: {
              create: {
                displayName: `Client ${id.slice(0, 6)}`,
              },
            },
          }
        : {}),
    },
  });
}

export async function createTestConsultant(
  params?: Partial<{
    user: Partial<Parameters<typeof createTestUser>[0]>;
    slug: string;
    headline: string;
    bio: string;
    priceMinor: number;
    durationMinutes: number;
    verificationStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
    isAcceptingBookings: boolean;
    timezone: string;
  }>,
): Promise<{ user: User; profile: ConsultantProfile }> {
  const user = await createTestUser({
    ...params?.user,
    role: "CONSULTANT",
  });

  const slug = params?.slug ?? `dr-test-${crypto.randomUUID()}`;
  const profile = await prisma.consultantProfile.create({
    data: {
      userId: user.id,
      slug,
      headline: params?.headline ?? "Licensed Clinical Psychologist",
      bio: params?.bio ?? "Experienced specialist in cognitive behavioral therapy.",
      yearsOfExperience: 8,
      sessionPriceMinor: params?.priceMinor ?? 12000,
      currency: "USD",
      sessionDurationMinutes: params?.durationMinutes ?? 50,
      consultationTypes: ["ONLINE"],
      timezone: params?.timezone ?? "UTC",
      verificationStatus: params?.verificationStatus ?? "APPROVED",
      isAcceptingBookings: params?.isAcceptingBookings ?? true,
    },
  });

  return { user, profile };
}
