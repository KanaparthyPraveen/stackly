import { cn } from "@/lib/utils";

type StatusDotProps = {
  variant?: "solid" | "pulse" | "static";
  intent?: "live" | "offline" | "warning" | "purple";
  size?: "sm" | "md";
  label?: string;
  className?: string;
};

/**
 * Status dot — live indicators, connections, and badges.
 * Features restrained pulse and semantic colors.
 */
export function StatusDot({
  variant = "solid",
  intent = "live",
  size = "sm",
  label,
  className,
}: StatusDotProps) {
  const dotSize = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const color =
    intent === "live"
      ? "bg-[#46D369]"
      : intent === "warning"
        ? "bg-[#F5B84B]"
        : intent === "purple"
          ? "bg-[#B88CFF]"
          : "bg-[#81778D]";

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      {variant === "pulse" && (
        <span
          aria-hidden
          className={cn(
            "absolute inline-flex h-full w-full animate-ping-slow rounded-full opacity-60",
            color,
          )}
        />
      )}
      <span
        aria-hidden
        className={cn(
          "relative inline-flex rounded-full shrink-0",
          dotSize,
          color,
        )}
      />
      {label ? (
        <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-[#9C92A8]">
          {label}
        </span>
      ) : null}
    </span>
  );
}
