"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusChangeDialog } from "./status-change-dialog";
import { RoleChangeDialog } from "./role-change-dialog";
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Globe,
  Key,
  History,
  Briefcase,
} from "lucide-react";
import type { AdminUserDetailRow } from "@/server/dal/admin";

interface UserDetailProps {
  user: AdminUserDetailRow;
}

export function UserDetail({ user }: UserDetailProps) {
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
            Back to users
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRoleDialog(true)}
          >
            Change Role
          </Button>
          <Button
            variant={user.status === "ACTIVE" ? "destructive" : "default"}
            size="sm"
            onClick={() => setShowStatusDialog(true)}
          >
            Change Status
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Core Account Card */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                {user.fullName}
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{user.role}</Badge>
                <Badge
                  variant={
                    user.status === "ACTIVE"
                      ? "default"
                      : user.status === "SUSPENDED"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {user.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Email Address</span>
                <span className="font-medium flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {user.email}
                </span>
                <span className="text-xs text-muted-foreground block mt-0.5">
                  {user.emailVerifiedAt ? "Verified" : "Unverified"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Timezone</span>
                <span className="font-medium flex items-center gap-1.5 mt-0.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  {user.timezone}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Account Registered</span>
                <span className="font-medium flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {format(new Date(user.createdAt), "MMMM d, yyyy")}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Active Sessions</span>
                <span className="font-medium flex items-center gap-1.5 mt-0.5">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  {user.activeSessionsCount} active
                </span>
              </div>
            </div>

            {/* Profile Subsections */}
            {user.clientProfile && (
              <div className="pt-4 border-t space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Client Profile
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Display Name</span>
                    <span className="font-medium">{user.clientProfile.displayName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Phone</span>
                    <span className="font-medium">{user.clientProfile.phone || "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {user.consultantProfile && (
              <div className="pt-4 border-t space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  Consultant Profile
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">Headline</span>
                    <span className="font-medium">{user.consultantProfile.headline}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Verification Status</span>
                    <Badge variant="outline" className="mt-0.5">
                      {user.consultantProfile.verificationStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Accepting Bookings</span>
                    <span className="font-medium">
                      {user.consultantProfile.isAcceptingBookings ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Audit / Security Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Recent Account Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No recent administrative activity recorded for this user.
              </p>
            ) : (
              user.recentActivity.map((act) => (
                <div key={act.id} className="text-xs border-b pb-2 last:border-0 last:pb-0">
                  <div className="font-medium text-foreground">{act.action}</div>
                  <div className="text-muted-foreground flex justify-between mt-0.5">
                    <span>{act.entityType}</span>
                    <span>{format(new Date(act.createdAt), "MMM d, h:mm a")}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <StatusChangeDialog
        userId={user.id}
        userName={user.fullName}
        currentStatus={user.status}
        isOpen={showStatusDialog}
        onOpenChange={setShowStatusDialog}
      />
      <RoleChangeDialog
        userId={user.id}
        userName={user.fullName}
        currentRole={user.role}
        isOpen={showRoleDialog}
        onOpenChange={setShowRoleDialog}
      />
    </div>
  );
}
