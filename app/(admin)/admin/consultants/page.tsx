import { requireAdmin } from "@/server/authz/guards";
import { getConsultantsForAdmin } from "@/server/dal/admin";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MoreHorizontal } from "lucide-react";

export default async function AdminConsultantsPage() {
  const admin = await requireAdmin();
  const { consultants, total } = await getConsultantsForAdmin({ status: "ALL", search: "", page: 1, perPage: 20 });

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" }> = {
    PENDING: { label: "Pending", variant: "default" },
    APPROVED: { label: "Approved", variant: "success" },
    REJECTED: { label: "Rejected", variant: "destructive" },
    SUSPENDED: { label: "Suspended", variant: "destructive" },
  };

  const pendingCount = consultants.filter((c) => c.verificationStatus === "PENDING").length;

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Consultant Verification</h1>
          <p className="text-sm text-muted-foreground">{pendingCount} pending review</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consultant Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, email, or headline..."
                  className="w-full pl-10 pr-4 py-2 border rounded-md"
                />
              </div>
              <select className="border rounded-md px-4 py-2">
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Consultant</th>
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                    <th className="w-36 p-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="w-48 p-3 text-left text-sm font-medium text-muted-foreground">Specializations</th>
                    <th className="w-36 p-3 text-left text-sm font-medium text-muted-foreground">Price</th>
                    <th className="w-48 p-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {consultants.map((c) => {
                    const s = statusConfig[c.verificationStatus] ?? { label: c.verificationStatus, variant: "default" };
                    return (
                      <tr key={c.id} className="border-b border-border">
                        <td className="p-3">
                          <div className="font-medium">{c.fullName}</div>
                          <div className="text-sm text-muted-foreground font-mono">{c.headline}</div>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{c.email}</td>
                        <td className="p-3">
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                          {c.specializations.join(", ") || "—"}
                        </td>
                        <td className="p-3 text-sm font-mono">
                          {c.sessionPriceMinor / 100} {c.currency}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" aria-label="View details">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            {c.verificationStatus === "PENDING" && (
                              <>
                                <Button variant="ghost" size="sm" className="text-success" onClick={() => {}}>
                                  Approve
                                </Button>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {}}>
                                  Reject
                                </Button>
                              </>
                            )}
                            {c.verificationStatus === "APPROVED" && (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {}}>
                                Suspend
                              </Button>
                            )}
                            {c.verificationStatus === "SUSPENDED" && (
                              <Button variant="ghost" size="sm" className="text-success" onClick={() => {}}>
                                Reinstate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}