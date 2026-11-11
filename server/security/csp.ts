import crypto from "crypto";

/**
 * Generates a cryptographically strong 128-bit base64-encoded nonce for CSP.
 */
export function generateCspNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

/**
 * Generates the strict Content-Security-Policy header value for a given request nonce (ARCHITECTURE.md §16).
 */
export function generateCspHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ];

  return directives.join("; ");
}
