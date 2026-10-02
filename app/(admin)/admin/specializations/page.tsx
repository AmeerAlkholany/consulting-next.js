import { requireAdmin } from "@/server/authz/guards";
import { getSpecializations } from "@/server/dal/taxonomy";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, GripVertical } from "lucide-react";

export default async function AdminSpecializationsPage() {
  const admin = await requireAdmin();
  const specializations = await getSpecializations();

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Specializations</h1>
        <Button>Add specialization</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage the specialization taxonomy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 text-center p-3 text-sm font-medium text-muted-foreground">Order</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Slug</th>
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground">Description</th>
                  <th className="w-32 text-center p-3 text-sm font-medium text-muted-foreground">Consultants</th>
                  <th className="w-28 text-center p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="w-48 text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {specializations.map((spec) => (
                  <tr key={spec.id} className="border-b border-border">
                    <td className="text-center p-3 text-sm font-mono text-muted-foreground">{spec.sortOrder}</td>
                    <td className="p-3 font-medium">{spec.name}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{spec.slug}</td>
                    <td className="max-w-xs p-3 text-sm text-muted-foreground">{spec.description ?? "—"}</td>
                    <td className="text-center p-3 text-sm text-muted-foreground">{spec.consultantCount}</td>
                    <td className="text-center p-3">
                      <Badge variant={spec.isActive ? "default" : "secondary"}>
                        {spec.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="text-right p-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" aria-label="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {spec.isActive ? (
                          <Button variant="ghost" size="icon" aria-label="Disable" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" aria-label="Enable" className="text-success hover:text-success">
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}