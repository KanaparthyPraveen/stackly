"use client";

import * as React from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type SaveStatusProps = {
  status: SaveStatus;
  message?: string;
  className?: string;
};

/**
 * SaveStatus — status pill next to Save buttons with semantic state colors.
 */
export function SaveStatus({ status, message, className }: SaveStatusProps) {
  if (status === "idle") return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono font-medium border select-none",
        status === "saving" && "bg-[#15101E] text-[#B88CFF] border-white/8",
        status === "saved" &&
          "bg-[#46D369]/15 text-[#46D369] border-[#46D369]/30",
        status === "error" &&
          "bg-[#FF5C70]/15 text-[#FF5C70] border-[#FF5C70]/30",
        className,
      )}
    >
      {status === "saving" && (
        <Loader2
          className="h-3 w-3 animate-spin-slow text-[#B88CFF]"
          aria-hidden
        />
      )}
      {status === "saved" && (
        <Check className="h-3 w-3 text-[#46D369]" aria-hidden />
      )}
      {status === "error" && (
        <AlertCircle className="h-3 w-3 text-[#FF5C70]" aria-hidden />
      )}
      {message ??
        (status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved"
            : status === "error"
              ? "Couldn't save"
              : "")}
    </span>
  );
}
