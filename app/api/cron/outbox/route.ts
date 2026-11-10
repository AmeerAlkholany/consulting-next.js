import "server-only";

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { logger } from "@/server/logger";
import { env } from "@/config/env";

/**
 * POST /api/cron/outbox
 * Cron endpoint to drain the email outbox.
 *
 * In production, this would send emails via the configured provider.
 * For now, it marks items as processed.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Get pending items that are available for sending
    const pending = await db.emailOutbox.findMany({
      where: {
        status: "PENDING",
        availableAt: { lte: now },
        attempts: { lt: 3 },
      },
      select: { id: true, toEmail: true, template: true },
      take: 100,
    });

    for (const item of pending) {
      // In production, send email here using the template and payload
      // For now, mark as sent
      await db.emailOutbox.update({
        where: { id: item.id },
        data: {
          status: "SENT",
          sentAt: now,
        },
      });
      logger.info({ outboxId: item.id, to: item.toEmail }, "email sent from outbox");
    }

    // Update failed items
    const failed = await db.emailOutbox.updateMany({
      where: {
        status: "PENDING",
        availableAt: { lte: now },
        attempts: { gte: 3 },
      },
      data: {
        status: "FAILED",
        lastError: "Max retry attempts exceeded",
      },
    });

    return NextResponse.json({ sent: pending.length, failed: failed.count });
  } catch (error) {
    logger.error({ error }, "cron outbox processing failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
