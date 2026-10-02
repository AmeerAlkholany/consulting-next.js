import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Toaster } from "@/components/feedback/toaster";
import { SiteFooter } from "@/components/layout/site-footer";
import { siteConfig } from "@/config/site";
import { AnonymousAuthActions, AuthMenu } from "@/features/auth/auth-menu";
import { getCurrentUser } from "@/server/auth/dal";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — book qualified psychological consultations`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
};

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  await getCurrentUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Toaster>{null}</Toaster>
        <Suspense fallback={null}>
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
                {siteConfig.name}
              </Link>
              <Suspense fallback={<AnonymousAuthActions variant="desktop" />}>
                <AuthMenu variant="desktop" />
              </Suspense>
            </div>
          </header>
          <main id="main-content" className="flex-1">
            {children}
          </main>
        </Suspense>
        <SiteFooter />
      </body>
    </html>
  );
}