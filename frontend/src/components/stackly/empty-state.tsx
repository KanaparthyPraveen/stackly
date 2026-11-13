import * as React from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

/**
 * Empty state with personality — elevated dark surface, soft violet dashed border,
 * concise copy and clear primary action.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-[16px] border border-dashed border-white/10 bg-[#15101E]/60 px-6 py-14 text-center transition-colors hover:border-[#B88CFF]/20",
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/8 bg-[#191321] text-[#B88CFF] shadow-xs">
          {icon}
        </div>
      )}
      <div className="space-y-1.5 max-w-sm">
        <h3 className="font-display text-base font-semibold tracking-tight text-[#FAF7FF]">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-[#9C92A8] text-pretty leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
