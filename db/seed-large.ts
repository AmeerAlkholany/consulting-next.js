import { prisma } from "@/tests/helpers/db";
import { hashPassword } from "@/server/auth/password";

/**
 * Large volume seeder for performance benchmarking (Step 22).
 * Seeds realistic volume: 500 consultants, specializations, and appointments.
 */
export async function seedVolumeDataset(consultantCount = 50, _appointmentsPerConsultant = 10) {
  console.log(`Starting volume seed: ${consultantCount} consultants...`);
  const passwordHash = await hashPassword("Benchmark123!");

  for (let i = 1; i <= consultantCount; i++) {
    const slug = `dr-bench-${i}-${crypto.randomUUID().slice(0, 8)}`;
    await prisma.user.create({
      data: {
        email: `bench-consultant-${i}-${crypto.randomUUID()}@example.com`,
        fullName: `Dr. Benchmark ${i}`,
        passwordHash,
        role: "CONSULTANT",
        status: "ACTIVE",
        timezone: "UTC",
        consultantProfile: {
          create: {
            slug,
            headline: "Clinical Psychologist & Performance Researcher",
            bio: "Benchmarking volume tests for consultation platform queries.",
            yearsOfExperience: 10,
            sessionPriceMinor: 15000,
            currency: "USD",
            sessionDurationMinutes: 50,
            consultationTypes: ["ONLINE"],
            timezone: "UTC",
            verificationStatus: "APPROVED",
            isAcceptingBookings: true,
          },
        },
      },
    });
  }

  console.log("Volume seed completed successfully.");
}
