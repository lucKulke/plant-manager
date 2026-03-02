"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function Nav() {
  const { logout } = useAuth();

  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold">
            Plant Manager
          </Link>
          <Link
            href="/groups"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Groups
          </Link>
          <Link
            href="/firmware-settings"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Firmware
          </Link>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          Sign Out
        </Button>
      </div>
    </nav>
  );
}
