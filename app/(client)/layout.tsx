import { getCurrentUser } from "@/server/auth/dal";
import { requireClient } from "@/server/authz/guards";
import { navigationByRole } from "@/config/nav";
import { AppShell } from "@/components/layout/app-shell";
import type { SessionUser } from "@/server/auth/session";
import type { ReactNode } from "react";

interface ClientLayoutProps {
  children: ReactNode;
}

export default async function ClientLayout({ children }: ClientLayoutProps) {
  const user = await getCurrentUser();

  // requireClient() redirects to /login?next= when no session exists and
  // throws AuthenticationError when the account is suspended/deactivated.
  // Both behaviour paths are documented in ARCHITECTURE.md §10.
  await requireClient({ redirectPath: undefined });

  const navigation = navigationByRole.CLIENT ?? [];

  return (
    <AppShell user={user as SessionUser} navigation={navigation}>
      {children}
    </AppShell>
  );
}
