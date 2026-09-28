import Link from "next/link";
import { CalendarDays, ShieldCheck, UserRound } from "lucide-react";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

const steps = [
  {
    icon: <UserRound className="h-5 w-5" aria-hidden="true" />,
    title: "1. Find someone who fits",
    body: "Browse consultants by focus area, language, and consultation type. Every profile lists credentials that an administrator has verified.",
  },
  {
    icon: <CalendarDays className="h-5 w-5" aria-hidden="true" />,
    title: "2. Choose a time that works",
    body: "You only ever see times the consultant has published and that are still free, shown in your own timezone.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    title: "3. Meet with clear expectations",
    body: "The fee, the cancellation policy, and how the session runs are visible before you confirm anything.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="border-b border-border bg-card">
        <Container className="flex flex-col gap-8 py-16 sm:py-20">
          <div className="flex flex-col gap-5">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              Confidential psychological consultations
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-card-foreground sm:text-5xl">
              Talk to a qualified psychologist, on a schedule you can keep
            </h1>
            <p className="max-w-measure text-lg text-muted-foreground">
              {siteConfig.name} connects you with licensed psychologists for one-to-one sessions.
              You choose the consultant, the time, and the type of consultation. Nothing is booked
              until you confirm it.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/consultants" className={cn(buttonVariants({ size: "lg" }))}>
              Find a consultant
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Create an account
            </Link>
          </div>
        </Container>
      </section>

      <Container className="py-16">
        <section aria-labelledby="how-it-works" className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 id="how-it-works" className="text-3xl font-semibold tracking-tight text-foreground">
              How it works
            </h2>
            <p className="max-w-measure text-base text-muted-foreground">
              Three steps, no pressure, and no obligation to continue after a first session.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <Card key={step.title}>
                <CardHeader>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    {step.icon}
                  </span>
                  <CardTitle>{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </Container>

      <Container className="pb-16">
        <section
          aria-labelledby="emergency"
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-resting"
        >
          <h2 id="emergency" className="text-2xl font-semibold tracking-tight text-card-foreground">
            If this is an emergency
          </h2>
          <p className="max-w-measure text-base text-muted-foreground">
            {siteConfig.name} is not an emergency service and cannot help with a crisis in progress.
            If you or someone else is in immediate danger, contact your local emergency number or a
            crisis line.
          </p>
          <div>
            <Link href="/crisis-resources" className={cn(buttonVariants({ variant: "outline" }))}>
              See crisis resources
            </Link>
          </div>
        </section>
      </Container>
    </>
  );
}
