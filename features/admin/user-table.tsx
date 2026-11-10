"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Key } from "lucide-react";
import { StatusChangeDialog } from "./status-change-dialog";
import { RoleChangeDialog } from "./role-change-dialog";
import type { AdminUserRow } from "@/server/dal/admin";

interface UserTableProps {
  users: AdminUserRow[];
}

export function UserTable({ users }: UserTableProps) {
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground">
              <th className="p-3 text-left font-medium">User</th>
              <th className="p-3 text-left font-medium">Role</th>
              <th className="p-3 text-left font-medium">Status</th>
              <th className="p-3 text-left font-medium">Active Sessions</th>
              <th className="p-3 text-left font-medium">Joined</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No users found matching the selected criteria.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="font-medium text-foreground">{u.fullName}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        u.status === "ACTIVE"
                          ? "default"
                          : u.status === "SUSPENDED"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-xs"
                    >
                      {u.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Key className="h-3.5 w-3.5" />
                      <span>{u.activeSessionsCount} active</span>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {format(new Date(u.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/users/${u.id}`}>View Details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(u);
                            setShowStatusDialog(true);
                          }}
                        >
                          Change Status
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(u);
                            setShowRoleDialog(true);
                          }}
                        >
                          Change Role
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <>
          <StatusChangeDialog
            userId={selectedUser.id}
            userName={selectedUser.fullName}
            currentStatus={selectedUser.status}
            isOpen={showStatusDialog}
            onOpenChange={setShowStatusDialog}
          />
          <RoleChangeDialog
            userId={selectedUser.id}
            userName={selectedUser.fullName}
            currentRole={selectedUser.role}
            isOpen={showRoleDialog}
            onOpenChange={setShowRoleDialog}
          />
        </>
      )}
    </>
  );
}
