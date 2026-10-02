import { getCurrentUser } from "@/server/auth/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";

export default async function ConsultantDashboardPage() {
  const user = await getCurrentUser();

  return (
    <Container className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Welcome back, {user?.fullName ?? "User"}
      </h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Today&apos;s schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Step 14 will display your schedule here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Pending requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Step 14 will show pending booking requests here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Step 11 will let you manage your availability here.
            </p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
