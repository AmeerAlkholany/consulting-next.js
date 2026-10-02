import { getCurrentUser } from "@/server/auth/dal";
import { requireConsultant } from "@/server/authz/guards";
import { navigationByRole } from "@/config/nav";
import { AppShell } from "@/components/layout/app-shell";
import type { SessionUser } from "@/server/auth/session";
import type { ReactNode } from "react";

interface ConsultantLayoutProps {
  children: ReactNode;
}

export default async function ConsultantLayout({ children }: ConsultantLayoutProps) {
  const user = await getCurrentUser();

  // requireConsultant() redirects to /login?next= when no session exists and
  // throws AuthenticationError when the account is suspended/deactivated.
  await requireConsultant({ redirectPath: undefined });

  const navigation = navigationByRole.CONSULTANT ?? [];

  return (
    <AppShell user={user as SessionUser} navigation={navigation}>
      {children}
    </AppShell>
  );
}
