"use client";

import * as React from "react";
import Link from "next/link";
import { HeartHandshake, Menu, X } from "lucide-react";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";

const navigation = [
  { href: "/consultants", label: "Find a consultant" },
  { href: "/crisis-resources", label: "Crisis resources" },
] as const;

/**
 * The site chrome. Navigation and the hamburger's open state are client
 * concerns; the authentication area is *not* — it is passed in as a slot so it
 * can be a Server Component reading the session through the cached DAL, and so
 * the shell can stream around it with `<Suspense>` (ARCHITECTURE.md §6: a
 * top-level `await` on cookies in a layout delays the whole segment).
 */
export interface SiteHeaderProps {
  /** Signed-in or signed-out affordances for the desktop bar. */
  authSlot?: React.ReactNode;
  /** The same, laid out as a column inside the mobile panel. */
  authSlotMobile?: React.ReactNode;
}

function SiteHeader({ authSlot, authSlotMobile }: SiteHeaderProps) {
  const [open, setOpen] = React.useState(false);
  const panelId = "site-navigation-panel";

  React.useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <Container className="flex min-h-16 items-center justify-between gap-4 py-2">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm text-base font-semibold text-foreground"
          onClick={() => setOpen(false)}
        >
          <HeartHandshake className="h-6 w-6 text-primary" aria-hidden="true" />
          <span>{siteConfig.name}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">{authSlot}</div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted md:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </Container>

      {open ? (
        <div id={panelId} className="border-t border-border bg-background md:hidden">
          <Container className="flex flex-col gap-2 py-4">
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-2 pt-2">{authSlotMobile}</div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}

export { SiteHeader };
