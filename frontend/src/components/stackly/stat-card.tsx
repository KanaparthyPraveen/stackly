import * as React from "react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  icon?: React.ReactNode;
  className?: string;
};

/**
 * StatCard — metric tile with midnight purple surface (#191321),
 * crisp white numerals, and soft violet accents on hover.
 */
export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[16px] border border-white/8 bg-[#191321] p-4.5 sm:p-5 transition-all duration-200 hover:border-[#B88CFF]/25 hover:bg-[#1C1526]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#9C92A8]">
          {label}
        </span>
        {icon && (
          <span className="text-[#B88CFF]/70" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2.5 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAF7FF] tabular-nums">
        {value}
      </div>
      {(hint || delta) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-[#9C92A8]">
          {delta && (
            <span className="font-mono text-[#46D369] font-medium">
              {delta}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}
