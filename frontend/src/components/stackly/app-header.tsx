"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ExternalLink, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { Button } from "./button";
import type { Profile } from "./profile-preview";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  profile?: Profile | null;
  onOpenMobileNav?: () => void;
  rightAction?: React.ReactNode;
  className?: string;
};

/**
 * AppHeader — clean, minimal developer top bar.
 * Midnight purple background (#09070D/85), subtle border, search,
 * quick profile link and actions.
 */
export function AppHeader({
  title,
  subtitle,
  profile,
  onOpenMobileNav,
  rightAction,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/8 bg-[#09070D]/90 px-4 backdrop-blur-md md:px-6 select-none",
        className,
      )}
    >
      {onOpenMobileNav && (
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="grid h-8 w-8 place-items-center rounded-lg text-[#9C92A8] transition-colors hover:bg-white/8 hover:text-[#FAF7FF] md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[#FAF7FF] md:hidden"
      >
        <Logo className="h-5 w-auto" />
        <span>Stackly</span>
      </Link>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-sm md:text-base font-semibold tracking-tight text-[#FAF7FF]">
          {title}
        </h1>
        {subtitle && (
          <p className="hidden truncate text-xs text-[#9C92A8] md:block">
            {subtitle}
          </p>
        )}
      </div>

      {/* Search field — desktop only */}
      <div className="hidden items-center md:flex">
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9C92A8]" />
          <input
            type="search"
            placeholder="Search projects, links…"
            className="h-8.5 w-52 rounded-[10px] border border-white/8 bg-[#15101E] pl-8.5 pr-3 text-xs text-[#FAF7FF] placeholder:text-[#9C92A8]/60 transition-colors focus-visible:border-[#B88CFF]/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B88CFF]/20"
          />
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {profile?.username && (
          <Button
            variant="ghost"
            size="sm"
            asChild={false}
            className="hidden sm:inline-flex h-8 px-2.5 text-xs text-[#B8AFC4]"
          >
            <Link
              href={`/${profile.username}`}
              target="_blank"
              className="inline-flex items-center gap-1.5"
            >
              <span className="font-mono text-[#FAF7FF]">
                @{profile.username}
              </span>
              <ExternalLink className="h-3 w-3 text-[#9C92A8]" />
            </Link>
          </Button>
        )}
        {rightAction}
      </div>
    </header>
  );
}
