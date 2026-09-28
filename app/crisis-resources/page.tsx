import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Crisis resources",
};

export default function CrisisResourcesPage() {
  return (
    <div className="flex flex-col gap-8 py-12">
      <Container size="measure">
        <PageHeader
          title="Crisis resources"
          description="This platform is not an emergency service. If you need help right now, use the options below instead of waiting for an appointment."
        />
      </Container>

      <Container size="measure" className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>If you are in immediate danger</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              Call your local emergency number now. Examples: 112 across much of Europe, 911 in the
              United States, 999 in the United Kingdom.
            </p>
            <p>
              If you can, tell someone you trust where you are and stay with another person until
              help arrives.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>If you need to talk to someone today</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              Contact a crisis line in your country. Search for your national crisis line, or ask
              your family doctor or local hospital for the number that covers where you live.
            </p>
            <p>
              A curated directory of national crisis lines is not part of this build yet; that is
              added in a later step.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>When an appointment is the right next step</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Consulting a psychologist is a good choice for ongoing difficulties that are not an
              emergency. Once consultant search is available, you will be able to book directly from
              a consultant profile.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <a href="tel:112" className={cn(buttonVariants({ variant: "outline" }))}>
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call 112
          </a>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }))}>
            Back to the home page
          </Link>
        </div>
      </Container>
    </div>
  );
}
