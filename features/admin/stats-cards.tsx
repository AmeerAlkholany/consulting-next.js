import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileCheck, TrendingUp, Award } from "lucide-react";
import type { PlatformStats } from "@/server/dal/admin";

interface StatsCardsProps {
  stats: PlatformStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Registered Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.usersByRole.total}</div>
          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
            <span>{stats.usersByRole.clients} clients</span>
            <span>•</span>
            <span>{stats.usersByRole.consultants} consultants</span>
            <span>•</span>
            <span>{stats.usersByRole.admins} admins</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pending Consultant Reviews</CardTitle>
          <FileCheck className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.pendingConsultantApplications}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Awaiting credential verification</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Bookings (Last 30 Days)</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.bookingsLast30Days}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Total appointments: {stats.appointmentsByStatus.total}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Session Completion Rate</CardTitle>
          <Award className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completionRatePercent}%</div>
          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
            <span>{stats.appointmentsByStatus.completed} completed</span>
            <span>•</span>
            <span>{stats.appointmentsByStatus.noShow} no-show</span>
            <span>•</span>
            <span>{stats.appointmentsByStatus.cancelled} cancelled</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
