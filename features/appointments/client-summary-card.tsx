import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, ShieldAlert } from "lucide-react";

interface ClientSummaryCardProps {
  displayName: string;
  email?: string | null;
  phoneNumber?: string | null;
  status: string;
}

export function ClientSummaryCard({
  displayName,
  email,
  phoneNumber,
  status,
}: ClientSummaryCardProps) {
  const isContactDisclosed = status === "CONFIRMED" || status === "COMPLETED";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Client Information
          </CardTitle>
          {!isContactDisclosed && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Contact hidden
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <span className="text-xs text-muted-foreground">Display Name</span>
          <p className="text-sm font-medium">{displayName}</p>
        </div>

        {isContactDisclosed ? (
          <div className="space-y-2 pt-2 border-t text-sm">
            {email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="text-foreground select-all">{email}</span>
              </div>
            )}
            {phoneNumber && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span className="text-foreground select-all">{phoneNumber}</span>
              </div>
            )}
            {!email && !phoneNumber && (
              <p className="text-xs text-muted-foreground">
                No additional contact info registered.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2 pt-2 border-t text-xs text-muted-foreground">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <span>
              Client contact details are disclosed only after the appointment request is confirmed.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
