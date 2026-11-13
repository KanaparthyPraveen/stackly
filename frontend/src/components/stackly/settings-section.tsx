import * as React from "react";
import { cn } from "@/lib/utils";

type SettingsSectionProps = React.HTMLAttributes<HTMLElement> & {
  title: string;
  description?: string;
  destructive?: boolean;
  children: React.ReactNode;
};

/**
 * SettingsSection — Midnight Purple surface wrapper (#191321).
 */
export function SettingsSection({
  title,
  description,
  destructive,
  children,
  className,
  ...props
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        "rounded-[18px] border border-white/8 bg-[#191321] p-5 sm:p-6 shadow-sm",
        destructive && "border-[#FF5C70]/35 bg-[#191321]",
        className,
      )}
      {...props}
    >
      <header className="mb-4 space-y-1">
        <h2
          className={cn(
            "font-display text-base font-semibold tracking-tight",
            destructive ? "text-[#FF5C70]" : "text-[#FAF7FF]",
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[#9C92A8] text-pretty leading-relaxed">
            {description}
          </p>
        )}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
