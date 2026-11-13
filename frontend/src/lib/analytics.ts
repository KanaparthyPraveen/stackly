import type { AnalyticsReport } from "./api";

export type AnalyticsRange = AnalyticsReport["range"];

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

/** The report shown before any data has loaded: everything is zero. */
export const EMPTY_REPORT: AnalyticsReport = {
  range: "30d",
  summary: { views: 0, clicks: 0, projectClicks: 0, ctr: 0 },
  viewsSeries: [],
  clicksSeries: [],
  topLinks: [],
  topProjects: [],
};

/**
 * Formats a relative change (0.12 → "+12%"). Returns undefined when the
 * backend has no previous period to compare against, so no figure is shown.
 */
export function formatChange(
  change: number | null | undefined,
): string | undefined {
  if (change === null || change === undefined || !Number.isFinite(change)) {
    return undefined;
  }
  const pct = Math.round(change * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
