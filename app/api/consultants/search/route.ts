import { NextRequest, NextResponse } from "next/server";
import { searchConsultants, searchConsultantsTypeahead } from "@/server/dal/consultant-search";
import { consultantSearchSchema, typeaheadQuerySchema } from "@/schemas/consultant-search";
import { createRateLimiter, authRateLimits } from "@/server/rate-limit";
import { readAuthRequestContext } from "@/server/auth/request-context";

const limiter = createRateLimiter(authRateLimits.discoverySearch);

/**
 * GET /api/consultants/search?q=...&specializationIds=...&...
 * Public consultant search with full filtering.
 * Rate-limited, returns paginated results.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await readAuthRequestContext();
  const result = await limiter.consume(ctx.ipHash);

  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { searchParams } = new URL(request.url);

  // Check if it's a typeahead request (only q param)
  const isTypeahead = searchParams.size === 1 && searchParams.has("q");

  if (isTypeahead) {
    const parsed = typeaheadQuerySchema.safeParse({ q: searchParams.get("q") ?? "" });
    if (!parsed.success) {
      return NextResponse.json({ consultants: [] });
    }
    const consultants = await searchConsultantsTypeahead(parsed.data.q);
    return NextResponse.json({
      consultants: consultants.map((c) => ({
        id: c.id,
        slug: c.slug,
        headline: c.headline,
        fullName: c.fullName,
      })),
    });
  }

  // Full search with filters
  const parsed = consultantSearchSchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ consultants: [], total: 0 });
  }

  const { consultants, total } = await searchConsultants(parsed.data);

  return NextResponse.json({
    consultants,
    total,
  });
}