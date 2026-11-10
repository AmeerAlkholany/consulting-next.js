import "server-only";

import { requireAdmin } from "@/server/authz/guards";
import { getUsersForAdmin } from "@/server/dal/admin";
import { Container } from "@/components/layout/container";
import { UserTable } from "@/features/admin/user-table";
import { userFilterSchema } from "@/schemas/admin";
import { Search } from "lucide-react";

export const metadata = {
  title: "User Management — Admin",
  description: "Manage platform users, roles, and account statuses.",
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    role?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdmin();

  const params = await searchParams;
  const parsed = userFilterSchema.safeParse(params);
  const filter = parsed.success
    ? parsed.data
    : { search: "", role: "ALL" as const, status: "ALL" as const, page: 1, perPage: 20 };

  const { users, total } = await getUsersForAdmin(filter);

  return (
    <Container className="py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">
            {total} user{total === 1 ? "" : "s"} found across all platform roles
          </p>
        </div>

        {/* Filter bar */}
        <form className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              name="search"
              defaultValue={filter.search}
              placeholder="Search name or email..."
              className="pl-9 pr-3 py-1.5 text-sm border rounded-md w-48 sm:w-64"
            />
          </div>

          <select
            name="role"
            defaultValue={filter.role}
            className="text-sm border rounded-md py-1.5 px-2 bg-background"
          >
            <option value="ALL">All Roles</option>
            <option value="CLIENT">Client</option>
            <option value="CONSULTANT">Consultant</option>
            <option value="ADMIN">Admin</option>
          </select>

          <select
            name="status"
            defaultValue={filter.status}
            className="text-sm border rounded-md py-1.5 px-2 bg-background"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>

          <button
            type="submit"
            className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90"
          >
            Filter
          </button>
        </form>
      </div>

      <UserTable users={users} />
    </Container>
  );
}
