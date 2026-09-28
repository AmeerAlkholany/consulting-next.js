/**
 * Date and time helpers ensuring timezone and UTC consistency.
 * ADR-009 / ARCHITECTURE.md §19
 */

export function isValidIanaTimezone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function formatDateTimeInZone(
  date: Date | string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(d);
}

export function formatDateInZone(
  date: Date | string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    ...options,
  }).format(d);
}

export function formatTimeInZone(
  date: Date | string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeStyle: "short",
    ...options,
  }).format(d);
}
