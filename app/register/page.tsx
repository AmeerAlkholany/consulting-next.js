import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function RegisterPage() {
  return (
    <Container size="form" className="flex flex-col gap-8 py-16">
      <PageHeader
        title="Create an account"
        description="Clients book sessions here; consultants join to publish availability and receive bookings."
      />
      <EmptyState
        icon={<UserRound className="h-5 w-5" />}
        title="Registration is not available yet"
        description="Sign-up, email verification, and consultant onboarding are built in a later step of this project."
        action={
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to the home page
          </Link>
        }
      />
    </Container>
  );
}
