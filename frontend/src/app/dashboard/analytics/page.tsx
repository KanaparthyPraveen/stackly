"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/stackly/app-shell";
import { PageHeader } from "@/components/stackly/page-header";
import { StatCard } from "@/components/stackly/stat-card";
import { Chart } from "@/components/stackly/chart";
import { useAuth } from "@/context/auth-context";
import { useDashboardProfile } from "@/context/profile-context";
import { api, type AnalyticsReport } from "@/lib/api";
import {
  EMPTY_REPORT,
  formatChange,
  type AnalyticsRange,
  RANGE_LABELS,
} from "@/lib/analytics";
import { Eye, MousePointerClick, FolderGit2, Percent } from "lucide-react";

const RANGES: AnalyticsRange[] = ["7d", "30d", "90d"];

export default function AnalyticsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { profile } = useDashboardProfile();
  const [range, setRange] = React.useState<AnalyticsRange>("30d");
  const [data, setData] = React.useState<AnalyticsReport>(EMPTY_REPORT);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    api
      .getAnalytics(range)
      .then((report) => {
        if (!mounted) return;
        setData(report);
        setErrorMsg(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setData({ ...EMPTY_REPORT, range });
        setErrorMsg(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't load analytics.",
        );
      });
    return () => {
      mounted = false;
    };
  }, [range]);

  const handleLogout = React.useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  return (
    <AppShell
      title="Analytics"
      subtitle="Profile traffic, link clicks, and the projects getting the most attention."
      profile={profile}
      onLogout={handleLogout}
    >
      <div className="space-y-8 max-w-6xl">
        {errorMsg && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {errorMsg}
          </div>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PageHeader
            eyebrow="Analytics & Insights"
            title="Profile Performance"
            description="Hourly aggregated metrics for visits, repository interest, and outgoing clicks."
          />
          <div
            role="radiogroup"
            aria-label="Date range"
            className="flex items-center rounded-[10px] border border-white/8 bg-[#15101E] p-1"
          >
            {RANGES.map((r) => {
              const selected = r === range;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRange(r)}
                  className={
                    "rounded-[8px] px-3.5 py-1 text-xs font-mono font-medium transition-all " +
                    (selected
                      ? "bg-[#7C3AED] text-[#FAF7FF] shadow-xs"
                      : "text-[#9C92A8] hover:text-[#FAF7FF]")
                  }
                >
                  {RANGE_LABELS[r]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Profile Views"
            value={data.summary.views.toLocaleString()}
            hint={RANGE_LABELS[range].toLowerCase()}
            delta={formatChange(data.change?.views)}
            icon={<Eye className="h-4 w-4" />}
          />
          <StatCard
            label="Link Clicks"
            value={data.summary.clicks.toLocaleString()}
            hint={RANGE_LABELS[range].toLowerCase()}
            delta={formatChange(data.change?.clicks)}
            icon={<MousePointerClick className="h-4 w-4" />}
          />
          <StatCard
            label="Project Views"
            value={data.summary.projectClicks.toLocaleString()}
            hint={RANGE_LABELS[range].toLowerCase()}
            delta={formatChange(data.change?.projectClicks)}
            icon={<FolderGit2 className="h-4 w-4" />}
          />
          <StatCard
            label="Avg CTR"
            value={`${Math.round(data.summary.ctr * 100)}%`}
            hint="clicks / views"
            icon={<Percent className="h-4 w-4" />}
          />
        </div>

        {/* Views over time */}
        <section
          aria-label="Views over time"
          className="rounded-[18px] border border-white/8 bg-[#191321] p-5 sm:p-6 shadow-sm"
        >
          <header className="mb-4 flex items-baseline justify-between border-b border-white/6 pb-3">
            <h2 className="font-display text-base font-semibold text-[#FAF7FF] tracking-tight">
              Traffic Activity
            </h2>
            <div className="flex items-center gap-4 font-mono text-[11px] text-[#9C92A8]">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full bg-[#B88CFF]"
                />
                Views
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full bg-[#81778D]"
                />
                Clicks
              </span>
            </div>
          </header>
          <div className="h-[220px] text-[#FAF7FF]">
            <Chart
              data={data.viewsSeries}
              secondary={data.clicksSeries}
              height={220}
            />
          </div>
        </section>

        {/* Top links & projects breakdown */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[18px] border border-white/8 bg-[#191321] p-5 sm:p-6 shadow-sm">
            <h2 className="mb-4 font-display text-base font-semibold text-[#FAF7FF] tracking-tight">
              Top Converting Links
            </h2>
            {data.topLinks.length === 0 && (
              <p className="font-mono text-xs text-[#9C92A8]">
                No link clicks in this period yet.
              </p>
            )}
            <ol className="space-y-3">
              {data.topLinks.map((item, i) => {
                const max = Math.max(data.topLinks[0].count, 1);
                const pct = (item.count / max) * 100;
                return (
                  <li key={item.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 font-mono text-xs text-[#81778D]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-[#FAF7FF]">
                      {item.label}
                    </span>
                    <span className="font-mono tabular-nums text-xs text-[#9C92A8]">
                      {item.count.toLocaleString()}
                    </span>
                    <span
                      aria-hidden
                      className="h-1.5 w-20 overflow-hidden rounded-full bg-[#15101E]"
                    >
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#B88CFF]"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="rounded-[18px] border border-white/8 bg-[#191321] p-5 sm:p-6 shadow-sm">
            <h2 className="mb-4 font-display text-base font-semibold text-[#FAF7FF] tracking-tight">
              Top Project Click-throughs
            </h2>
            {data.topProjects.length === 0 && (
              <p className="font-mono text-xs text-[#9C92A8]">
                No project clicks in this period yet.
              </p>
            )}
            <ol className="space-y-3">
              {data.topProjects.map((item, i) => {
                const max = Math.max(data.topProjects[0].count, 1);
                const pct = (item.count / max) * 100;
                return (
                  <li key={item.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 font-mono text-xs text-[#81778D]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-[#FAF7FF]">
                      {item.label}
                    </span>
                    <span className="font-mono tabular-nums text-xs text-[#9C92A8]">
                      {item.count.toLocaleString()}
                    </span>
                    <span
                      aria-hidden
                      className="h-1.5 w-20 overflow-hidden rounded-full bg-[#15101E]"
                    >
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#B88CFF]"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
