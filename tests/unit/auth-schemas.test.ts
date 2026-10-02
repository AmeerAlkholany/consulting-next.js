import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  requestResetSchema,
  resetPasswordSchema,
  tokenParamSchema,
} from "@/schemas/auth";
import { fieldErrorsFromZodError } from "@/schemas/common";

/**
 * The registration contract (IMPLEMENTATION.md Step 4, "Validation
 * requirements"). These are the assertions that make `ADMIN` non-self-
 * assignable and the password rule real rather than advisory: the same schemas
 * run in the browser and in the Server Action, so a crafted POST is rejected by
 * exactly these rules.
 */

const validRegistration = {
  fullName: "Dana Klein",
  email: "dana@example.com",
  password: "Correct-Horse-42",
  confirmPassword: "Correct-Horse-42",
  role: "CLIENT" as const,
  acceptTerms: true,
  timezone: "Europe/Berlin",
};

describe("registerSchema", () => {
  it("accepts a complete registration", () => {
    const result = registerSchema.safeParse(validRegistration);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("CLIENT");
      expect(result.data.timezone).toBe("Europe/Berlin");
    }
  });

  it("trims the full name", () => {
    const result = registerSchema.safeParse({ ...validRegistration, fullName: "  Dana Klein  " });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Dana Klein");
    }
  });

  it("rejects ADMIN as a registration role", () => {
    const result = registerSchema.safeParse({ ...validRegistration, role: "ADMIN" });

    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than the pinned minimum", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "Sh0rt-Pass",
      confirmPassword: "Sh0rt-Pass",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZodError(result.error).password?.[0]).toContain("at least 12");
    }
  });

  it("rejects a long password that mixes too few character classes", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "onlylowercaseletters",
      confirmPassword: "onlylowercaseletters",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZodError(result.error).password?.join(" ")).toContain("at least 3 of");
    }
  });

  it("rejects a password from the deny-list", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "Qwerty123456",
      confirmPassword: "Qwerty123456",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZodError(result.error).password?.join(" ")).toContain("commonly used");
    }
  });

  it("rejects a password built from the account's own email address", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "Danaklein-2026!",
      confirmPassword: "Danaklein-2026!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZodError(result.error).password?.join(" ")).toContain(
        "your email address",
      );
    }
  });

  it("reports a mismatched confirmation on the confirmation field", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: "Correct-Horse-43",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZodError(result.error).confirmPassword?.[0]).toBe(
        "The two passwords do not match.",
      );
    }
  });

  it("requires the terms to be accepted", () => {
    const result = registerSchema.safeParse({ ...validRegistration, acceptTerms: false });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZodError(result.error).acceptTerms).toHaveLength(1);
    }
  });

  it("rejects an invalid email address", () => {
    const result = registerSchema.safeParse({ ...validRegistration, email: "not-an-email" });

    expect(result.success).toBe(false);
  });

  it("allows an empty timezone for a form submitted without JavaScript", () => {
    const result = registerSchema.safeParse({ ...validRegistration, timezone: "" });

    expect(result.success).toBe(true);
  });

  it("rejects a timezone that is not in the IANA set", () => {
    const result = registerSchema.safeParse({ ...validRegistration, timezone: "Mars/Olympus" });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts an email and a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "dana@example.com", password: "anything" }).success).toBe(
      true,
    );
  });

  it("does not apply the strength rule to an existing password", () => {
    // Legacy passwords may predate the current policy; only registration and
    // reset are gated on strength.
    expect(loginSchema.safeParse({ email: "dana@example.com", password: "old" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "dana@example.com", password: "" }).success).toBe(false);
  });
});

describe("requestResetSchema", () => {
  it("accepts an email and rejects anything else", () => {
    expect(requestResetSchema.safeParse({ email: "dana@example.com" }).success).toBe(true);
    expect(requestResetSchema.safeParse({ email: "dana" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a token with a strong password pair", () => {
    const result = resetPasswordSchema.safeParse({
      token: "a".repeat(43),
      password: "Correct-Horse-42",
      confirmPassword: "Correct-Horse-42",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a mismatched confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      token: "a".repeat(43),
      password: "Correct-Horse-42",
      confirmPassword: "Correct-Horse-43",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZodError(result.error).confirmPassword).toBeDefined();
    }
  });
});

describe("tokenParamSchema", () => {
  it("accepts a 43-character base64url token", () => {
    expect(tokenParamSchema.safeParse("A".repeat(43)).success).toBe(true);
  });

  it("rejects a truncated token", () => {
    expect(tokenParamSchema.safeParse("short").success).toBe(false);
  });
});
