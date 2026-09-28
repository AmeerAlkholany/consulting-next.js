import Link from "next/link";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function NotFound() {
  return (
    <Container className="flex flex-col gap-6 py-20">
      <p className="text-sm font-medium uppercase tracking-wide text-primary">404</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        We could not find that page
      </h1>
      <p className="max-w-measure text-base text-muted-foreground">
        The link may be out of date. You can browse consultants, or return to the home page.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={cn(buttonVariants())}>
          Go to the home page
        </Link>
        <Link href="/consultants" className={cn(buttonVariants({ variant: "outline" }))}>
          Find a consultant
        </Link>
      </div>
    </Container>
  );
}
