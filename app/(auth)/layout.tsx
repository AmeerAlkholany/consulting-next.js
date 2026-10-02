import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Authentication",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container size="form" className="flex flex-col gap-8 py-16">
      <PageHeader
        title="Authentication"
        description="Sign in or create an account to access the platform."
      />
      <div className="flex flex-col gap-4">
        {children}
      </div>
      <p className="text-sm text-muted-foreground text-center">
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to the home page
        </Link>
      </p>
    </Container>
  );
}