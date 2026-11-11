import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Globe } from "lucide-react";

interface TimezoneNoticeProps {
  timezone: string;
}

export function TimezoneNotice({ timezone }: TimezoneNoticeProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle>Timezone</CardTitle>
        </div>
        <CardDescription>
          All rules and availability intervals are interpreted in your local timezone:{" "}
          <strong className="text-foreground">{timezone}</strong>. Rule times stay fixed on your
          wall clock across Daylight Saving Time (DST) transitions.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
