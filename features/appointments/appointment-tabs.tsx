import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { AppointmentTab } from "@/server/dal/appointment";
import { Calendar, History, XCircle } from "lucide-react";

interface AppointmentTabsProps {
  currentTab: AppointmentTab;
  counts?: {
    upcoming?: number;
    past?: number;
    cancelled?: number;
  };
}

export function AppointmentTabs({ currentTab, counts }: AppointmentTabsProps) {
  const tabs: Array<{
    key: AppointmentTab;
    label: string;
    icon: typeof Calendar;
    count?: number;
  }> = [
    { key: "upcoming", label: "Upcoming", icon: Calendar, count: counts?.upcoming },
    { key: "past", label: "Past Sessions", icon: History, count: counts?.past },
    { key: "cancelled", label: "Cancelled", icon: XCircle, count: counts?.cancelled },
  ];

  return (
    <div className="flex border-b border-border space-x-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.key;

        return (
          <Link
            key={tab.key}
            href={`/appointments?tab=${tab.key}`}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <Badge variant={isActive ? "default" : "secondary"} className="text-xs ml-1">
                {tab.count}
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );
}

