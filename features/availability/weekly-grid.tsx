"use client";

import { useTransition, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RuleEditor, type RuleData } from "@/features/availability/rule-editor";
import { deleteAvailabilityRuleAction } from "@/features/availability/actions";
import { initialAuthFormState } from "@/features/auth/form-state";
import { Trash2, Calendar, Clock, AlertCircle } from "lucide-react";

export interface SerializedAvailabilityRule {
  id: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  isActive: boolean;
}

interface WeeklyGridProps {
  rules: SerializedAvailabilityRule[];
}

const weekdayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function WeeklyGrid({ rules }: WeeklyGridProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this availability rule?")) return;
    setError(null);

    const formData = new FormData();
    formData.set("id", id);

    startTransition(async () => {
      const result = await deleteAvailabilityRuleAction(initialAuthFormState, formData);
      if (result.status === "error") {
        setError(result.message);
      }
    });
  };

  // Group rules by weekday
  const rulesByWeekday = Array.from({ length: 7 }, (_, i) => ({
    weekday: i,
    name: weekdayNames[i],
    rules: rules.filter((r) => r.weekday === i),
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle>Weekly Recurring Hours</CardTitle>
          <CardDescription>
            Set the standard hours you are available each day of the week.
          </CardDescription>
        </div>
        <RuleEditor />
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-lg">
            <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-base font-medium">No weekly availability rules defined</p>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              Click &quot;Add Rule&quot; to publish your working hours and let clients book sessions.
            </p>
            <RuleEditor />
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border">
            {rulesByWeekday.map((day) => (
              <div
                key={day.weekday}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3"
              >
                <div className="w-32 font-semibold text-sm flex items-center gap-2">
                  <span>{day.name}</span>
                  {day.rules.length > 0 && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {day.rules.length}
                    </Badge>
                  )}
                </div>

                <div className="flex-1">
                  {day.rules.length === 0 ? (
                    <span className="text-sm text-muted-foreground italic">Unavailable</span>
                  ) : (
                    <div className="space-y-2">
                      {day.rules.map((rule) => {
                        const ruleData: RuleData = {
                          id: rule.id,
                          weekday: rule.weekday,
                          startMinute: rule.startMinute,
                          endMinute: rule.endMinute,
                          effectiveFrom: rule.effectiveFrom,
                          effectiveUntil: rule.effectiveUntil,
                          isActive: rule.isActive,
                        };

                        return (
                          <div
                            key={rule.id}
                            className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/40 border border-border/50 text-sm"
                          >
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant={rule.isActive ? "success" : "secondary"}>
                                {rule.isActive ? "Active" : "Paused"}
                              </Badge>

                              <span className="font-mono font-medium flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {minutesToTime(rule.startMinute)} – {minutesToTime(rule.endMinute)}
                              </span>

                              {rule.effectiveFrom && (
                                <span className="text-xs text-muted-foreground">
                                  From {rule.effectiveFrom.split("T")[0]}
                                </span>
                              )}
                              {rule.effectiveUntil && (
                                <span className="text-xs text-muted-foreground">
                                  Until {rule.effectiveUntil.split("T")[0]}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <RuleEditor initialRule={ruleData} />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(rule.id)}
                                disabled={isPending}
                                aria-label="Delete rule"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

