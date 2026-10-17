import { requireConsultant } from "@/server/authz/guards";
import { getAllAvailabilityRules, getAllAvailabilityExceptions } from "@/server/dal/availability";
import { getConsultantProfile } from "@/server/dal/consultant-profile";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default async function ConsultantAvailabilityPage() {
  const consultant = await requireConsultant({ approved: true });
  const profile = await getConsultantProfile(consultant.id);

  const rules = await getAllAvailabilityRules(consultant.id);
  const exceptions = await getAllAvailabilityExceptions(consultant.id);

  return (
    <Container className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Availability</h1>

      <Card>
        <CardHeader>
          <CardTitle>Timezone</CardTitle>
          <CardDescription>
            All rules are interpreted in your local timezone:{" "}
            <strong>{profile?.timezone ?? "UTC"}</strong>. Rule times stay fixed on your wall clock
            across DST transitions.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Weekly Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Weekly Rules</CardTitle>
          <Button onClick={() => {}}>Add Rule</Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No weekly rules defined. Click &apos;Add Rule&apos; to create one.
            </p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant={rule.isActive ? "success" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <span className="font-medium">{weekdays[rule.weekday]}</span>
                    <span className="text-sm text-muted-foreground font-mono">
                      {minutesToTime(rule.startMinute)} – {minutesToTime(rule.endMinute)}
                    </span>
                    {rule.effectiveFrom && (
                      <span className="text-xs text-muted-foreground">
                        from {rule.effectiveFrom.toISOString().split("T")[0]}
                      </span>
                    )}
                    {rule.effectiveUntil && (
                      <span className="text-xs text-muted-foreground">
                        until {rule.effectiveUntil.toISOString().split("T")[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {}}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exceptions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Date Exceptions</CardTitle>
          <Button onClick={() => {}}>Add Exception</Button>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No exceptions defined. Click &apos;Add Exception&apos; to block or add hours for
              specific dates.
            </p>
          ) : (
            <div className="space-y-3">
              {exceptions.map((exc) => (
                <div
                  key={exc.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant={exc.type === "BLOCK" ? "destructive" : "success"}>
                      {exc.type}
                    </Badge>
                    <span className="font-medium">{exc.date.toISOString().split("T")[0]}</span>
                    {exc.startMinute !== null && exc.endMinute !== null && (
                      <span className="text-sm text-muted-foreground font-mono">
                        {minutesToTime(exc.startMinute)} – {minutesToTime(exc.endMinute)}
                      </span>
                    )}
                    {exc.reason && (
                      <span className="text-xs text-muted-foreground">{exc.reason}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {}}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Live Preview (Next 14 Days)</CardTitle>
          <CardDescription>
            Slots shown in your timezone ({profile?.timezone}). Green = available, Red = booked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {/* Preview would be rendered by client component */}
            <p className="text-sm text-muted-foreground">Preview rendered by client component.</p>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
