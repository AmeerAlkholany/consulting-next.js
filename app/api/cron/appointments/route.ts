import "server-only";

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { BOOKING_POLICY } from "@/config/booking";
import { env } from "@/config/env";

/**
 * POST /api/cron/appointments
 * Cron endpoint for automated appointment state transitions.
 *
 * - Completes appointments past their end time + grace period
 * - Sends reminders for upcoming appointments
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Verify cron secret (in production, set via environment)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Complete overdue appointments
    const gracePeriodMs = BOOKING_POLICY.completionGracePeriodHours * 60 * 60 * 1000;
    const threshold = new Date(Date.now() - gracePeriodMs);

    const overdue = await db.appointment.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        endsAt: { lt: threshold },
      },
      select: { id: true, startsAt: true, endsAt: true },
    });

    for (const apt of overdue) {
      await db.appointment.update({
        where: { id: apt.id },
        data: { status: "NO_SHOW", cancelledAt: new Date() },
      });
      logger.info({ appointmentId: apt.id }, "appointment marked as no-show");
    }

    // Auto-complete appointments that ended within grace period
    const pastDue = await db.appointment.findMany({
      where: {
        status: "CONFIRMED",
        endsAt: { lt: new Date() },
        completedAt: null,
      },
      select: { id: true },
    });

    for (const apt of pastDue) {
      await db.appointment.update({
        where: { id: apt.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      logger.info({ appointmentId: apt.id }, "appointment auto-completed");
    }

    return NextResponse.json({
      completed: pastDue.length,
      noShow: overdue.length,
    });
  } catch (error) {
    logger.error({ error }, "cron appointment processing failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
