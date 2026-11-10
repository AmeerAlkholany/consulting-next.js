import "server-only";

import { requireAdmin } from "@/server/authz/guards";
import { db } from "@/db/client";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Users } from "lucide-react";

export const metadata = {
  title: "User Management",
  description: "Manage users on the platform.",
};

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await db.user.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
      clientProfile: { select: { displayName: true } },
      consultantProfile: { select: { verificationStatus: true } },
    },
  });

  const totalUsers = await db.user.count();

  function formatDate(date: Date | null): string {
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(date));
  }

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">{totalUsers} total users</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 border rounded-md"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                  <th className="w-28 p-3 text-left text-sm font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="w-28 p-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="w-32 p-3 text-left text-sm font-medium text-muted-foreground">
                    Created
                  </th>
                  <th className="w-32 p-3 text-right text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border">
                    <td className="p-3 font-medium">{user.fullName}</td>
                    <td className="p-3 text-sm text-muted-foreground">{user.email}</td>
                    <td className="p-3">
                      <Badge variant="outline">{user.role.toLowerCase()}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={user.status === "ACTIVE" ? "success" : "destructive"}>
                        {user.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Users className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No users found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
