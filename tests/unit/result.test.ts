import { describe, expect, it } from "vitest";
import { err, isErr, isOk, ok, type Result } from "@/types/result";

describe("Result helpers", () => {
  it("builds a success value", () => {
    const result = ok({ id: "abc" });
    expect(result).toEqual({ ok: true, data: { id: "abc" } });
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("builds a failure value", () => {
    const result = err({ code: "NOT_FOUND", message: "Missing" });
    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "Missing" } });
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });

  it("narrows the union so the payload is only reachable after the check", () => {
    const result: Result<number> = ok(42);
    let seen: number | null = null;
    if (isOk(result)) {
      seen = result.data;
    }
    expect(seen).toBe(42);
  });

  it("carries field errors on the failure branch", () => {
    const result: Result<never> = err({
      code: "VALIDATION_ERROR",
      message: "Check the form",
      fieldErrors: { email: ["Enter a valid email address."] },
    });

    if (isErr(result)) {
      expect(result.error.fieldErrors?.email).toEqual(["Enter a valid email address."]);
    } else {
      throw new Error("expected a failure result");
    }
  });
});
