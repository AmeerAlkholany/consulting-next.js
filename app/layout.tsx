import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Toaster } from "@/components/feedback/toaster";
import { SiteFooter } from "@/components/layout/site-footer";
import { siteConfig } from "@/config/site";
import { AnonymousAuthActions, AuthMenu } from "@/features/auth/auth-menu";
import { getCurrentUser } from "@/server/auth/dal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — book qualified psychological consultations`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await getCurrentUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
