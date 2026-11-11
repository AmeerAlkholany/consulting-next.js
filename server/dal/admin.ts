import "server-only";

import { db } from "@/db/client";

export interface ConsultantListRow {
  id: string;
  slug: string;
  headline: string;
  userId: string;
  fullName: string;
  email: string;
  verificationStatus: string;
  rejectionReason: string | null;
  isAcceptingBookings: boolean;
  specializations: string[];
  languages: string[];
  sessionPriceMinor: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsultantDetailRow extends ConsultantListRow {
  bio: string;
  yearsOfExperience: number;
  sessionDurationMinutes: number;
  bufferMinutes: number;
  minLeadTimeHours: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
  consultationTypes: string[];
  addressLine: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  autoConfirmBookings: boolean;
  verificationReviewedAt: Date | null;
  verificationReviewedById: string | null;
  publishedAt: Date | null;
  ratingSum: number;
  ratingCount: number;
  qualifications: Array<{
    id: string;
    title: string;
    institution: string;
    awardedYear: number;
    credentialId: string | null;
  }>;
}

/** Fetches consultants with filters for admin review. */
export async function getConsultantsForAdmin(filter: {
  status: string;
  search: string;
  page: number;
  perPage: number;
}): Promise<{ consultants: ConsultantListRow[]; total: number }> {
  const where: Record<string, unknown> = {};

  if (filter.status !== "ALL") {
    where.verificationStatus = filter.status;
  }

  if (filter.search) {
    where.OR = [
      { headline: { contains: filter.search, mode: "insensitive" } },
      { bio: { contains: filter.search, mode: "insensitive" } },
      { user: { fullName: { contains: filter.search, mode: "insensitive" } } },
      { user: { email: { contains: filter.search, mode: "insensitive" } } },
    ];
  }

  const [consultants, total] = await Promise.all([
    db.consultantProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.perPage,
      take: filter.perPage,
      select: {
        id: true,
        slug: true,
        headline: true,
        userId: true,
        verificationStatus: true,
        rejectionReason: true,
        isAcceptingBookings: true,
        sessionPriceMinor: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { fullName: true, email: true } },
        specializations: { select: { specialization: { select: { name: true } } } },
        languages: { select: { language: { select: { name: true } } } },
      },
    }),
    db.consultantProfile.count({ where }),
  ]);

  return {
    consultants: consultants.map((c) => ({
      id: c.id,
      slug: c.slug,
      headline: c.headline,
      userId: c.userId,
      fullName: c.user.fullName,
      email: c.user.email,
      verificationStatus: c.verificationStatus,
      rejectionReason: c.rejectionReason,
      isAcceptingBookings: c.isAcceptingBookings,
      specializations: c.specializations.map((s) => s.specialization.name),
      languages: c.languages.map((l) => l.language.name),
      sessionPriceMinor: c.sessionPriceMinor,
      currency: c.currency,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    total,
  };
}

/** Fetches a consultant profile with full details for admin review. */
export async function getConsultantDetailForAdmin(id: string): Promise<ConsultantDetailRow | null> {
  const profile = await db.consultantProfile.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      headline: true,
      bio: true,
      yearsOfExperience: true,
      sessionPriceMinor: true,
      currency: true,
      sessionDurationMinutes: true,
      bufferMinutes: true,
      minLeadTimeHours: true,
      maxAdvanceDays: true,
      cancellationWindowHours: true,
      consultationTypes: true,
      addressLine: true,
      city: true,
      country: true,
      timezone: true,
      verificationStatus: true,
      rejectionReason: true,
      isAcceptingBookings: true,
      autoConfirmBookings: true,
      verificationReviewedAt: true,
      verificationReviewedById: true,
      publishedAt: true,
      ratingSum: true,
      ratingCount: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      user: { select: { fullName: true, email: true } },
      specializations: { select: { specializationId: true } },
      languages: { select: { languageId: true } },
      qualifications: {
        select: { id: true, title: true, institution: true, awardedYear: true, credentialId: true },
      },
    },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    slug: profile.slug,
    headline: profile.headline,
    bio: profile.bio,
    yearsOfExperience: profile.yearsOfExperience,
    sessionPriceMinor: profile.sessionPriceMinor,
    currency: profile.currency,
    sessionDurationMinutes: profile.sessionDurationMinutes,
    bufferMinutes: profile.bufferMinutes,
    minLeadTimeHours: profile.minLeadTimeHours,
    maxAdvanceDays: profile.maxAdvanceDays,
    cancellationWindowHours: profile.cancellationWindowHours,
    consultationTypes: profile.consultationTypes,
    addressLine: profile.addressLine,
    city: profile.city,
    country: profile.country,
    timezone: profile.timezone,
    verificationStatus: profile.verificationStatus,
    rejectionReason: profile.rejectionReason,
    isAcceptingBookings: profile.isAcceptingBookings,
    autoConfirmBookings: profile.autoConfirmBookings,
    verificationReviewedAt: profile.verificationReviewedAt,
    verificationReviewedById: profile.verificationReviewedById,
    publishedAt: profile.publishedAt,
    ratingSum: profile.ratingSum,
    ratingCount: profile.ratingCount,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    userId: profile.userId,
    fullName: profile.user.fullName,
    email: profile.user.email,
    specializations: profile.specializations.map((s) => s.specializationId),
    languages: profile.languages.map((l) => l.languageId),
    qualifications: profile.qualifications,
  };
}

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  clientDisplayName?: string | null;
  consultantHeadline?: string | null;
  consultantVerificationStatus?: string | null;
  activeSessionsCount: number;
}

