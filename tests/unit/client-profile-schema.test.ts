import { describe, expect, it } from "vitest";
import { clientProfileSchema, changePasswordSchema } from "@/schemas/client-profile";
import { fieldErrorsFromZodError } from "@/schemas/common";

/**
 * Client profile validation rules (IMPLEMENTATION.md Step 6, "Validation
 * requirements").
 */

const baseProfile = {
  displayName: "Dana Klein",
  fullName: "Dana Klein",
  timezone: "Europe/Berlin",
  languageIds: ["en", "de"],
};

describe("clientProfileSchema", () => {
  it("accepts a valid profile update", () => {
    const result = clientProfileSchema.safeParse({
      ...baseProfile,
      phone: "+4915112345678",
      dateOfBirth: "1990-05-15",
      emergencyContactName: "Test Contact",
      emergencyContactPhone: "+4915112345679",
    });

    expect(result.success).toBe(true);
  });

  it("allows null phone and emergency fields", () => {
    const result = clientProfileSchema.safeParse(baseProfile);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
    }
  });

  it("rejects a display name shorter than 2 characters", () => {
    const result = clientProfileSchema.safeParse({ ...baseProfile, displayName: "A" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors?.displayName).toContainEqual(
        expect.stringContaining("at least 2"),
      );
    }
  });

  it("rejects a display name longer than 50 characters", () => {
    const result = clientProfileSchema.safeParse({
      ...baseProfile,
      displayName: "A".repeat(51),
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid E.164 phone number", () => {
    const result = clientProfileSchema.safeParse({
      ...baseProfile,
      phone: "123-456-7890",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors?.phone).toBeTruthy();
    }
  });

  it("accepts a valid E.164 phone number", () => {
    const result = clientProfileSchema.safeParse({
      ...baseProfile,
      phone: "+1234567890",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a date of birth that is not a valid date", () => {
    const result = clientProfileSchema.safeParse({
      ...baseProfile,
      dateOfBirth: "not-a-date",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a date of birth under 16 years old", () => {
    const result = clientProfileSchema.safeParse({
      ...baseProfile,
      dateOfBirth: "2020-01-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors?.dateOfBirth).toContainEqual(
        expect.stringContaining("16"),
      );
    }
  });

  it("accepts a date of birth exactly 16 years ago", () => {
    const sixTeenYearsAgo = new Date(Date.now() - 16 * 365.25 * 24 * 60 * 60 * 1000);
    const dateStr = sixTeenYearsAgo.toISOString().slice(0, 10);

    const result = clientProfileSchema.safeParse({
      ...baseProfile,
      dateOfBirth: dateStr,
    });

    expect(result.success).toBe(true);
  });

  it("rejects emergency contact phone without a name", () => {
    const result = clientProfileSchema.safeParse({
      ...baseProfile,
      emergencyContactName: undefined,
      emergencyContactPhone: "+4915112345678",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors?.emergencyContactName).toBeTruthy();
    }
  });

  it("accepts emergency contact phone with a name", () => {
    const result = clientProfileSchema.safeParse({
      ...baseProfile,
      emergencyContactName: "Test Contact",
      emergencyContactPhone: "+4915112345678",
    });

    expect(result.success).toBe(true);
  });
});

describe("changePasswordSchema", () => {
  it("accepts a valid password change", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Correct-Horse-42",
      newPassword: "Secure-Pass-99!",
      confirmPassword: "Secure-Pass-99!",
    });

    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Correct-Horse-42",
      newPassword: "Secure-Pass-99!",
      confirmPassword: "Different-Pass!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors?.confirmPassword).toBeTruthy();
    }
  });

  it("rejects a weak new password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Correct-Horse-42",
      newPassword: "weak",
      confirmPassword: "weak",
    });

    expect(result.success).toBe(false);
  });
});
