import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <Container size="form" className="flex flex-col gap-8 py-16">
      <PageHeader
        title="Sign in"
        description="Sign in to manage your appointments, availability, and profile."
      />
      <EmptyState
        icon={<Lock className="h-5 w-5" />}
        title="Sign in is not available yet"
        description="Accounts and sessions are built in a later step of this project. Until then, the public pages are the only reachable part of the platform."
        action={
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to the home page
          </Link>
        }
      />
    </Container>
  );
}
