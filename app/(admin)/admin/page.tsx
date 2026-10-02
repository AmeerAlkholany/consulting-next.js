import { getCurrentUser } from "@/server/auth/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";

export default async function AdminDashboardPage() {
  await getCurrentUser();

  return (
    <Container className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Admin overview
      </h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Pending verifications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Step 9 will show consultant verification requests here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Step 15 will display user management controls here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Audit log</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Step 15 will show the audit log here.
            </p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
