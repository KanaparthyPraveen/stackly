import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * PageHeader — section header with playful purple eyebrow,
 * warm white headline, and clear description.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-1",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#B88CFF]">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#FAF7FF] text-balance">
          {title}
        </h2>
        {description && (
          <p className="max-w-2xl text-sm text-[#9C92A8] text-pretty leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 shrink-0">{actions}</div>
      )}
    </header>
  );
}
