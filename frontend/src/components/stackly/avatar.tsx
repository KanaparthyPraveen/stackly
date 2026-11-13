import * as React from "react";
import { cn } from "@/lib/utils";

type AvatarProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Initials shown when no image src is provided. */
  initials?: string;
  src?: string;
  alt?: string;
  /** Optional live-status dot in the lower-right corner. */
  showStatus?: boolean;
};

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
  "2xl": "h-24 w-24 text-2xl",
};

/**
 * Avatar — circular surface with initials fallback.
 * Used in shell sidebar, profile preview, team mentions.
 */
export function Avatar({
  size = "md",
  initials,
  src,
  alt,
  showStatus,
  className,
  ...rest
}: AvatarProps) {
  const dim = sizeClasses[size];
  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-full border border-border bg-muted font-mono font-medium text-foreground",
        dim,
        className,
      )}
      aria-label={alt}
      {...rest}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials ?? "?"}</span>
      )}
      {showStatus && (
        <span
          aria-hidden
          className="absolute right-0 bottom-0 grid h-2.5 w-2.5 place-items-center rounded-full border-2 border-card bg-signal"
        />
      )}
    </div>
  );
}
