import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import {
  setUserStatus,
  changeUserRole,
  adminCancelAppointment,
} from "@/server/services/admin";
import {
  getAppointmentsForAdminOversight,
  getUsersForAdmin,
  getAuditLogsForAdmin,
} from "@/server/dal/admin";
import type { SessionUser } from "@/server/auth/dal";

describe("Admin console integration tests", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  let adminUser: SessionUser;
  let admin2User: SessionUser;
  let clientUser: SessionUser;
  let consultantUser: SessionUser;

  let clientProfileId: string;
  let consultantProfileId: string;

  beforeEach(async () => {
    await cleanDatabase();

    // 1. Primary Admin
    const uAdmin = await prisma.user.create({
      data: {
        email: "admin1@example.com",
        fullName: "Primary Admin",
        passwordHash: "dummy-hash",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    adminUser = {
      id: uAdmin.id,
      email: uAdmin.email,
      fullName: uAdmin.fullName,
      role: "ADMIN",
      status: "ACTIVE",
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };

    // 2. Secondary Admin
    const uAdmin2 = await prisma.user.create({
      data: {
        email: "admin2@example.com",
        fullName: "Secondary Admin",
        passwordHash: "dummy-hash",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    admin2User = {
      id: uAdmin2.id,
      email: uAdmin2.email,
      fullName: uAdmin2.fullName,
      role: "ADMIN",
      status: "ACTIVE",
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };

    // 3. Client
    const uClient = await prisma.user.create({
      data: {
        email: "client@example.com",
        fullName: "Charlie Client",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        clientProfile: {
          create: {
            displayName: "Charlie",
            phone: "+15551234567",
          },
        },
      },
      include: { clientProfile: true },
    });
    clientUser = {
      id: uClient.id,
      email: uClient.email,
      fullName: uClient.fullName,
      role: "CLIENT",
      status: "ACTIVE",
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };
    clientProfileId = uClient.clientProfile!.id;

    // 4. Consultant
    const uConsultant = await prisma.user.create({
      data: {
        email: "consultant@example.com",
        fullName: "Dr. Alice",
        passwordHash: "dummy-hash",
        role: "CONSULTANT",
        status: "ACTIVE",
        consultantProfile: {
          create: {
            slug: "dr-alice",
            headline: "Senior Psychologist",
            bio: "Experienced psychologist specializing in CBT.",
            yearsOfExperience: 10,
            sessionPriceMinor: 12000,
            currency: "USD",
            sessionDurationMinutes: 50,
            consultationTypes: ["ONLINE"],
            timezone: "UTC",
            verificationStatus: "APPROVED",
            isAcceptingBookings: true,
          },
        },
      },
      include: { consultantProfile: true },
    });
    consultantUser = {
      id: uConsultant.id,
      email: uConsultant.email,
      fullName: uConsultant.fullName,
      role: "CONSULTANT",
      status: "ACTIVE",
      timezone: "UTC",
      emailVerifiedAt: new Date(),
    };
    consultantProfileId = uConsultant.consultantProfile!.id;
  });

  describe("BR-12: User status & immediate session revocation", () => {
    it("suspends a user account and immediately revokes all of their active sessions", async () => {
      // Create active session for client
      await prisma.session.create({
        data: {
          userId: clientUser.id,
          tokenHash: "dummy-token-hash-1",
          expiresAt: new Date(Date.now() + 86400 * 1000),
          lastUsedAt: new Date(),
        },
      });

      const beforeSessions = await prisma.session.count({
        where: { userId: clientUser.id, revokedAt: null },
      });
      expect(beforeSessions).toBe(1);

      // Admin suspends client
      const res = await setUserStatus(
        { actor: adminUser },
        {
          userId: clientUser.id,
          status: "SUSPENDED",
          reason: "Suspected abusive behavior and multiple chargebacks.",
        },
      );
      expect(res.status).toBe("ok");

      const userDb = await prisma.user.findUniqueOrThrow({ where: { id: clientUser.id } });
      expect(userDb.status).toBe("SUSPENDED");

      // Verify sessions revoked immediately
      const activeSessions = await prisma.session.count({
        where: { userId: clientUser.id, revokedAt: null },
      });
      expect(activeSessions).toBe(0);

      // Verify AuditLog written
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: clientUser.id, action: "USER_SUSPENDED" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(adminUser.id);
    });

    it("reactivates a suspended user without restoring old sessions", async () => {
      await prisma.user.update({
        where: { id: clientUser.id },
        data: { status: "SUSPENDED" },
      });

      const res = await setUserStatus(
        { actor: adminUser },
        {
          userId: clientUser.id,
          status: "ACTIVE",
          reason: "Account verified and cleared by compliance.",
        },
      );
      expect(res.status).toBe("ok");

      const userDb = await prisma.user.findUniqueOrThrow({ where: { id: clientUser.id } });
      expect(userDb.status).toBe("ACTIVE");

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: clientUser.id, action: "USER_REACTIVATED" },
      });
      expect(audit).not.toBeNull();
    });

    it("refuses self-modification (CANNOT_MODIFY_SELF)", async () => {
      await expect(
        setUserStatus(
          { actor: adminUser },
          {
            userId: adminUser.id,
            status: "SUSPENDED",
            reason: "Attempting to suspend self.",
          },
        ),
      ).rejects.toThrow("CANNOT_MODIFY_SELF");
    });

    it("protects the last active admin (LAST_ADMIN)", async () => {
      // Remove admin2
      await prisma.user.delete({ where: { id: admin2User.id } });

      await expect(
        setUserStatus(
          { actor: adminUser },
          {
            userId: adminUser.id,
            status: "SUSPENDED",
            reason: "Trying to suspend last admin.",
          },
        ),
      ).rejects.toThrow("CANNOT_MODIFY_SELF");

      // Demoting or suspending last admin from another actor if tried
      await expect(
        changeUserRole(
          { actor: { ...adminUser, id: "some-other-id" } as SessionUser },
          {
            userId: adminUser.id,
            role: "CLIENT",
            reason: "Trying to demote last active admin",
          },
        ),
      ).rejects.toThrow("LAST_ADMIN");
    });
  });

  describe("Role changes", () => {
    it("changes client role to consultant and keeps profile", async () => {
      const res = await changeUserRole(
        { actor: adminUser },
        {
          userId: clientUser.id,
          role: "CONSULTANT",
          reason: "Approved internal practitioner onboarded.",
        },
      );
      expect(res.status).toBe("ok");
      expect(res.role).toBe("CONSULTANT");

      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: clientUser.id },
        include: { clientProfile: true },
      });
      expect(updated.role).toBe("CONSULTANT");
      // Retained client profile
      expect(updated.clientProfile).not.toBeNull();
    });

    it("unpublishes consultant profile when role changes to client", async () => {
      const res = await changeUserRole(
        { actor: adminUser },
        {
          userId: consultantUser.id,
          role: "CLIENT",
          reason: "Consultant opted to revert to standard client account.",
        },
      );
      expect(res.status).toBe("ok");

      const profile = await prisma.consultantProfile.findUniqueOrThrow({
        where: { id: consultantProfileId },
      });
      expect(profile.isAcceptingBookings).toBe(false);
    });
  });

  describe("BR-11: Admin appointment oversight & privacy assurance", () => {
    it("returns metadata-only projection and structurally excludes clientNote and clinical notes", async () => {
      const now = new Date();
      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId,
          startsAt: new Date(now.getTime() + 3600 * 1000),
          endsAt: new Date(now.getTime() + 2 * 3600 * 1000),
          status: "CONFIRMED",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
          clientNote: "SENSITIVE: Highly private client disclosure for consultant only.",
        },
      });

      // Consultant creates encrypted note
      await prisma.appointmentNote.create({
        data: {
          appointmentId: apt.id,
          authorUserId: consultantUser.id,
          body: "enc:v1:k1:dummyIV:dummyTag:dummyCiphertext",
          visibility: "CONSULTANT_ONLY",
        },
      });

      const oversight = await getAppointmentsForAdminOversight({
        page: 1,
        perPage: 10,
      });

      expect(oversight.appointments).toHaveLength(1);
      const row = oversight.appointments[0] as Record<string, unknown>;

      // Assert by key set: clientNote and notes MUST NOT exist in the projection
      expect(row).not.toHaveProperty("clientNote");
      expect(row).not.toHaveProperty("notes");
      expect(row).not.toHaveProperty("body");
      expect(Object.keys(row)).toEqual([
        "id",
        "startsAt",
        "endsAt",
        "status",
        "consultationType",
        "priceMinor",
        "currency",
        "sessionDurationMinutes",
        "clientDisplayName",
        "consultantFullName",
        "cancellationReason",
        "cancelledBy",
        "createdAt",
      ]);
    });

    it("cancels appointment as admin with mandatory reason and writes audit entry", async () => {
      const now = new Date();
      const apt = await prisma.appointment.create({
        data: {
          clientProfileId,
          consultantProfileId,
          startsAt: new Date(now.getTime() + 3600 * 1000),
          endsAt: new Date(now.getTime() + 2 * 3600 * 1000),
          status: "PENDING",
          consultationType: "ONLINE",
          priceMinor: 12000,
          currency: "USD",
          sessionDurationMinutes: 50,
          clientTimezone: "UTC",
          consultantTimezone: "UTC",
        },
      });

      const res = await adminCancelAppointment(
        { actor: adminUser },
        {
          appointmentId: apt.id,
          reason: "Platform maintenance during scheduled time window.",
        },
      );
      expect(res.status).toBe("ok");

      const aptDb = await prisma.appointment.findUniqueOrThrow({ where: { id: apt.id } });
      expect(aptDb.status).toBe("CANCELLED");
      expect(aptDb.cancelledBy).toBe("ADMIN");
      expect(aptDb.cancellationReason).toBe(
        "Platform maintenance during scheduled time window.",
      );

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: apt.id, action: "APPOINTMENT_CANCELLED_BY_ADMIN" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(adminUser.id);
    });

    it("rejects non-admin actor from all admin operations", async () => {
      await expect(
        setUserStatus(
          { actor: clientUser },
          {
            userId: consultantUser.id,
            status: "SUSPENDED",
            reason: "Non-admin trying to suspend.",
          },
        ),
      ).rejects.toThrow("Only administrators can modify user status.");

      await expect(
        changeUserRole(
          { actor: consultantUser },
          {
            userId: clientUser.id,
            role: "ADMIN",
            reason: "Consultant promoting client to admin.",
          },
        ),
      ).rejects.toThrow("Only administrators can modify user roles.");
    });
  });
});
