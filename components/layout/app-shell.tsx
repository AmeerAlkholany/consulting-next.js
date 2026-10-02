"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartHandshake, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/server/auth/session";
import type { NavItem } from "@/config/nav";

interface AppShellProps {
  user: SessionUser;
  navigation: NavItem[];
  children: React.ReactNode;
}


/**
 * Role-scoped application shell (IMPLEMENTATION.md Step 5).
 *
 * Shared chrome for the `(client)`, `(consultant)`, and `(admin)` route groups.
 * Contains the sidebar with role-specific navigation and a top bar with the
 * wordmark and sign-out control.
 *
 * This is a Client Component because the sidebar toggle and active-state
 * highlighting require interactivity.
 */
export function AppShell({ user, navigation, children }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform duration-200 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Sidebar navigation"
      >
        <div className="flex h-16 items-center border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <HeartHandshake className="h-6 w-6 text-primary" aria-hidden="true" />
            <span className="font-semibold text-foreground">{siteConfig.name}</span>
          </Link>
          <button
            className="ml-auto rounded-md p-1 text-foreground hover:bg-muted md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href as Parameters<typeof Link>[0]["href"]}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-foreground">{user.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {user.role}
            </Badge>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col md:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background/95 px-4 backdrop-blur">
          <button
            className="rounded-md p-2 text-foreground hover:bg-muted md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <form action="/auth/logout" method="POST">
              <Button variant="outline" size="sm" type="submit">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
