import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { hashOpaqueToken } from "@/server/auth/tokens";
import { protectedPathPrefixes, authOnlyPathPrefixes } from "@/config/roles";
import { generateCspNonce, generateCspHeader } from "@/server/security/csp";
import { getSecurityHeaders } from "@/server/security/headers";

/**
 * Coarse route protection and security header injection (ARCHITECTURE.md §10, §16).
 *
 * Proxy runs on every route, including prefetches:
 * - Injects cryptographically random CSP nonce into request and response headers.
 * - Sets strict security headers (CSP, HSTS, X-Content-Type-Options, etc.).
 * - Adds X-Robots-Tag: noindex to protected/authenticated routes.
 * - Ensures request correlation via x-request-id.
 */

const SESSION_COOKIE_NAME = "session";

/** Nonce-like random string for the request id. */
function generateRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const cspNonce = generateCspNonce();
  const pathname = request.nextUrl.pathname;

  // Clone request headers so downstream Server Components can read x-nonce and x-request-id
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", cspNonce);

  // Cookie-presence check only: no database read, no session row fetch.
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const tokenHash = rawToken ? hashOpaqueToken(rawToken) : null;

  // Protected routes: require an active session cookie.
  const isProtected = protectedPathPrefixes.some((prefix) => matchesPrefix(pathname, prefix));

  // Auth-only routes: signed-in users are redirected away.
  const isAuthOnly = authOnlyPathPrefixes.some((prefix) => matchesPrefix(pathname, prefix));

  // Build security headers
  const securityHeaders = getSecurityHeaders({
    nonce: cspNonce,
    isPrivate: isProtected,
  });

  const responseHeaders = new Headers();
  responseHeaders.set("x-request-id", requestId);
  responseHeaders.set("x-nonce", cspNonce);

  for (const [key, value] of Object.entries(securityHeaders)) {
    responseHeaders.set(key, value);
  }

  // Set CSP header explicitly
  responseHeaders.set("Content-Security-Policy", generateCspHeader(cspNonce));

  if (isProtected && !tokenHash) {
    const next = safeNext(pathname);
    const url = new URL(`/login?next=${encodeURIComponent(next)}`, request.url);
    return NextResponse.redirect(url, { headers: responseHeaders });
  }

  if (isAuthOnly && tokenHash) {
    const url = new URL("/dashboard", request.url);
    return NextResponse.redirect(url, { headers: responseHeaders });
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
    headers: responseHeaders,
  });
}

/**
 * Matches a path against a route prefix on segment boundaries, so `/consultant`
 * does not also capture the public `/consultants` discovery route.
 */
export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
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
