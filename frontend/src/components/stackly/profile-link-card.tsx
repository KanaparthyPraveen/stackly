"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileLink = {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  enabled: boolean;
};

type ProfileLinkCardProps = {
  link: ProfileLink;
  mode?: "preview" | "manage";
  className?: string;
  style?: React.CSSProperties;
  titleStyle?: React.CSSProperties;
  descStyle?: React.CSSProperties;
  iconStyle?: React.CSSProperties;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: (enabled: boolean) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
};

/**
 * ProfileLinkCard — developer profile link.
 * Preview: elegant link surface with subtle hover lift and violet accent.
 * Manage: dashboard row with switch, reorder, edit, and delete controls.
 */
export function ProfileLinkCard({
  link,
  mode = "preview",
  className,
  style,
  titleStyle,
  descStyle,
  iconStyle,
  onEdit,
  onDelete,
  onToggle,
  dragHandleProps,
}: ProfileLinkCardProps) {
  if (mode === "manage") {
    return (
      <div
        className={cn(
          "group flex items-center gap-3 rounded-[14px] border border-white/8 bg-[#191321] px-4 py-3 transition-all hover:border-[#B88CFF]/25",
          !link.enabled && "opacity-55",
          className,
        )}
      >
        <button
          type="button"
          aria-label="Drag to reorder"
          className="grid h-7 w-5 cursor-grab place-items-center text-[#9C92A8] transition-colors hover:text-[#FAF7FF] active:cursor-grabbing"
          {...dragHandleProps}
        >
          <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden>
            <circle cx="2" cy="3" r="1" fill="currentColor" />
            <circle cx="8" cy="3" r="1" fill="currentColor" />
            <circle cx="2" cy="8" r="1" fill="currentColor" />
            <circle cx="8" cy="8" r="1" fill="currentColor" />
            <circle cx="2" cy="13" r="1" fill="currentColor" />
            <circle cx="8" cy="13" r="1" fill="currentColor" />
          </svg>
        </button>

        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/8 bg-[#15101E] text-sm text-[#FAF7FF]">
          <span aria-hidden>{link.icon ?? "↗"}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[#FAF7FF]">
            {link.title}
          </div>
          <div className="truncate font-mono text-xs text-[#9C92A8]">
            {link.url}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Inline toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={link.enabled}
            aria-label={`${link.enabled ? "Disable" : "Enable"} ${link.title}`}
            onClick={() => onToggle?.(!link.enabled)}
            className={cn(
              "relative h-5 w-9 rounded-full border transition-colors",
              link.enabled
                ? "border-[#7C3AED] bg-[#7C3AED]"
                : "border-white/10 bg-[#15101E]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all shadow-xs",
                link.enabled
                  ? "left-[18px] bg-[#FAF7FF]"
                  : "left-0.5 bg-[#9C92A8]",
              )}
            />
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="grid h-7 w-7 place-items-center rounded-lg text-[#9C92A8] transition-colors hover:bg-white/8 hover:text-[#FAF7FF]"
            aria-label={`Edit ${link.title}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="grid h-7 w-7 place-items-center rounded-lg text-[#9C92A8] transition-colors hover:bg-[#FF5C70]/15 hover:text-[#FF5C70]"
            aria-label={`Delete ${link.title}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Preview mode — public-facing card
  return (
    <a
      href={link.enabled ? link.url : undefined}
      target={link.enabled ? "_blank" : undefined}
      rel={link.enabled ? "noreferrer noopener" : undefined}
      aria-disabled={!link.enabled}
      style={style}
      className={cn(
        "group block rounded-[14px] border border-white/8 bg-[#191321] px-4 py-3.5 transition-all duration-200",
        link.enabled
          ? "hover:border-[#B88CFF]/30 hover:bg-[#1E172B] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20"
          : "opacity-50 pointer-events-none",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/8 bg-[#15101E] text-sm text-[#FAF7FF] transition-colors group-hover:border-[#B88CFF]/40"
          style={iconStyle}
        >
          <span aria-hidden>{link.icon ?? "↗"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-sm font-medium text-[#FAF7FF]"
            style={titleStyle}
          >
            {link.title}
          </div>
          {link.description && (
            <div
              className="truncate text-xs text-[#9C92A8] text-pretty"
              style={descStyle}
            >
              {link.description}
            </div>
          )}
        </div>
        <ExternalLink
          className="h-4 w-4 shrink-0 text-[#9C92A8] transition-colors group-hover:text-[#B88CFF]"
          aria-hidden
        />
      </div>
    </a>
  );
}
