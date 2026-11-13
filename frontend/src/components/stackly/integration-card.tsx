import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { StatusDot } from "./status-dot";

export type IntegrationStatus = "connected" | "available" | "coming-soon";

export type Integration = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: IntegrationStatus;
  handle?: string;
};

type IntegrationCardProps = {
  integration: Integration;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConfigure?: () => void;
  className?: string;
};

/**
 * IntegrationCard — developer ecosystem connection (GitHub / Discord / etc).
 * Midnight purple surface with clear status distinction.
 */
export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onConfigure,
  className,
}: IntegrationCardProps) {
  const { id, name, description, icon, status, handle } = integration;
  return (
    <article
      className={cn(
        "rounded-[16px] border border-white/8 bg-[#191321] p-5 sm:p-6 transition-all duration-200",
        status === "connected"
          ? "border-[#B88CFF]/25 bg-[#1B1424]"
          : "hover:border-white/15",
        className,
      )}
    >
      <header className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/8 bg-[#15101E] text-[#FAF7FF] shadow-xs">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold tracking-tight text-[#FAF7FF]">
            {name}
          </h3>
          <p className="mt-1 text-sm text-[#9C92A8] text-pretty leading-relaxed">
            {description}
          </p>
        </div>
      </header>

      <div className="mt-5 flex items-center justify-between border-t border-white/6 pt-4">
        <div className="flex items-center gap-2 text-xs">
          {status === "connected" ? (
            <>
              <StatusDot variant="pulse" intent="live" />
              <span className="font-mono text-xs text-[#FAF7FF]/90">
                {handle ?? "connected"}
              </span>
            </>
          ) : status === "coming-soon" ? (
            <>
              <StatusDot variant="static" intent="warning" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#F5B84B]">
                coming soon
              </span>
            </>
          ) : (
            <>
              <StatusDot variant="static" intent="offline" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#81778D]">
                not connected
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "connected" && (
            <>
              <Button size="sm" variant="ghost" onClick={onConfigure}>
                Configure
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDisconnect}
                aria-label={`Disconnect ${name}`}
              >
                Disconnect
              </Button>
            </>
          )}
          {status === "available" && (
            <Button
              size="sm"
              onClick={onConnect}
              aria-label={`Connect ${name}`}
            >
              Connect
            </Button>
          )}
          {status === "coming-soon" && (
            <Button size="sm" variant="ghost" disabled>
              Notify me
            </Button>
          )}
        </div>
      </div>
      <span hidden data-integration-id={id} />
    </article>
  );
}
