import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Find a consultant",
};

export default function ConsultantsPage() {
  return (
    <Container className="flex flex-col gap-8 py-12">
      <PageHeader
        title="Find a consultant"
        description="Search verified psychologists by focus area, language, and consultation type."
      />
      <EmptyState
        icon={<Search className="h-5 w-5" />}
        title="Consultant search is not available yet"
        description="Search, filters, and consultant profiles are built in a later step of this project. Nothing in this area is bookable yet."
        action={
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to the home page
          </Link>
        }
      />
    </Container>
  );
}
