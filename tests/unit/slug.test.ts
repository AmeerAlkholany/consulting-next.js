import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases words and joins them with single hyphens", () => {
    expect(slugify("Dr Amira Hassan")).toBe("dr-amira-hassan");
  });

  it("drops punctuation", () => {
    expect(slugify("Anxiety & Stress: a guide!")).toBe("anxiety-stress-a-guide");
  });

  it("removes accents", () => {
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
  });

  it("collapses repeated separators and trims hyphens", () => {
    expect(slugify("  --hello   world--  ")).toBe("hello-world");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("");
  });
});
