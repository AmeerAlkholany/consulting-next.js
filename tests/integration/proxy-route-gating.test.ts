import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { matchesPrefix, proxy } from "@/proxy";

/**
 * Route gating (ARCHITECTURE.md §10, proxy.ts).
 *
 * Regression: `/consultant` used to be matched with `String.startsWith`, which
 * also captured the public `/consultants` discovery route and redirected
 * anonymous visitors to `/login`. These tests pin the segment-boundary rule and
 * the two redirect behaviours the proxy owns.
 */

function makeRequest(pathname: string, session?: string): NextRequest {
  const request = new NextRequest(new URL(pathname, "http://localhost:3000"));
  if (session) {
    request.cookies.set("session", session);
  }
  return request;
}

describe("matchesPrefix", () => {
  it("matches the prefix itself and its descendants", () => {
    expect(matchesPrefix("/consultant", "/consultant")).toBe(true);
    expect(matchesPrefix("/consultant/appointments", "/consultant")).toBe(true);
  });

  it("does not match a sibling route that merely shares the string prefix", () => {
    expect(matchesPrefix("/consultants", "/consultant")).toBe(false);
    expect(matchesPrefix("/consultants/acme", "/consultant")).toBe(false);
    expect(matchesPrefix("/dashboard-archive", "/dashboard")).toBe(false);
  });
});

describe("proxy route protection", () => {
  it("lets anonymous visitors reach the public consultant directory", async () => {
    const response = await proxy(makeRequest("/consultants"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("lets anonymous visitors reach a public consultant profile", async () => {
    const response = await proxy(makeRequest("/consultants/dr-acme"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects anonymous visitors away from the consultant shell", async () => {
    const response = await proxy(makeRequest("/consultant"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fconsultant");
  });

  it("redirects anonymous visitors away from consultant sub-routes", async () => {
    const response = await proxy(makeRequest("/consultant/appointments"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=");
  });

  it("redirects anonymous visitors away from the client dashboard", async () => {
    const response = await proxy(makeRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Fdashboard");
  });

  it("sends signed-in users away from auth-only pages", async () => {
    const response = await proxy(makeRequest("/login", "opaque-session-token"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("lets anonymous visitors reach auth-only pages", async () => {
    const response = await proxy(makeRequest("/login"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("attaches a request id to every response", async () => {
    const response = await proxy(makeRequest("/"));

    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f]{32}$/);
  });
});
