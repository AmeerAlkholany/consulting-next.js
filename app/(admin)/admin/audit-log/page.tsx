import "server-only";

import { requireAdmin } from "@/server/authz/guards";
import { db } from "@/db/client";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileText } from "lucide-react";

export const metadata = {
  title: "Audit Log",
  description: "Review administrative actions and system events.",
};

export default async function AdminAuditLogPage() {
  await requireAdmin();

  const logs = await db.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actorUser: { select: { id: true, fullName: true, email: true } },
    },
  });

  const totalLogs = await db.auditLog.count();

  const actionLabels: Record<string, string> = {
    USER_SUSPENDED: "User Suspended",
    USER_REACTIVATED: "User Reactivated",
    USER_ROLE_CHANGED: "Role Changed",
    CONSULTANT_APPROVED: "Consultant Approved",
    CONSULTANT_REJECTED: "Consultant Rejected",
    CONSULTANT_SUSPENDED: "Consultant Suspended",
    APPOINTMENT_CANCELLED_BY_ADMIN: "Appointment Cancelled (Admin)",
    SPECIALIZATION_CREATED: "Specialization Created",
    SPECIALIZATION_UPDATED: "Specialization Updated",
    SPECIALIZATION_DISABLED: "Specialization Disabled",
    REVIEW_UNPUBLISHED: "Review Unpublished",
  };

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  }

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground">{totalLogs} total entries</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by action or entity..."
                className="w-full pl-10 pr-4 py-2 border rounded-md"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    Action
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    Entity
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Actor</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                    Details
                  </th>
                  <th className="w-40 p-3 text-left text-sm font-medium text-muted-foreground">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border">
                    <td className="p-3">
                      <Badge variant="outline">{actionLabels[log.action] ?? log.action}</Badge>
                    </td>
                    <td className="p-3 text-sm font-mono text-muted-foreground">
                      {log.entityType}:{log.entityId.slice(0, 8)}...
                    </td>
                    <td className="p-3 text-sm">
                      <div>{log.actorUser.fullName}</div>
                      <div className="text-xs text-muted-foreground">{log.actorUser.email}</div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                      {typeof log.metadata === "object" && log.metadata !== null
                        ? JSON.stringify(log.metadata).slice(0, 100)
                        : String(log.metadata)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No audit logs yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
