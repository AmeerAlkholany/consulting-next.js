/**
 * Same-origin redirect validation (ARCHITECTURE.md §10, §16).
 *
 * Every `?next=` value is attacker-controlled: it arrives from a link anyone
 * can compose. It is only ever used after passing through here, which is what
 * keeps `/login?next=https://evil.com` from turning the sign-in page into an
 * open redirect. Framework-free so both a Server Component (the page) and a
 * Server Action (the post-login hop) can call it.
 */

const MAX_LENGTH = 512;

/**
 * A path is safe when it is relative to this origin: it starts with a single
 * `/`, carries no backslash (which some proxies normalise to `/`), no control
 * characters or whitespace, and no scheme.
 */
export function isSafeRedirectPath(value: string | null | undefined): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) {
    return false;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return false;
  }

  
  if (/[\u0000-\u001F\u007F]/.test(value) || /\s/.test(value) || value.includes("\\")) {
    return false;
  }

  return true;
}

/**
 * Returns the validated path, or `fallback` when the value is absent or unsafe.
 * `/`, `/dashboard?tab=past` and `/consultants/some-slug` pass; `//evil.com`,
 * `https://evil.com`, `javascript:alert(1)`, `/\evil.com` and `` do not.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  return isSafeRedirectPath(value) ? (value as string) : fallback;
}

/**
 * Where a signed-in person lands when no `?next=` was supplied.
 *
 * ARCHITECTURE.md §29 defines a role-specific landing page — `/dashboard`,
 * `/consultant`, `/admin` — and those route groups are built in Step 5. Until
 * they exist, a redirect into them would be a 404, so every role lands on the
 * home page, which greets them by name and shows the next action. Step 5
 * replaces this constant with the role map from `config/roles.ts` and updates
 * the assertion in `tests/integration/auth-actions.test.ts`.
 */
export const SIGNED_IN_LANDING_PATH = "/";

