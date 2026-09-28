import { describe, expect, it } from "vitest";
import { formatMoney, getCurrencyExponent, parseMoneyToMinorUnits } from "@/lib/money";

describe("getCurrencyExponent", () => {
  it("returns 2 for most currencies", () => {
    expect(getCurrencyExponent("USD")).toBe(2);
    expect(getCurrencyExponent("eur")).toBe(2);
  });

  it("returns 0 for zero-decimal currencies", () => {
    expect(getCurrencyExponent("JPY")).toBe(0);
    expect(getCurrencyExponent("krw")).toBe(0);
  });

  it("returns 3 for three-decimal currencies", () => {
    expect(getCurrencyExponent("KWD")).toBe(3);
    expect(getCurrencyExponent("bhd")).toBe(3);
  });
});

describe("formatMoney", () => {
  it("formats minor units as a currency amount", () => {
    expect(formatMoney(12550, "USD")).toContain("125.50");
  });

  it("does not invent decimals for zero-decimal currencies", () => {
    const formatted = formatMoney(1200, "JPY");
    expect(formatted).toContain("1,200");
    expect(formatted).not.toContain(".");
  });

  it("formats negative amounts", () => {
    expect(formatMoney(-500, "USD")).toContain("5.00");
  });
});

describe("parseMoneyToMinorUnits", () => {
  it("parses formatted input back into minor units", () => {
    expect(parseMoneyToMinorUnits("$12.50", "USD")).toBe(1250);
    expect(parseMoneyToMinorUnits(12.5, "USD")).toBe(1250);
  });

  it("honours the currency exponent", () => {
    expect(parseMoneyToMinorUnits("1200", "JPY")).toBe(1200);
    expect(parseMoneyToMinorUnits("1.234", "KWD")).toBe(1234);
  });

  it("returns 0 when the input cannot be parsed", () => {
    expect(parseMoneyToMinorUnits("not a number")).toBe(0);
    expect(parseMoneyToMinorUnits("")).toBe(0);
  });
});
