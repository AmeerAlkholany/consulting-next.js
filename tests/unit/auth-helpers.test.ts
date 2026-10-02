import { describe, expect, it } from "vitest";
import { passwordPolicy } from "@/config/security";
import { assessPasswordStrength, describePasswordRequirements } from "@/lib/password-strength";
import { isSafeRedirectPath, safeRedirectPath } from "@/lib/redirects";

describe("assessPasswordStrength", () => {
  it("reports an empty password as unusable", () => {
    const strength = assessPasswordStrength("");

    expect(strength.score).toBe(0);
    expect(strength.isAcceptable).toBe(false);
  });

  it("names the length rule while a short password is being typed", () => {
    const strength = assessPasswordStrength("Abc1");

    expect(strength.isAcceptable).toBe(false);
    expect(strength.missing.join(" ")).toContain(`at least ${passwordPolicy.minLength}`);
  });

  it("names the missing character classes", () => {
    const strength = assessPasswordStrength("alllowercaseandlong");

    expect(strength.isAcceptable).toBe(false);
    expect(strength.missing.join(" ")).toContain("an uppercase letter");
    expect(strength.satisfied).toContain("lowercase");
  });

  it("accepts a password that satisfies every rule", () => {
    const strength = assessPasswordStrength("Correct-Horse-42");

    expect(strength.isAcceptable).toBe(true);
    expect(strength.score).toBeGreaterThanOrEqual(2);
    expect(strength.missing).toEqual([]);
  });

  it("scores a long, mixed password higher than a merely acceptable one", () => {
    expect(assessPasswordStrength("Longer-And-Mixed-2026!").score).toBeGreaterThan(
      assessPasswordStrength("Abcdefghij1!").score,
    );
  });

  it("zeroes a password from the deny-list", () => {
    const strength = assessPasswordStrength("Qwerty123456");

    expect(strength.score).toBe(0);
    expect(strength.isAcceptable).toBe(false);
  });

  it("describes the whole policy in one sentence", () => {
    expect(describePasswordRequirements()).toContain(String(passwordPolicy.minLength));
  });
});

describe("safeRedirectPath", () => {
  it("keeps a same-origin relative path", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/appointments?tab=past")).toBe("/appointments?tab=past");
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("refuses a protocol-relative path", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
  });

  it("refuses an absolute URL", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
  });

  it("refuses a backslash-smuggled path", () => {
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
  });

  it("refuses empty, whitespace, and control-character input", () => {
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
    expect(safeRedirectPath("/two words")).toBe("/");
    expect(safeRedirectPath("/line\nbreak")).toBe("/");
  });

  it("refuses an unreasonable length", () => {
    expect(safeRedirectPath(`/${"a".repeat(600)}`)).toBe("/");
  });

  it("honours the caller's fallback", () => {
    expect(safeRedirectPath("//evil.com", "/login")).toBe("/login");
  });
});
