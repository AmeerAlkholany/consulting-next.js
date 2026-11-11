import "server-only";

import { requireAdmin } from "@/server/authz/guards";
import { getAuditLogsForAdmin } from "@/server/dal/admin";
import { Container } from "@/components/layout/container";
import { AuditLogTable } from "@/features/admin/audit-log-table";
import { auditFilterSchema } from "@/schemas/admin";
import { Search, Shield } from "lucide-react";

export const metadata = {
  title: "Audit Log — Admin",
  description: "Inspect immutable audit log entries of administrative actions.",
};

interface PageProps {
  searchParams: Promise<{
    action?: string;
    entityType?: string;
    search?: string;
    days?: string;
    page?: string;
  }>;
}

export default async function AdminAuditLogPage({ searchParams }: PageProps) {
  await requireAdmin();

  const params = await searchParams;
  const parsed = auditFilterSchema.safeParse(params);
  const filter = parsed.success
    ? parsed.data
    : { action: "ALL", entityType: "ALL", search: "", days: 30, page: 1, perPage: 25 };

  const { logs, total } = await getAuditLogsForAdmin(filter);

  return (
    <Container className="py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Audit Log Viewer
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} immutable event{total === 1 ? "" : "s"} logged in the last {filter.days} days
          </p>
        </div>

        <form className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              name="search"
              defaultValue={filter.search}
              placeholder="Search actor or entity ID..."
              className="pl-9 pr-3 py-1.5 text-sm border rounded-md w-48 sm:w-60"
            />
          </div>

          <select
            name="action"
            defaultValue={filter.action}
            className="text-sm border rounded-md py-1.5 px-2 bg-background"
          >
            <option value="ALL">All Actions</option>
            <option value="USER_SUSPENDED">USER_SUSPENDED</option>
            <option value="USER_REACTIVATED">USER_REACTIVATED</option>
            <option value="USER_ROLE_CHANGED">USER_ROLE_CHANGED</option>
            <option value="CONSULTANT_APPROVED">CONSULTANT_APPROVED</option>
            <option value="CONSULTANT_REJECTED">CONSULTANT_REJECTED</option>
            <option value="CONSULTANT_SUSPENDED">CONSULTANT_SUSPENDED</option>
            <option value="APPOINTMENT_CANCELLED_BY_ADMIN">APPOINTMENT_CANCELLED_BY_ADMIN</option>
          </select>

          <select
            name="days"
            defaultValue={String(filter.days)}
            className="text-sm border rounded-md py-1.5 px-2 bg-background"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>

          <button
            type="submit"
            className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90"
          >
            Filter
          </button>
        </form>
      </div>

      <AuditLogTable logs={logs} />
    </Container>
  );
}
