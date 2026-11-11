import Link from "next/link";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-wider text-primary uppercase">404 Error</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
        <p className="max-w-md text-muted-foreground">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have been moved,
          expired, or deleted.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/" className={cn(buttonVariants({ variant: "default" }))}>
          Go to Home
        </Link>
        <Link href="/consultants" className={cn(buttonVariants({ variant: "outline" }))}>
          Browse Consultants
        </Link>
      </div>
    </Container>
  );
}
