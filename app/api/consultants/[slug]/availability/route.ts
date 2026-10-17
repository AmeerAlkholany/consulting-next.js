import { NextRequest, NextResponse } from "next/server";
import { getPublicAvailability } from "@/server/services/availability";
import { availabilityQuerySchema } from "@/schemas/availability";
import { createRateLimiter, authRateLimits } from "@/server/rate-limit";
import { readAuthRequestContext } from "@/server/auth/request-context";

const limiter = createRateLimiter(authRateLimits.discoverySearch);

/**
 * GET /api/consultants/[slug]/availability?from&to&tz
 * Public endpoint for slot picker - returns free slots.
 * Rate-limited, range capped at 31 days.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const ctx = await readAuthRequestContext();
  const result = await limiter.consume(ctx.ipHash);

  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  const parsed = availabilityQuerySchema.safeParse({
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    tz: searchParams.get("tz") ?? "UTC",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_RANGE" }, { status: 400 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);

  const availability = await getPublicAvailability(slug, from, to, parsed.data.tz);

  if (!availability) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Convert slot instants to viewer's timezone for display
  const days = availability.days.map((day) => ({
    date: day.date,
    slots: day.slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    })),
  }));

  return NextResponse.json({
    data: {
      timezone: availability.timezone,
      viewerTimezone: parsed.data.tz,
      days,
    },
  });
}
