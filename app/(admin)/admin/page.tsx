import "server-only";

import { requireAdmin } from "@/server/authz/guards";
import { db } from "@/db/client";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, ClipboardList, Activity } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Admin Dashboard",
  description: "Administer the platform.",
};

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [totalUsers, pendingConsultants, totalAppointments, pendingNotifications] =
    await Promise.all([
      db.user.count(),
      db.consultantProfile.count({
        where: { verificationStatus: "PENDING" },
      }),
      db.appointment.count(),
      db.notification.count({
        where: { readAt: null },
      }),
    ]);

  const recentLogs = await db.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actorUser: { select: { fullName: true } },
    },
  });

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  }

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform overview and management.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalUsers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Pending Reviews</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingConsultants}</p>
            <Button asChild variant="link" className="px-0 h-auto text-sm">
              <Link href="/admin/consultants">Review now</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Appointments</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAppointments}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Unread Notifications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingNotifications}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/consultants">Consultant Verification</Link>
            </Button>
            <Button asChild variant="outline">
              <a href="/admin/users">User Management</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/admin/audit-log">Audit Log</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/admin/specializations">Specializations</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <Badge variant="outline" className="shrink-0">
                    {log.action.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{log.actorUser.fullName}</span> acted on{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {log.entityType}:{log.entityId.slice(0, 8)}...
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                  </div>
                </div>
              ))}
              {recentLogs.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
