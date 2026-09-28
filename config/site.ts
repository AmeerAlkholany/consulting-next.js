/**
 * Site-wide configuration and public metadata.
 * Source of truth for brand name, canonical origin, support contact, and timezone baseline.
 */
export const siteConfig = {
  name: "Consulting Platform",
  description:
    "Professional psychological consultation platform providing confidential, qualified care.",
  url: "http://localhost:3000",
  supportEmail: "support@example.com",
  defaultTimezone: "UTC",
} as const;

export type SiteConfig = typeof siteConfig;
