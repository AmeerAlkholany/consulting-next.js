import { NextResponse } from "next/server";
import { db } from "@/db/client";

/**
 * GET /api/health
 * Health check endpoint for load balancers and deployment monitors.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
