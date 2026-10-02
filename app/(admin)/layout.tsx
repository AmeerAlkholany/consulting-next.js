import { getCurrentUser } from "@/server/auth/dal";
import { requireAdmin } from "@/server/authz/guards";
import { navigationByRole } from "@/config/nav";
import { AppShell } from "@/components/layout/app-shell";
import type { SessionUser } from "@/server/auth/session";
import type { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getCurrentUser();

  // requireAdmin() redirects to /login?next= when no session exists and
  // throws AuthenticationError when the account is suspended/deactivated.
  await requireAdmin({ redirectPath: undefined });

  const navigation = navigationByRole.ADMIN ?? [];

  return (
    <AppShell user={user as SessionUser} navigation={navigation}>
      {children}
    </AppShell>
  );
}
