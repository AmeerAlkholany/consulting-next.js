"use client";

import "./globals.css";

/**
 * Root error boundary. It replaces the root layout, so it renders its own
 * document, re-imports the global styles, and cannot export `metadata`.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-full bg-background p-6 text-foreground">
        <title>Something went wrong</title>
        <main className="mx-auto flex w-full max-w-form flex-col gap-5 py-16">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="text-base text-muted-foreground">
            The application could not finish loading. Try again, and if the problem continues,
            contact support and mention the reference code below.
          </p>
          <div>
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Try again
            </button>
          </div>
          {error.digest ? (
            <p className="text-xs text-muted-foreground">
              Reference code: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
