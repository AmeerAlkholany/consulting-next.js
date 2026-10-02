import { getCurrentUser } from "@/server/auth/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";

export default async function ClientDashboardPage() {
  const user = await getCurrentUser();

  return (
    <Container className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Welcome back, {user?.fullName ?? "User"}
      </h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Upcoming appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Step 13 will show your next appointment here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Step 6 will let you edit your profile and preferences.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Step 16 will surface your notifications here.
            </p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
