"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Link2,
  FolderGit2,
  Palette,
  Eye,
  Edit3,
  GitBranch,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Plus,
  Flame,
} from "lucide-react";
import { AppShell } from "@/components/stackly/app-shell";
import { Button } from "@/components/stackly/button";
import { Badge } from "@/components/stackly/badge";
import { StatusDot } from "@/components/stackly/status-dot";
import { ProfileAvatar } from "@/components/stackly/profile-avatar";
import {
  ProfilePreview,
  type Profile,
} from "@/components/stackly/profile-preview";
import { GithubIcon, DiscordIcon } from "@/components/stackly/icons";
import {
  api,
  type AnalyticsReport,
  type ChangelogItem,
  type IntegrationItem,
  type LinkItem,
  type ProjectItem,
} from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { useDashboardProfile } from "@/context/profile-context";
import { EMPTY_REPORT, formatChange } from "@/lib/analytics";
import { DEFAULT_APPEARANCE, normalizeAppearance } from "@/lib/appearance";

/** Shown in the shell for the brief moment before the profile has loaded. */
const LOADING_PROFILE: Profile = { username: "", displayName: "" };

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profile: loadedProfile, data: profileData } = useDashboardProfile();

  const [liveLinks, setLiveLinks] = React.useState<LinkItem[]>([]);
  const [liveProjects, setLiveProjects] = React.useState<ProjectItem[]>([]);
  const [liveIntegrations, setLiveIntegrations] = React.useState<
    IntegrationItem[]
  >([]);
  const [changelog, setChangelog] = React.useState<ChangelogItem[]>([]);
  const [analytics, setAnalytics] =
    React.useState<AnalyticsReport>(EMPTY_REPORT);

  React.useEffect(() => {
    let mounted = true;
    async function loadAll() {
      const [l, p, i, c, a] = await Promise.allSettled([
        api.getLinks(),
        api.getProjects(),
        api.getIntegrations(),
        api.getChangelog(10),
        api.getAnalytics("30d"),
      ]);

      if (!mounted) return;

      if (l.status === "fulfilled") setLiveLinks(l.value);
      if (p.status === "fulfilled") setLiveProjects(p.value);
      if (i.status === "fulfilled") setLiveIntegrations(i.value);
      if (c.status === "fulfilled") setChangelog(c.value);
      if (a.status === "fulfilled") setAnalytics(a.value);
    }
    loadAll();
    return () => {
      mounted = false;
    };
  }, [user]);

  const profile: Profile = loadedProfile ?? LOADING_PROFILE;
  const isLive = profile.live === true;

  const handleLogout = React.useCallback(async () => {
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  }, [logout, router]);

  // Profile completion checklist — every item reflects saved data.
  const appearance = normalizeAppearance(profileData?.appearance);
  const hasCustomTheme =
    appearance.accent !== DEFAULT_APPEARANCE.accent ||
    appearance.background !== DEFAULT_APPEARANCE.background ||
    Object.values(appearance.colors ?? {}).some(Boolean);
  const enabledLinks = liveLinks.filter((l) => l.enabled !== false);
  const githubConnected = liveIntegrations.some(
    (i) => i.integrationId === "github" && i.status === "connected",
  );
  const completionItems = [
    {
      label: "Profile bio & avatar",
      completed: Boolean(profile.bio && profile.avatarUrl),
    },
    { label: "Public links added", completed: liveLinks.length > 0 },
    { label: "Projects showcased", completed: liveProjects.length > 0 },
    { label: "GitHub integration linked", completed: githubConnected },
    { label: "Custom theme selected", completed: hasCustomTheme },
  ];

  const viewsChange = formatChange(analytics.change?.views);
  const clicksChange = formatChange(analytics.change?.clicks);

  const previewLinks = enabledLinks.map((l) => ({
    id: l.id || l._id || "",
    title: l.title,
    url: l.url,
    description: l.description,
    icon: l.icon,
    enabled: true,
  }));
  const previewProjects = liveProjects.slice(0, 3).map((p) => ({
    id: p.id || p._id || "",
    name: p.name,
    description: p.description ?? "",
    tech: p.tech ?? [],
    repoUrl: p.repoUrl,
    liveUrl: p.liveUrl,
    status: p.status ?? "live",
    featured: p.featured ?? false,
  }));
  const completedCount = completionItems.filter((i) => i.completed).length;
  const completionPercent = Math.round(
    (completedCount / completionItems.length) * 100,
  );

  return (
    <AppShell
      title="Overview"
      subtitle="Your creative workspace and developer profile command center."
      profile={profile}
      headerAction={
        <Button size="sm" asChild>
          <Link href={`/${profile.username}`} target="_blank">
            <Eye className="h-3.5 w-3.5" />
            View Live
          </Link>
        </Button>
      }
      onLogout={handleLogout}
    >
      <div className="space-y-8 max-w-6xl">
        {/* Intro Hero Workspace Greeting */}
        <div className="relative overflow-hidden rounded-[20px] border border-white/8 bg-gradient-to-r from-[#191321] via-[#15101E] to-[#0F0B16] p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#7C3AED]/15 blur-3xl"
          />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[#15101E] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[#B88CFF]">
                <Sparkles className="h-3 w-3 text-[#B88CFF]" />
                Developer Workspace
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#FAF7FF]">
                Good to see you
                {profile.displayName
                  ? `, ${profile.displayName.split(" ")[0]}`
                  : ""}
                .
              </h2>
              <p className="text-sm text-[#B8AFC4] leading-relaxed">
                {isLive
                  ? "Your developer profile is live at"
                  : "Your developer profile is not published yet. Preview it at"}{" "}
                <Link
                  href={`/${profile.username}`}
                  target="_blank"
                  className="font-mono text-[#FAF7FF] underline decoration-[#B88CFF]/50 underline-offset-4 hover:decoration-[#B88CFF]"
                >
                  stackly.dev/@{profile.username}
                </Link>
                . Build, customize, and share the work you actually ship.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button size="md" asChild>
                <Link href="/dashboard/projects">
                  <Plus className="h-4 w-4" />
                  Add Project
                </Link>
              </Button>
              <Button variant="secondary" size="md" asChild>
                <Link href="/dashboard/profile">
                  <Edit3 className="h-4 w-4" />
                  Edit Profile
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Asymmetric Core Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Setup Completion */}
            <div className="rounded-[18px] border border-white/8 bg-[#191321] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#FAF7FF]">
                    Profile Readiness
                  </h3>
                  <p className="text-xs text-[#9C92A8] mt-0.5">
                    {completedCount} of {completionItems.length} steps completed
                  </p>
                </div>
                <Badge variant="purple" className="font-mono text-xs">
                  {completionPercent}% ready
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-[#15101E] overflow-hidden border border-white/6">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#B88CFF] transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>

              {/* Checklist items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {completionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 rounded-[10px] border border-white/6 bg-[#15101E]/60 px-3 py-2 text-xs"
                  >
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 ${
                        item.completed ? "text-[#46D369]" : "text-[#81778D]"
                      }`}
                    />
                    <span
                      className={
                        item.completed ? "text-[#FAF7FF]" : "text-[#9C92A8]"
                      }
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="space-y-3">
              <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#9C92A8]">
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link
                  href="/dashboard/links"
                  className="group flex flex-col items-start gap-2.5 rounded-[14px] border border-white/8 bg-[#191321] p-4 transition-all hover:border-[#B88CFF]/30 hover:bg-[#1E172B]"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#15101E] text-[#B88CFF] transition-transform group-hover:scale-105 border border-white/8">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#FAF7FF]">
                      Manage Links
                    </div>
                    <div className="text-[11px] text-[#9C92A8]">
                      {enabledLinks.length} active{" "}
                      {enabledLinks.length === 1 ? "link" : "links"}
                    </div>
                  </div>
                </Link>

                <Link
                  href="/dashboard/projects"
                  className="group flex flex-col items-start gap-2.5 rounded-[14px] border border-white/8 bg-[#191321] p-4 transition-all hover:border-[#B88CFF]/30 hover:bg-[#1E172B]"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#15101E] text-[#B88CFF] transition-transform group-hover:scale-105 border border-white/8">
                    <FolderGit2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#FAF7FF]">
                      Add Project
                    </div>
                    <div className="text-[11px] text-[#9C92A8]">
                      {liveProjects.length} published
                    </div>
                  </div>
                </Link>

                <Link
                  href="/dashboard/appearance"
                  className="group flex flex-col items-start gap-2.5 rounded-[14px] border border-white/8 bg-[#191321] p-4 transition-all hover:border-[#B88CFF]/30 hover:bg-[#1E172B]"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#15101E] text-[#B88CFF] transition-transform group-hover:scale-105 border border-white/8">
                    <Palette className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#FAF7FF]">
                      Customize Theme
                    </div>
                    <div className="text-[11px] text-[#9C92A8]">
                      Colors & layout
                    </div>
                  </div>
                </Link>

                <Link
                  href="/test-github"
                  className="group flex flex-col items-start gap-2.5 rounded-[14px] border border-white/8 bg-[#191321] p-4 transition-all hover:border-[#B88CFF]/30 hover:bg-[#1E172B]"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#15101E] text-[#B88CFF] transition-transform group-hover:scale-105 border border-white/8">
                    <GithubIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#FAF7FF]">
                      GitHub Explorer
                    </div>
                    <div className="text-[11px] text-[#9C92A8]">
                      Sync repositories
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="rounded-[18px] border border-white/8 bg-[#191321] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-[#FAF7FF]">
                  Recent Activity
                </h3>
                <Link
                  href="/dashboard/analytics"
                  className="font-mono text-xs text-[#B88CFF] hover:underline"
                >
                  View full analytics →
                </Link>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-[12px] border border-white/6 bg-[#15101E] p-3 text-xs">
                  <div className="mt-0.5 grid h-6 w-6 place-items-center rounded-lg bg-[#7C3AED]/20 text-[#B88CFF]">
                    <Flame className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#FAF7FF]">
                      Profile traffic
                    </p>
                    <p className="text-[11px] text-[#9C92A8] mt-0.5">
                      {analytics.summary.views.toLocaleString()} profile views
                      in the last 30 days
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-[#81778D]">
                    30d
                  </span>
                </div>

                {changelog.slice(0, 3).map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-start gap-3 rounded-[12px] border border-white/6 bg-[#15101E] p-3 text-xs"
                  >
                    <div className="mt-0.5 grid h-6 w-6 place-items-center rounded-lg bg-[#46D369]/15 text-[#46D369]">
                      <GitBranch className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#FAF7FF]">
                        {entry.summary}
                      </p>
                      <p className="text-[11px] text-[#9C92A8] mt-0.5">
                        {entry.action}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-[#81778D]">
                      {new Date(entry.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (1 col): Integrations & Identity Card */}
          <div className="space-y-6">
            {/* Profile Identity Card */}
            <div className="rounded-[18px] border border-white/8 bg-[#191321] p-5 space-y-4">
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  src={profile.avatarUrl}
                  name={profile.displayName}
                  live={profile.live}
                  size="lg"
                  className="ring-2 ring-[#7C3AED]/30"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-display font-semibold text-sm text-[#FAF7FF] truncate">
                    {profile.displayName}
                  </h4>
                  <p className="font-mono text-xs text-[#B88CFF] truncate">
                    @{profile.username}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {isLive ? (
                      <>
                        <StatusDot variant="pulse" intent="live" />
                        <span className="font-mono text-[10px] text-[#46D369] uppercase tracking-wider">
                          Live
                        </span>
                      </>
                    ) : (
                      <>
                        <StatusDot variant="static" intent="offline" />
                        <span className="font-mono text-[10px] text-[#81778D] uppercase tracking-wider">
                          Not published
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#B8AFC4] leading-relaxed line-clamp-3">
                {profile.bio}
              </p>

              <div className="pt-2 border-t border-white/6 flex items-center gap-2">
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <Link href="/dashboard/profile">
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>
                <Button size="sm" className="flex-1" asChild>
                  <Link href={`/${profile.username}`} target="_blank">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Preview
                  </Link>
                </Button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="rounded-[18px] border border-white/8 bg-[#191321] p-5 space-y-3">
              <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#9C92A8]">
                Traffic Snapshot
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[12px] border border-white/6 bg-[#15101E] p-3">
                  <div className="text-[11px] font-mono text-[#9C92A8]">
                    Views
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-[#FAF7FF]">
                    {analytics.summary.views.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-[#46D369] mt-0.5">
                    {viewsChange
                      ? `${viewsChange} vs prior 30d`
                      : "last 30 days"}
                  </div>
                </div>
                <div className="rounded-[12px] border border-white/6 bg-[#15101E] p-3">
                  <div className="text-[11px] font-mono text-[#9C92A8]">
                    Clicks
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-[#FAF7FF]">
                    {analytics.summary.clicks.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-[#46D369] mt-0.5">
                    {clicksChange
                      ? `${clicksChange} vs prior 30d`
                      : "last 30 days"}
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Ecosystem */}
            <div className="rounded-[18px] border border-white/8 bg-[#191321] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#9C92A8]">
                  Connections
                </h4>
                <Link
                  href="/dashboard/integrations"
                  className="font-mono text-xs text-[#B88CFF] hover:underline"
                >
                  Manage
                </Link>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-[12px] border border-white/6 bg-[#15101E] px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <GithubIcon className="h-4 w-4 text-[#FAF7FF]" />
                    <span className="text-[#FAF7FF] font-medium">GitHub</span>
                  </div>
                  {liveIntegrations.some(
                    (i) =>
                      i.integrationId === "github" && i.status === "connected",
                  ) ? (
                    <Badge variant="purple" className="px-2 py-0 text-[10px]">
                      Connected
                    </Badge>
                  ) : (
                    <span className="font-mono text-[10px] text-[#81778D]">
                      Available
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-[12px] border border-white/6 bg-[#15101E] px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <DiscordIcon className="h-4 w-4 text-[#9C92A8]" />
                    <span className="text-[#9C92A8] font-medium">Discord</span>
                  </div>
                  {liveIntegrations.some(
                    (i) =>
                      i.integrationId === "discord" && i.status === "connected",
                  ) ? (
                    <Badge variant="purple" className="px-2 py-0 text-[10px]">
                      Connected
                    </Badge>
                  ) : (
                    <span className="font-mono text-[10px] text-[#81778D]">
                      Available
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Live Link & Page Activity (MongoDB Changelog) */}
            <div className="rounded-[18px] border border-white/8 bg-[#191321] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#9C92A8]">
                  Page & Link Changes
                </h4>
                <span className="font-mono text-[10px] text-[#46D369]">
                  ● Auto-saved
                </span>
              </div>
              {changelog.length === 0 ? (
                <div className="rounded-[12px] border border-white/6 bg-[#15101E] p-3 text-center">
                  <p className="text-xs text-[#9C92A8]">
                    No changes recorded yet.
                  </p>
                  <p className="text-[10px] font-mono text-[#81778D] mt-1">
                    Edits to your links and theme will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {changelog.map((entry) => (
                    <div
                      key={entry._id}
                      className="rounded-[10px] border border-white/6 bg-[#15101E] p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#FAF7FF] truncate">
                          {entry.summary}
                        </span>
                        <span className="font-mono text-[9px] text-[#81778D] shrink-0">
                          {new Date(entry.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-[#B88CFF]">
                        {entry.action}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Embedded Public Profile Preview */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#FAF7FF]">
                Live Public Profile Preview
              </h3>
              <p className="text-xs text-[#9C92A8] mt-0.5">
                Real-time preview of how other developers and recruiters see
                your page
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/appearance">
                <Palette className="h-3.5 w-3.5" />
                Customize Theme
              </Link>
            </Button>
          </div>

          <ProfilePreview
            profile={profile}
            links={previewLinks}
            projects={previewProjects}
            appearance={appearance}
            variant="compact"
          />
        </section>
      </div>
    </AppShell>
  );
}
