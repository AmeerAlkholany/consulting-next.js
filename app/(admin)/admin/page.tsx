import "server-only";

import { requireAdmin } from "@/server/authz/guards";
import { getPlatformStatistics } from "@/server/dal/admin";
import { Container } from "@/components/layout/container";
import { StatsCards } from "@/features/admin/stats-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, CalendarCheck, Shield, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Admin Dashboard",
  description: "Platform oversight, user management, and audit inspection.",
};

export default async function AdminDashboardPage() {
  await requireAdmin();

  let stats;
  try {
    stats = await getPlatformStatistics();
  } catch (_err: unknown) {
    stats = null;
  }

  return (
    <Container className="py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Platform Administration
        </h1>
        <p className="text-sm text-muted-foreground">
          System telemetry, operational controls, and compliance audit trail.
        </p>
      </div>

      {stats ? (
        <StatsCards stats={stats} />
      ) : (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Platform statistics temporarily unavailable.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              User Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Review accounts, inspect roles, adjust user statuses, or revoke active sessions.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full justify-between">
              <Link href="/admin/users">
                Manage Users
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              Appointment Oversight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Supervise booking schedules across the platform with zero clinical note leakage.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full justify-between">
              <Link href="/admin/appointments">
                Inspect Appointments
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Audit Log Viewer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Review immutable audit trail of administrative modifications and platform actions.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full justify-between">
              <Link href="/admin/audit-log">
                Open Audit Log
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
