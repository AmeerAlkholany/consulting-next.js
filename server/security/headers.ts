import { generateCspHeader } from "./csp";

export interface SecurityHeadersOptions {
  nonce?: string;
  isPrivate?: boolean;
}

/**
 * Platform security headers (ARCHITECTURE.md §16).
 */
export function getSecurityHeaders(options: SecurityHeadersOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    // Enforce HTTPS with preloading for 2 years
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    // Strict referrer privacy
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Restrict access to sensitive browser features
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    // Prevent clickjacking alongside frame-ancestors
    "X-Frame-Options": "DENY",
  };

  // Content-Security-Policy with nonce
  if (options.nonce) {
    headers["Content-Security-Policy"] = generateCspHeader(options.nonce);
  }

  // Prevent indexing on authenticated and private surfaces
  if (options.isPrivate) {
    headers["X-Robots-Tag"] = "noindex, nofollow";
  }

  return headers;
}

