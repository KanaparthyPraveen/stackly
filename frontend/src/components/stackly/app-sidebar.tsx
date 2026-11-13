"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ProfileAvatar } from "./profile-avatar";
import { Button } from "./button";
import { NAV_GROUPS, SECONDARY_NAV } from "@/lib/nav";
import type { Profile } from "./profile-preview";

type AppSidebarProps = {
  profile?: Profile | null;
  onLogout?: () => void;
  className?: string;
  variant?: "desktop" | "drawer";
  onNavigate?: () => void;
};

/**
 * AppSidebar — calm, premium developer-tool navigation.
 * Midnight purple background (#0F0B16), quiet hierarchy,
 * subtle violet active indicators with no giant neon blocks.
 */
export function AppSidebar({
  profile,
  onLogout,
  className,
  variant = "desktop",
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const linkBase =
    "group flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-all duration-150 relative";

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col gap-4 border-r border-white/8 bg-[#0F0B16] p-4 text-[#D8D1E0] select-none",
        variant === "drawer" && "bg-[#09070D] shadow-2xl",
        className,
      )}
    >
      {/* Brand Header */}
      <Link
        href="/"
        className="flex items-center gap-2.5 px-2 py-1.5 text-sm font-semibold tracking-tight text-[#FAF7FF] transition-opacity hover:opacity-90"
        onClick={onNavigate}
      >
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#7C3AED]/20 border border-[#B88CFF]/30 text-[#B88CFF] shadow-xs">
          <Logo className="h-4 w-auto text-[#FAF7FF]" />
        </div>
        <span className="font-display text-base tracking-tight">Stackly</span>
        <span className="ml-auto rounded-full border border-white/8 bg-[#15101E] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#9C92A8]">
          dev
        </span>
      </Link>

      {/* Nav groups */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto pt-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {group.label && (
              <div className="px-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#81778D]">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    linkBase,
                    active
                      ? "bg-[#1F172E] text-[#FAF7FF] border border-[#B88CFF]/20 shadow-xs"
                      : "text-[#9C92A8] hover:bg-[#15101E] hover:text-[#FAF7FF]",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      active
                        ? "text-[#B88CFF]"
                        : "text-[#81778D] group-hover:text-[#FAF7FF]",
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {active && (
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-[#B88CFF] shadow-[0_0_8px_#B88CFF]"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Secondary nav group */}
        <div className="flex flex-col gap-1 pt-2 border-t border-white/6">
          <div className="px-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#81778D]">
            Account
          </div>
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  linkBase,
                  active
                    ? "bg-[#1F172E] text-[#FAF7FF] border border-[#B88CFF]/20"
                    : "text-[#9C92A8] hover:bg-[#15101E] hover:text-[#FAF7FF]",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active
                      ? "text-[#B88CFF]"
                      : "text-[#81778D] group-hover:text-[#FAF7FF]",
                  )}
                  aria-hidden
                />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User profile card pinned to bottom */}
      <div className="mt-auto rounded-[14px] border border-white/8 bg-[#15101E] p-3 transition-colors hover:border-white/12">
        <div className="flex items-center gap-2.5">
          <ProfileAvatar
            src={profile?.avatarUrl}
            name={profile?.displayName ?? profile?.username}
            live
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-[#FAF7FF]">
              {profile?.displayName ?? profile?.username ?? "Developer"}
            </div>
            <div className="truncate font-mono text-[10px] text-[#9C92A8]">
              @{profile?.username ?? "user"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            aria-label="Sign out"
            className="h-8 w-8 text-[#9C92A8] hover:text-[#FF5C70] hover:bg-[#FF5C70]/10"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
