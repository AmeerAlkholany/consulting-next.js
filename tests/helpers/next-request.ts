/**
 * A fake Next.js request for the integration suites (IMPLEMENTATION.md Step 4,
 * "Testing requirements").
 *
 * The authentication flows are tested by calling the real Server Actions and the
 * real services — nothing is stubbed below the request boundary. What is faked
 * is only the *request*: a cookie jar, the headers the auth layer reads, and the
 * `redirect` / `revalidatePath` calls an action makes, because those belong to
 * the framework rather than to the rules under test.
 *
 * Each suite registers these with `vi.mock("next/headers", ...)` etc.; both the
 * factory and the test import this module, and Vitest's module registry hands
 * them the same instance, which is why the recorded state is observable.
 */

export interface RecordedCookie {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

export const requestState = {
  ip: "203.0.113.10",
  userAgent: "vitest-agent/1.0",
  cookies: new Map<string, string>(),
  cookieWrites: [] as RecordedCookie[],
  cookieDeletes: [] as string[],
  redirects: [] as string[],
  revalidated: [] as string[],
};

/** Thrown by the `redirect` mock so an action stops exactly as it would in Next. */
export class RedirectSignal extends Error {
  readonly destination: string;

  constructor(destination: string) {
    super(`NEXT_REDIRECT:${destination}`);
    this.name = "RedirectSignal";
    this.destination = destination;
  }
}

/**
 * Clears the jar and the recorded calls, and gives the request a fresh address:
 * the auth rate limiters are keyed by address hash, so a new test must not
 * inherit another test's budget (or spend it).
 */
export function resetRequestState(ip = `203.0.113.${1 + Math.floor(Math.random() * 250)}`): void {
  requestState.ip = ip;
  requestState.userAgent = "vitest-agent/1.0";
  requestState.cookies.clear();
  requestState.cookieWrites = [];
  requestState.cookieDeletes = [];
  requestState.redirects = [];
  requestState.revalidated = [];
}

export function readRequestCookie(name: string): string | undefined {
  return requestState.cookies.get(name);
}

export function latestCookieWrite(): RecordedCookie | undefined {
  return requestState.cookieWrites.at(-1);
}

export function createCookiesMock(): () => Promise<unknown> {
  return async () => ({
    get: (name: string) =>
      requestState.cookies.has(name) ? { name, value: requestState.cookies.get(name) } : undefined,
    has: (name: string) => requestState.cookies.has(name),
    set: (
      nameOrCookie: string | { name: string; value: string; [key: string]: unknown },
      value?: string,
      options?: Record<string, unknown>,
    ) => {
      const name = typeof nameOrCookie === "string" ? nameOrCookie : nameOrCookie.name;
      const cookieValue = typeof nameOrCookie === "string" ? (value ?? "") : nameOrCookie.value;
      const cookieOptions =
        typeof nameOrCookie === "string" ? options : (nameOrCookie as Record<string, unknown>);

      requestState.cookies.set(name, cookieValue);
      requestState.cookieWrites.push({ name, value: cookieValue, options: cookieOptions });
    },
    delete: (name: string) => {
      requestState.cookies.delete(name);
      requestState.cookieDeletes.push(name);
    },
  });
}

export function createHeadersMock(): () => Promise<Headers> {
  return async () =>
    new Headers({
      "x-forwarded-for": requestState.ip,
      "user-agent": requestState.userAgent,
    });
}

export function createNavigationMock(): { redirect: (destination: string) => never } {
  return {
    redirect: (destination: string): never => {
      requestState.redirects.push(String(destination));
      throw new RedirectSignal(String(destination));
    },
  };
}

export function createCacheMock(): { revalidatePath: (path: string) => void } {
  return {
    revalidatePath: (path: string) => {
      requestState.revalidated.push(path);
    },
  };
}

/**
 * Runs something that is expected to redirect and returns where it went, or
 * null when it returned normally.
 */
export async function captureRedirect(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
  } catch (error) {
    if (error instanceof RedirectSignal) {
      return error.destination;
    }
    throw error;
  }

  return null;
}

/**
 * Pulls the raw token back out of a queued email link. This is how the suites
 * walk a verification or reset flow the way a person would — from the message —
 * without the service ever handing the token to its caller.
 */
export function extractTokenFromLink(link: string): string {
  const token = link.split("/").filter(Boolean).at(-1);

  if (!token) {
    throw new Error(`No token found in link: ${link}`);
  }

  return token;
}
