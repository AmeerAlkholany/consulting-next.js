import { describe, expect, it } from "vitest";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  getHttpStatusForError,
  NotFoundError,
  RateLimitError,
  UnprocessableError,
  ValidationError,
} from "@/server/errors";

describe("AppError subclasses", () => {
  it("carry a code, an HTTP status, and a safe message", () => {
    const cases: Array<{ error: AppError; code: string; status: number }> = [
      { error: new ValidationError("Email is invalid"), code: "VALIDATION_ERROR", status: 400 },
      { error: new AuthenticationError(), code: "AUTHENTICATION_ERROR", status: 401 },
      { error: new AuthorizationError(), code: "AUTHORIZATION_ERROR", status: 403 },
      { error: new NotFoundError(), code: "NOT_FOUND", status: 404 },
      { error: new ConflictError(), code: "CONFLICT", status: 409 },
      { error: new UnprocessableError(), code: "UNPROCESSABLE", status: 422 },
      { error: new RateLimitError(30), code: "RATE_LIMITED", status: 429 },
    ];

    for (const { error, code, status } of cases) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(code);
      expect(error.httpStatus).toBe(status);
      expect(error.safeMessage.length).toBeGreaterThan(0);
    }
  });

  it("never exposes anything beyond the safe message", () => {
    const error = new ValidationError("Please check the highlighted fields.");
    expect(error.message).toBe(error.safeMessage);
    expect(error.message).not.toMatch(/at \w+ \(/);
  });

  it("keeps field errors for form mapping", () => {
    const error = new ValidationError("Check the form", {
      email: ["Enter a valid email address."],
    });
    expect(error.fieldErrors).toEqual({ email: ["Enter a valid email address."] });
    expect(new ValidationError().fieldErrors).toBeUndefined();
  });

  it("reports the retry delay for rate limiting", () => {
    expect(new RateLimitError(45).retryAfter).toBe(45);
    expect(new RateLimitError().retryAfter).toBe(60);
  });

  it("names each subclass for logging", () => {
    expect(new ValidationError().name).toBe("ValidationError");
    expect(new NotFoundError().name).toBe("NotFoundError");
    expect(new AppError({ code: "INTERNAL_ERROR", httpStatus: 500, safeMessage: "x" }).name).toBe(
      "AppError",
    );
  });
});

describe("getHttpStatusForError", () => {
  it("returns the error's own status for AppError instances", () => {
    expect(getHttpStatusForError(new NotFoundError())).toBe(404);
    expect(getHttpStatusForError(new RateLimitError(10))).toBe(429);
  });

  it("falls back to 500 for anything else", () => {
    expect(getHttpStatusForError(new Error("boom"))).toBe(500);
    expect(getHttpStatusForError("nope")).toBe(500);
    expect(getHttpStatusForError(undefined)).toBe(500);
  });
});
