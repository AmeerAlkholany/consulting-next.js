import { requireClient } from "@/server/authz/guards";
import { getClientProfile } from "@/server/dal/client-profile";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LANGUAGES } from "@/config/languages";

export default async function ClientProfilePage() {
  const user = await requireClient();
  const profile = await getClientProfile(user.id);

  return (
    <Container className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <label htmlFor="fullName" className="text-sm font-medium">
              Full Name
            </label>
            <p id="fullName" className="text-sm text-muted-foreground">
              {user.fullName}
            </p>
          </div>
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <p id="email" className="text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
          <div className="grid gap-2">
            <label htmlFor="timezone" className="text-sm font-medium">
              Timezone
            </label>
            <p id="timezone" className="text-sm text-muted-foreground">
              {user.timezone}
            </p>
          </div>
          <div className="grid gap-2">
            <label htmlFor="languages" className="text-sm font-medium">
              Languages
            </label>
            <p id="languages" className="text-sm text-muted-foreground">
              {profile?.languageIds.length
                ? profile.languageIds.map((code) => LANGUAGES.find((l) => l.code === code)?.name ?? code).join(", ")
                : "None selected"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Password management and session controls are implemented in Step 6.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Account deletion is implemented in Step 6.</p>
        </CardContent>
      </Card>
    </Container>
  );
}
