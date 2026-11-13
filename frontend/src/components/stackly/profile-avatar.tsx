import * as React from "react";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";

type ProfileAvatarProps = {
  src?: string;
  name?: string;
  /** Show the live-status dot in the corner. */
  live?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
};

/**
 * ProfileAvatar — wrapper around the Avatar primitive that derives
 * initials from the display name. Used everywhere a developer avatar
 * appears (sidebar, preview, /[username] header).
 */
export function ProfileAvatar({
  src,
  name,
  live,
  size = "lg",
  className,
}: ProfileAvatarProps) {
  const initials = React.useMemo(() => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  return (
    <Avatar
      src={src}
      initials={initials}
      alt={name}
      size={size}
      showStatus={live}
      className={cn("ring-1 ring-border", className)}
    />
  );
}
