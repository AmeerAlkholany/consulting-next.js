"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  onSignOut: () => void;
}

/**
 * Sign-out button for the app shell.
 * The form uses a Server Action for the actual logout.
 */
export function UserMenu({ onSignOut }: UserMenuProps) {
  return (
    <form action={onSignOut}>
      <Button variant="outline" size="sm" type="submit">
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </form>
  );
}