export async function getUsersForAdmin(filter: {
  search?: string;
  role?: string;
  status?: string;
  page: number;
  perPage: number;
}): Promise<{ users: AdminUserRow[]; total: number }> {
  const where: Record<string, unknown> = {};

  if (filter.role && filter.role !== "ALL") {
    where.role = filter.role;
  }

  if (filter.status && filter.status !== "ALL") {
    where.status = filter.status;
  }

  if (filter.search) {
    where.OR = [
      { fullName: { contains: filter.search, mode: "insensitive" } },
      { email: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  const [rawUsers, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.perPage,
      take: filter.perPage,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        clientProfile: { select: { displayName: true } },
        consultantProfile: { select: { headline: true, verificationStatus: true } },
        _count: {
          select: {
            sessions: {
              where: {
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
            },
          },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  const users: AdminUserRow[] = rawUsers.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    status: u.status,
    emailVerifiedAt: u.emailVerifiedAt,
    createdAt: u.createdAt,
    clientDisplayName: u.clientProfile?.displayName ?? null,
    consultantHeadline: u.consultantProfile?.headline ?? null,
    consultantVerificationStatus: u.consultantProfile?.verificationStatus ?? null,
    activeSessionsCount: u._count.sessions,
  }));

  return { users, total };
}

export interface AdminUserDetailRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  timezone: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  clientProfile?: {
    id: string;
    displayName: string;
    phone: string | null;
  } | null;
  consultantProfile?: {
    id: string;
    headline: string;
    verificationStatus: string;
    isAcceptingBookings: boolean;
    sessionPriceMinor: number;
    currency: string;
  } | null;
  activeSessionsCount: number;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
  }>;
}

export async function getUserDetailForAdmin(userId: string): Promise<AdminUserDetailRow | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      timezone: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      clientProfile: {
        select: {
          id: true,
          displayName: true,
          phone: true,
        },
      },
      consultantProfile: {
        select: {
          id: true,
          headline: true,
          verificationStatus: true,
          isAcceptingBookings: true,
          sessionPriceMinor: true,
          currency: true,
        },
      },
      _count: {
        select: {
          sessions: {
            where: {
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const recentActivity = await db.auditLog.findMany({
    where: {
      OR: [{ actorUserId: userId }, { entityId: userId }],
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    timezone: user.timezone,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    clientProfile: user.clientProfile ?? null,
    consultantProfile: user.consultantProfile ?? null,
    activeSessionsCount: user._count.sessions,
    recentActivity,
  };
}

/**
 * BR-11: Admin appointment oversight projection.
 * MUST NOT select `clientNote` or `notes` (clinical notes).
 */
export interface AdminAppointmentOversightRow {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  consultationType: string;
  priceMinor: number;
  currency: string;
  sessionDurationMinutes: number;
  clientDisplayName: string;
  consultantFullName: string;
  cancellationReason: string | null;
  cancelledBy: string | null;
  createdAt: Date;
}

export async function getAppointmentsForAdminOversight(filter: {
  status?: string;
  search?: string;
  page: number;
  perPage: number;
}): Promise<{ appointments: AdminAppointmentOversightRow[]; total: number }> {
  const where: Record<string, unknown> = {};

  if (filter.status && filter.status !== "ALL") {
    where.status = filter.status;
  }

  if (filter.search) {
    where.OR = [
      { clientProfile: { displayName: { contains: filter.search, mode: "insensitive" } } },
      {
        consultantProfile: { user: { fullName: { contains: filter.search, mode: "insensitive" } } },
      },
    ];
  }

  // Pure metadata projection - zero clinical note fields selected (BR-11)
  const [records, total] = await Promise.all([
    db.appointment.findMany({
      where,
      orderBy: { startsAt: "desc" },
      skip: (filter.page - 1) * filter.perPage,
      take: filter.perPage,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        consultationType: true,
        priceMinor: true,
        currency: true,
        sessionDurationMinutes: true,
        cancellationReason: true,
        cancelledBy: true,
        createdAt: true,
        clientProfile: { select: { displayName: true } },
        consultantProfile: {
          select: {
            user: { select: { fullName: true } },
          },
        },
      },
    }),
    db.appointment.count({ where }),
  ]);

  const appointments: AdminAppointmentOversightRow[] = records.map((r) => ({
    id: r.id,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    consultationType: r.consultationType,
    priceMinor: r.priceMinor,
    currency: r.currency,
    sessionDurationMinutes: r.sessionDurationMinutes,
    clientDisplayName: r.clientProfile.displayName,
    consultantFullName: r.consultantProfile.user.fullName,
    cancellationReason: r.cancellationReason,
    cancelledBy: r.cancelledBy,
    createdAt: r.createdAt,
  }));

  return { appointments, total };
}

export interface AdminAuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  actorFullName: string | null;
  actorEmail: string | null;
  metadata: unknown;
  createdAt: Date;
}

export async function getAuditLogsForAdmin(filter: {
  action?: string;
  entityType?: string;
  search?: string;
  days?: number;
  page: number;
  perPage: number;
}): Promise<{ logs: AdminAuditLogRow[]; total: number }> {
  const where: Record<string, unknown> = {};

  if (filter.action && filter.action !== "ALL") {
    where.action = filter.action;
  }

  if (filter.entityType && filter.entityType !== "ALL") {
    where.entityType = filter.entityType;
  }

  if (filter.days) {
    const minDate = new Date(Date.now() - filter.days * 24 * 3600 * 1000);
    where.createdAt = { gte: minDate };
  }

  if (filter.search) {
    where.OR = [
      { actorUser: { fullName: { contains: filter.search, mode: "insensitive" } } },
      { actorUser: { email: { contains: filter.search, mode: "insensitive" } } },
      { entityId: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  const [records, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.perPage,
      take: filter.perPage,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorUserId: true,
        metadata: true,
        createdAt: true,
        actorUser: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  const logs: AdminAuditLogRow[] = records.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actorUserId: r.actorUserId,
    actorFullName: r.actorUser?.fullName ?? null,
    actorEmail: r.actorUser?.email ?? null,
    metadata: r.metadata,
    createdAt: r.createdAt,
  }));

  return { logs, total };
}

export interface PlatformStats {
  usersByRole: {
    clients: number;
    consultants: number;
    admins: number;
    total: number;
  };
  pendingConsultantApplications: number;
  appointmentsByStatus: {
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
    total: number;
  };
  bookingsLast30Days: number;
  completionRatePercent: number;
}

export async function getPlatformStatistics(): Promise<PlatformStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [
    clientCount,
    consultantCount,
    adminCount,
    pendingConsultants,
    appointmentGroups,
    bookings30Days,
  ] = await Promise.all([
    db.user.count({ where: { role: "CLIENT" } }),
    db.user.count({ where: { role: "CONSULTANT" } }),
    db.user.count({ where: { role: "ADMIN" } }),
    db.consultantProfile.count({ where: { verificationStatus: "PENDING" } }),
    db.appointment.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.appointment.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const group of appointmentGroups) {
    statusCounts[group.status] = group._count.status;
  }

  const pending = statusCounts.PENDING ?? 0;
  const confirmed = statusCounts.CONFIRMED ?? 0;
  const completed = statusCounts.COMPLETED ?? 0;
  const cancelled = statusCounts.CANCELLED ?? 0;
  const noShow = statusCounts.NO_SHOW ?? 0;
  const totalAppointments = pending + confirmed + completed + cancelled + noShow;

  const resolvedAppointments = completed + noShow + cancelled;
  const completionRatePercent =
    resolvedAppointments > 0 ? Math.round((completed / resolvedAppointments) * 100) : 100;

  return {
    usersByRole: {
      clients: clientCount,
      consultants: consultantCount,
      admins: adminCount,
      total: clientCount + consultantCount + adminCount,
    },
    pendingConsultantApplications: pendingConsultants,
    appointmentsByStatus: {
      pending,
      confirmed,
      completed,
      cancelled,
      noShow,
      total: totalAppointments,
    },
    bookingsLast30Days: bookings30Days,
    completionRatePercent,
  };
}
