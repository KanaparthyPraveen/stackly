import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — midnight purple surface (#191321), subtle border, 16px radius.
 * Feels like an elevated surface rather than a harsh floating box.
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { flush?: boolean; elevated?: boolean }
>(function Card({ className, flush, elevated, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[16px] border border-white/8 text-[#FAF7FF] transition-colors",
        elevated ? "bg-[#1F172B] shadow-lg shadow-black/20" : "bg-[#191321]",
        !flush && "p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
});

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-3 flex flex-col space-y-1.5", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-lg tracking-tight text-[#FAF7FF]",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-[#9C92A8] leading-relaxed", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-[#D8D1E0]", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-5 flex items-center justify-between border-t border-white/6 pt-4 text-xs text-[#9C92A8]",
        className,
      )}
      {...props}
    />
  );
}
