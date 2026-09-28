/**
 * String and presentation formatting helpers.
 */

export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number, suffix = "…"): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, Math.max(0, maxLength - suffix.length)) + suffix;
}

export function formatInitials(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
