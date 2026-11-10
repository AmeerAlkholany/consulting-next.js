"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { upsertAvailabilityRuleAction } from "@/features/availability/actions";
import { initialAuthFormState, type AuthFormState } from "@/features/auth/form-state";
import { AlertCircle, Plus, Edit } from "lucide-react";

export interface RuleData {
  id?: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  isActive: boolean;
}

interface RuleEditorProps {
  initialRule?: RuleData;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const weekdays = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function RuleEditor({ initialRule, trigger, onSuccess }: RuleEditorProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AuthFormState>(initialAuthFormState);

  const [weekday, setWeekday] = useState<number>(initialRule?.weekday ?? 0);
  const [startTime, setStartTime] = useState<string>(
    initialRule ? minutesToTime(initialRule.startMinute) : "09:00",
  );
  const [endTime, setEndTime] = useState<string>(
    initialRule ? minutesToTime(initialRule.endMinute) : "17:00",
  );
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    initialRule?.effectiveFrom ? initialRule.effectiveFrom.split("T")[0] : "",
  );
  const [effectiveUntil, setEffectiveUntil] = useState<string>(
    initialRule?.effectiveUntil ? initialRule.effectiveUntil.split("T")[0] : "",
  );
  const [isActive, setIsActive] = useState<boolean>(initialRule?.isActive ?? true);

  const isEditing = Boolean(initialRule?.id);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState(initialAuthFormState);

    const startMinute = timeToMinutes(startTime);
    const endMinute = timeToMinutes(endTime);

    if (startMinute >= endMinute) {
      setState({
        status: "error",
        message: "End time must be after start time.",
        fieldErrors: { endMinute: ["End time must be after start time."] },
      });
      return;
    }

    const formData = new FormData();
    if (initialRule?.id) {
      formData.set("id", initialRule.id);
    }
    formData.set("weekday", String(weekday));
    formData.set("startMinute", String(startMinute));
    formData.set("endMinute", String(endMinute));
    if (effectiveFrom) formData.set("effectiveFrom", effectiveFrom);
    if (effectiveUntil) formData.set("effectiveUntil", effectiveUntil);
    if (isActive) formData.set("isActive", "on");

    startTransition(async () => {
      const result = await upsertAvailabilityRuleAction(initialAuthFormState, formData);
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : isEditing ? (
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Rule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Availability Rule" : "Add Weekly Availability Rule"}</DialogTitle>
          <DialogDescription>
            Define recurring hours when you are available for client consultations.
          </DialogDescription>
        </DialogHeader>

        {state.status === "error" && state.message && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{state.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weekday">Day of Week</Label>
            <select
              id="weekday"
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md border-border bg-background text-foreground"
            >
              {weekdays.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                step="300"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                step="300"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Effective From (Optional)</Label>
              <Input
                id="effectiveFrom"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveUntil">Effective Until (Optional)</Label>
              <Input
                id="effectiveUntil"
                type="date"
                value={effectiveUntil}
                onChange={(e) => setEffectiveUntil(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(Boolean(checked))}
            />
            <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
              Rule is active and generating slots
            </Label>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

