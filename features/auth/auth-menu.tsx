import Link from "next/link";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getSession } from "@/server/auth/dal";
import { logoutAction } from "./actions";

/**
 * The header's authentication area (IMPLEMENTATION.md Step 4, "UI changes": "the
 * header shows the user menu when signed in").
 *
 * A Server Component reading the session through the cached DAL, rendered inside
 * `<Suspense>` by the header so the chrome paints immediately. The sign-out
 * control is a form posting a Server Action — no client JavaScript is required
 * for it to work, and no token is exposed.
 *
 * Step 5 replaces this with the full `components/layout/user-menu.tsx`, including
 * the role-scoped links each account can actually reach.
 */

const roleLabels: Record<string, string> = {
  CLIENT: "Client",
  CONSULTANT: "Consultant",
  ADMIN: "Administrator",
};

export interface AuthMenuProps {
  variant: "desktop" | "mobile";
}

/** The signed-out affordances. Also the Suspense fallback: it is the truth for
 * every visitor until the session read resolves, and correct thereafter for
 * anonymous ones. */
function AnonymousAuthActions({ variant }: AuthMenuProps) {
  const isMobile = variant === "mobile";

  return (
    <div className={cn("flex gap-2", isMobile ? "flex-col" : "items-center")}>
      <Link
        href="/login"
        className={cn(buttonVariants({ variant: "ghost", size: isMobile ? "default" : "sm" }))}
      >
        Sign in
      </Link>
      <Link href="/register" className={cn(buttonVariants({ size: isMobile ? "default" : "sm" }))}>
        Create account
      </Link>
    </div>
  );
}

async function AuthMenu({ variant }: AuthMenuProps) {
  const session = await getSession();

  if (!session) {
    return <AnonymousAuthActions variant={variant} />;
  }

  const isMobile = variant === "mobile";

  return (
    <div className={cn("flex gap-2", isMobile ? "flex-col" : "items-center")}>
      <div className={cn("flex gap-2", isMobile ? "flex-row items-center" : "items-center")}>
        <span className="text-sm font-medium text-foreground">{session.user.fullName}</span>
        <Badge variant="secondary">{roleLabels[session.user.role] ?? session.user.role}</Badge>
      </div>
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="outline"
          size={isMobile ? "default" : "sm"}
          className={isMobile ? "w-full" : undefined}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </form>
    </div>
  );
}

export { AnonymousAuthActions, AuthMenu };
