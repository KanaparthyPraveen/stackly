"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import type { Profile } from "./profile-preview";

type AppShellProps = {
  title: string;
  subtitle?: string;
  profile?: Profile | null;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onLogout?: () => void;
};

/**
 * AppShell — desktop persistent sidebar + minimal header + main content workspace.
 * Mobile drawer with accessible backdrop.
 */
export function AppShell({
  title,
  subtitle,
  profile,
  headerAction,
  children,
  className,
  onLogout,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "flex min-h-screen w-full flex-col bg-[#09070D] text-[#D8D1E0]",
        className,
      )}
    >
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <div className="sticky top-0 hidden h-screen md:block">
          <AppSidebar profile={profile} onLogout={onLogout} />
        </div>

        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute inset-0 bg-[#09070D]/80 backdrop-blur-md transition-opacity"
            />
            <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] shadow-2xl">
              <AppSidebar
                profile={profile}
                onLogout={onLogout}
                variant="drawer"
                onNavigate={() => setMobileNavOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            title={title}
            subtitle={subtitle}
            profile={profile}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            rightAction={headerAction}
          />
          {profile?.username && profile.username.startsWith("user_") && (
            <div className="flex items-center justify-between gap-3 border-b border-[#B88CFF]/20 bg-[#7C3AED]/10 px-4 py-2 text-xs text-[#FAF7FF] md:px-8">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B88CFF] animate-pulse" />
                <span>
                  Using temporary handle{" "}
                  <strong className="font-mono text-[#B88CFF]">
                    @{profile.username}
                  </strong>
                  .
                </span>
              </span>
              <Link
                href="/claim-username"
                className="font-medium text-[#B88CFF] underline underline-offset-2 hover:text-[#FAF7FF] transition-colors"
              >
                Claim custom username →
              </Link>
            </div>
          )}
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
