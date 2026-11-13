import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "outline"
  | "purple"
  | "signal"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "border-transparent bg-[#15101E] text-[#FAF7FF] border border-white/8",
  outline: "border-white/10 bg-transparent text-[#D8D1E0]",
  purple: "border-[#7C3AED]/30 bg-[#7C3AED]/15 text-[#B88CFF]",
  signal: "border-[#B88CFF]/30 bg-[#7C3AED]/15 text-[#B88CFF]",
  success: "border-[#46D369]/30 bg-[#46D369]/10 text-[#46D369]",
  warning: "border-[#F5B84B]/30 bg-[#F5B84B]/10 text-[#F5B84B]",
  danger: "border-[#FF5C70]/30 bg-[#FF5C70]/10 text-[#FF5C70]",
  info: "border-[#6EA8FF]/30 bg-[#6EA8FF]/10 text-[#6EA8FF]",
  muted: "border-transparent bg-[#15101E]/80 text-[#9C92A8]",
};

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: BadgeVariant;
};

export function Badge({
  className,
  variant = "outline",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight transition-colors select-none",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
