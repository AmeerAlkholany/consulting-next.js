import { describe, expect, it } from "vitest";
import { capitalize, formatInitials, truncate } from "@/lib/format";

describe("capitalize", () => {
  it("uppercases the first character and leaves the rest alone", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("HELLO")).toBe("HELLO");
  });

  it("returns an empty string for empty input", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("truncate", () => {
  it("returns the input unchanged when it already fits", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("exactly10!", 10)).toBe("exactly10!");
  });

  it("counts the ellipsis inside the limit", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
    expect(truncate("abcdefghij", 5)).toHaveLength(5);
  });

  it("accepts a custom suffix", () => {
    expect(truncate("abcdefghij", 6, "...")).toBe("abc...");
  });
});

describe("formatInitials", () => {
  it("uses the first letter of the first two words", () => {
    expect(formatInitials("Ameer Alkholany")).toBe("AA");
  });

  it("ignores extra whitespace and words beyond the second", () => {
    expect(formatInitials("  ada   byron  lovelace ")).toBe("AB");
  });

  it("returns an empty string when there is nothing to shorten", () => {
    expect(formatInitials("")).toBe("");
  });
});
