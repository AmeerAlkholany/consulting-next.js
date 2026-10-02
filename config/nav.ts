/**
 * Navigation configuration (IMPLEMENTATION.md Step 5, ARCHITECTURE.md §29).
 *
 * One source of truth for the sidebar links each role sees. Pages import the
 * right slice; tests import the whole list to verify every link resolves.
 *
 * `href` is always a literal string so `typedRoutes` can validate it at build
 * time. Links to routes that do not exist cause a build error, which is what
 * keeps the nav in sync with the route tree.
 */

import type { UserRole } from "@/config/roles";

export interface NavItem {
  href: string;
  label: string;
}

export const navigationByRole: Partial<Record<UserRole, NavItem[]>> = {
  CLIENT: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/appointments", label: "Appointments" },
    { href: "/profile", label: "Profile" },
    { href: "/notifications", label: "Notifications" },
  ],
  CONSULTANT: [
    { href: "/consultant", label: "Dashboard" },
    { href: "/consultant/profile", label: "Profile" },
    { href: "/consultant/availability", label: "Availability" },
    { href: "/consultant/appointments", label: "Appointments" },
    { href: "/consultant/reviews", label: "Reviews" },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/consultants", label: "Consultants" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/appointments", label: "Appointments" },
    { href: "/admin/specializations", label: "Specializations" },
    { href: "/admin/audit-log", label: "Audit log" },
  ],
};

/** All navigation links across every role, for tests that assert completeness. */
export const allNavigationItems: NavItem[] = Object.values(navigationByRole).flat();
