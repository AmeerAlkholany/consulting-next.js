/**
 * Exact integer-based money representation and formatting helpers.
 * ADR-015: Amounts are stored as minor units (e.g. cents) as integers.
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

export function getCurrencyExponent(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

export function formatMoney(
  amountInMinorUnits: number,
  currency = "USD",
  locale = "en-US",
): string {
  const exponent = getCurrencyExponent(currency);
  const factor = Math.pow(10, exponent);
  const majorUnits = amountInMinorUnits / factor;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(majorUnits);
}

export function parseMoneyToMinorUnits(formattedAmount: string | number, currency = "USD"): number {
  const exponent = getCurrencyExponent(currency);
  const factor = Math.pow(10, exponent);
  const num =
    typeof formattedAmount === "string"
      ? parseFloat(formattedAmount.replace(/[^0-9.-]+/g, ""))
      : formattedAmount;
  if (isNaN(num)) return 0;
  return Math.round(num * factor);
}
