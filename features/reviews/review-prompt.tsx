import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MessageSquarePlus } from "lucide-react";

export interface ReviewPromptAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  consultationType: string;
  consultantProfile: {
    id: string;
    slug: string;
    user: {
      fullName: string;
    };
  };
}

interface ReviewPromptProps {
  appointments: ReviewPromptAppointment[];
}

export function ReviewPrompt({ appointments }: ReviewPromptProps) {
  if (!appointments || appointments.length === 0) {
    return null;
  }

  // Focus on the most recently completed appointment awaiting review
  const first = appointments[0];
  const consultantName = first.consultantProfile.user.fullName;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-950 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900 dark:text-amber-300">
          <MessageSquarePlus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Review your recent session
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
        <div className="space-y-1">
          <p className="text-sm text-foreground">
            You recently completed your consultation with{" "}
            <span className="font-medium">{consultantName}</span>.
          </p>
          <p className="text-xs text-muted-foreground">
            Your anonymous feedback helps others in the community find the right care.
          </p>
        </div>
        <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
          <Link href={`/appointments/${first.id}/review` as unknown as "/appointments"}>
            <Star className="h-3.5 w-3.5 mr-1 fill-current" />
            Leave a Review
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
