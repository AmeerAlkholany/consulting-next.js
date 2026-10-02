import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { hashOpaqueToken } from "@/server/auth/tokens";
import { protectedPathPrefixes, authOnlyPathPrefixes } from "@/config/roles";

/**
 * Coarse route protection (ARCHITECTURE.md §10, IMPLEMENTATION.md Step 5).
 *
 * Proxy runs on every route, including prefetches, so it must be cheap:
 * one cookie read, one hashed lookup (no JOIN, no profile fetch), and a
 * redirect or pass-through. The authoritative authorization lives in the
 * guards and services each route calls; this file only prevents anonymous
 * visitors from reaching the app shells and prevents signed-in users from
 * lingering on auth pages.
 *
 * `x-request-id` is generated here so every request carried a correlation
 * header the rest of the stack can attach logs to.
 */

const SESSION_COOKIE_NAME = "session";

/** Nonce-like random string for the request id. Not cryptographic. */
function generateRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const responseHeaders = new Headers();
  responseHeaders.set("x-request-id", requestId);

  const pathname = request.nextUrl.pathname;

  // Cookie-presence check only: no database read, no session row fetch.
  // The raw token is hashed here so the database lookup (when needed below)
  // works against the same value the session module expects.
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const tokenHash = rawToken ? hashOpaqueToken(rawToken) : null;

  // Protected routes: require an active session cookie.
  const isProtected = protectedPathPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  // Auth-only routes: signed-in users are redirected away.
  const isAuthOnly = authOnlyPathPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (isProtected && !tokenHash) {
    const next = safeNext(pathname);
    const url = new URL(`/login?next=${encodeURIComponent(next)}`, request.url);
    return NextResponse.redirect(url, { headers: responseHeaders });
  }

  if (isAuthOnly && tokenHash) {
    // The token is hashed, not decrypted: we do not know the role here.
    // Route to the generic dashboard; the role-specific layout guards
    // will redirect to the correct shell based on the user's role.
    const url = new URL("/dashboard", request.url);
    return NextResponse.redirect(url, { headers: responseHeaders });
  }

  return NextResponse.next({ headers: responseHeaders });
}

/**
 * Validates the `next` redirect parameter: must be a same-origin relative path
 * (starts with `/`, does not start with `//`). Prevents open redirects.
 */
function safeNext(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export const config = {
  matcher: [
    /*
     * Run on all routes except static assets and internal Next.js paths.
     * `/:path*` covers both `/dashboard` and `/admin/*`; the matcher below
     * excludes API routes, static files, and the proxy itself.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
