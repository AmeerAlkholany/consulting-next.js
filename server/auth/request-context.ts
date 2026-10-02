import "server-only";

import { headers } from "next/headers";
import { sessionPolicy } from "@/config/security";
import { hashIpAddress } from "./tokens";

/**
 * The request facts authentication needs: who is calling, and from where.
 *
 * Read through `next/headers` so it works in a Server Component, a Server
 * Action, and a Route Handler alike (all three are async in Next.js 16).
 * Nothing here reaches a log line or a response body: the address is hashed
 * (`Session.ipHash`, rate-limit keys) and the user agent is truncated to the
 * column it is stored in (§16, §17).
 */

export interface AuthRequestContext {
  /** Best-effort client address, or `"unknown"`. */
  ipAddress: string;
  /** SHA-256 of the address, safe to store and to log. */
  ipHash: string;
  /** Truncated to `Session.userAgent`'s 200 characters. */
  userAgent: string | null;
}

/**
 * `x-forwarded-for` is a list appended to by each proxy; the leftmost entry is
 * the client as seen by the first trusted hop. It is only trustworthy behind a
 * proxy that overwrites it, which is the deployment this platform documents
 * (§26): every rate limit and anomaly signal below is a defence in depth
 * measure, never the only control.
 */
function readForwardedAddress(headerList: Headers): string | null {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    const candidate = first?.trim();
    if (candidate) {
      return candidate;
    }
  }

  return headerList.get("x-real-ip")?.trim() ?? null;
}

export async function readAuthRequestContext(): Promise<AuthRequestContext> {
  const headerList = await headers();
  const ipAddress = readForwardedAddress(headerList) ?? "unknown";
  const userAgent = headerList.get("user-agent");

  return {
    ipAddress,
    ipHash: hashIpAddress(ipAddress),
    userAgent: userAgent ? userAgent.slice(0, sessionPolicy.userAgentMaxLength) : null,
  };
}
