"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  ExternalLink,
  ShieldCheck,
  Key,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Code2,
  RefreshCw,
  Eye,
  Layers,
  FileJson,
  AlertTriangle,
} from "lucide-react";
import { api, type GitHubTestProfileData } from "@/lib/api";
import { ProfilePreview } from "@/components/stackly/profile-preview";
import { ProjectCard } from "@/components/stackly/project-card";
import { Badge } from "@/components/stackly/badge";
import { StatCard } from "@/components/stackly/stat-card";
import { GithubIcon } from "@/components/stackly/icons";
import { Button } from "@/components/stackly/button";

const PRESET_USERS = ["octocat", "torvalds", "leerob", "shadcn", "gaearon"];

interface ClientFallbackRepo {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  html_url: string;
  homepage: string | null;
  archived: boolean;
  stargazers_count?: number;
  forks_count?: number;
  fork?: boolean;
}

export default function TestGitHubPage() {
  const [usernameInput, setUsernameInput] = React.useState("octocat");
  const [activeTab, setActiveTab] = React.useState<
    "preview" | "breakdown" | "projects" | "raw"
  >("preview");
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<GitHubTestProfileData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dataSource, setDataSource] = React.useState<
    "backend" | "client-fallback" | null
  >(null);

  const fetchProfile = React.useCallback(async (targetUsername: string) => {
    const user = targetUsername.trim();
    if (!user) return;

    setLoading(true);
    setError(null);

    // Try through Stackly backend API first
    try {
      const result = await api.getGitHubTestProfile(user);
      setData(result);
      setDataSource("backend");
      setLoading(false);
      return;
    } catch (backendErr) {
      console.warn(
        "Backend API request failed, attempting direct public GitHub fetch fallback:",
        backendErr,
      );

      // Fallback: direct public GitHub API fetch for instant client testing if backend dev server is offline
      try {
        const ghRes = await fetch(
          `https://api.github.com/users/${encodeURIComponent(user)}`,
          {
            headers: {
              Accept: "application/vnd.github+json",
            },
          },
        );

        if (ghRes.status === 404) {
          throw new Error(`GitHub user "${user}" was not found.`);
        }
        if (ghRes.status === 403) {
          throw new Error(
            "GitHub rate limit reached (60 requests/hr for unauthenticated queries). Please wait or use a token.",
          );
        }
        if (!ghRes.ok) {
          throw new Error(
            `GitHub API error (${ghRes.status}): ${ghRes.statusText}`,
          );
        }

        const ghUser = (await ghRes.json()) as Record<string, unknown>;

        // Fetch repos
        let ghRepos: ClientFallbackRepo[] = [];
        try {
          const reposRes = await fetch(
            `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=pushed&per_page=6`,
            {
              headers: { Accept: "application/vnd.github+json" },
            },
          );
          if (reposRes.ok) {
            ghRepos = (await reposRes.json()) as ClientFallbackRepo[];
          }
        } catch {
          // Repos fetch optional
        }

        const blogStr = typeof ghUser.blog === "string" ? ghUser.blog : "";
        const formattedWebsite = blogStr
          ? blogStr.startsWith("http")
            ? blogStr
            : `https://${blogStr}`
          : undefined;

        const fallbackData: GitHubTestProfileData = {
          success: true,
          username: String(ghUser.login || user),
          meta: {
            authenticated: false,
            rateLimitLimit: ghRes.headers.get("x-ratelimit-limit"),
            rateLimitRemaining: ghRes.headers.get("x-ratelimit-remaining"),
            rateLimitReset: ghRes.headers.get("x-ratelimit-reset"),
            fetchedAt: new Date().toISOString(),
          },
          profile: {
            username: String(ghUser.login || user),
            displayName: String(ghUser.name || ghUser.login || user),
            bio: typeof ghUser.bio === "string" ? ghUser.bio : undefined,
            avatarUrl:
              typeof ghUser.avatar_url === "string"
                ? ghUser.avatar_url
                : undefined,
            location:
              typeof ghUser.location === "string" ? ghUser.location : undefined,
            website: formattedWebsite,
            social: {
              github:
                typeof ghUser.html_url === "string"
                  ? ghUser.html_url
                  : `https://github.com/${user}`,
              x:
                typeof ghUser.twitter_username === "string"
                  ? `https://x.com/${ghUser.twitter_username}`
                  : undefined,
              website: formattedWebsite,
            },
            live: true,
          },
          projects: ghRepos.map((repo) => ({
            id: String(repo.id),
            name: repo.name,
            description: repo.description || "Public repository on GitHub",
            tech: [repo.language, ...(repo.topics || [])].filter(
              (t): t is string => Boolean(t),
            ),
            repoUrl: repo.html_url,
            liveUrl: repo.homepage || undefined,
            status: repo.archived ? ("archived" as const) : ("live" as const),
            featured: (repo.stargazers_count || 0) >= 5,
            stars: repo.stargazers_count || 0,
            forks: repo.forks_count || 0,
            isFork: Boolean(repo.fork),
          })),
          stats: {
            publicRepos:
              typeof ghUser.public_repos === "number" ? ghUser.public_repos : 0,
            publicGists:
              typeof ghUser.public_gists === "number" ? ghUser.public_gists : 0,
            followers:
              typeof ghUser.followers === "number" ? ghUser.followers : 0,
            following:
              typeof ghUser.following === "number" ? ghUser.following : 0,
            company: typeof ghUser.company === "string" ? ghUser.company : null,
            location:
              typeof ghUser.location === "string" ? ghUser.location : null,
            hasPublicEmail: Boolean(ghUser.email),
            publicEmail: typeof ghUser.email === "string" ? ghUser.email : null,
            accountAgeYears: Math.max(
              0,
              Math.floor(
                (Date.now() -
                  new Date(String(ghUser.created_at || "")).getTime()) /
                  (1000 * 60 * 60 * 24 * 365.25),
              ),
            ),
          },
          raw: {
            user: ghUser,
            repos: ghRepos as unknown as Array<Record<string, unknown>>,
          },
        };

        setData(fallbackData);
        setDataSource("client-fallback");
      } catch (clientErr: unknown) {
        const message =
          clientErr instanceof Error
            ? clientErr.message
            : "Failed to fetch GitHub profile from backend and direct fallback.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      if (!ignore) {
        void fetchProfile("octocat");
      }
    }
    void loadInitial();
    return () => {
      ignore = true;
    };
  }, [fetchProfile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProfile(usernameInput);
  };

  return (
    <div className="relative min-h-screen text-foreground pb-24">
      {/* Top Banner indicating temporary test status */}
      <div className="border-b border-signal/20 bg-signal/10 px-4 py-2.5 text-center text-xs font-mono text-signal-foreground">
        <span className="inline-flex items-center gap-2">
          <Badge
            variant="signal"
            className="uppercase tracking-widest text-[10px] font-semibold"
          >
            Test Mode
          </Badge>
          <span>
            Temporary Testing View — Testing GitHub Public Profile Component
            Visibility
          </span>
          <span className="text-border">·</span>
          <Link
            href="/ada"
            className="underline underline-offset-2 hover:text-foreground"
          >
            View Public Profile (/ada)
          </Link>
          <span className="text-border">·</span>
          <Link
            href="/dashboard"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Back to Dashboard
          </Link>
        </span>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <GithubIcon className="h-6 w-6 text-foreground" />
                <h1 className="font-display text-3xl tracking-tight sm:text-4xl text-foreground">
                  GitHub Profile Component Inspector
                </h1>
              </div>
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                Verify what GitHub actually makes publicly visible on user
                profiles, how it maps into Stackly&apos;s profile and project
                components, and learn how GitHub token authentication works.
              </p>
            </div>

            {data && (
              <div className="flex items-center gap-2 font-mono text-xs">
                <Badge
                  variant={dataSource === "backend" ? "signal" : "outline"}
                  className="gap-1.5"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${dataSource === "backend" ? "bg-signal" : "bg-amber-400"}`}
                  />
                  Source:{" "}
                  {dataSource === "backend"
                    ? "Stackly Backend API"
                    : "Direct Client Fallback"}
                </Badge>
                {data.meta.rateLimitRemaining && (
                  <Badge variant="outline">
                    Rate Limit: {data.meta.rateLimitRemaining} left
                  </Badge>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Search & Presets Bar */}
        <div className="mb-8 rounded-xl border border-border bg-card/60 p-4 sm:p-5 backdrop-blur-sm shadow-sm">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="github-username-input"
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter any GitHub username (e.g. torvalds, octocat, your-handle)"
                className="w-full rounded-md border border-input bg-background/80 pl-9 pr-4 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="gap-2 sm:w-auto w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Fetching...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Inspect Profile</span>
                </>
              )}
            </Button>
          </form>

          {/* Quick Preset Buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>Quick test presets:</span>
            {PRESET_USERS.map((user) => (
              <button
                key={user}
                type="button"
                onClick={() => {
                  setUsernameInput(user);
                  fetchProfile(user);
                }}
                className={`rounded border px-2 py-0.5 transition-colors hover:border-signal hover:text-foreground ${
                  usernameInput.toLowerCase() === user
                    ? "border-signal bg-signal/15 text-signal-foreground"
                    : "border-border bg-card"
                }`}
              >
                @{user}
              </button>
            ))}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Failed to retrieve GitHub profile</p>
              <p className="mt-1 text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Main Grid: Data Content & Token Education */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Profile Inspection View (7 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1 border-b border-border pb-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                  activeTab === "preview"
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Live Stackly Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("breakdown")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                  activeTab === "breakdown"
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Public Component Matrix
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("projects")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                  activeTab === "projects"
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                Repositories ({data?.projects.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raw")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                  activeTab === "raw"
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileJson className="h-3.5 w-3.5" />
                Raw GitHub JSON
              </button>
            </div>

            {loading && !data ? (
              <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-signal mb-3" />
                <p className="font-mono text-sm text-muted-foreground">
                  Querying GitHub Public API...
                </p>
              </div>
            ) : data ? (
              <>
                {/* TAB 1: Live Stackly Component Preview */}
                {activeTab === "preview" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Testing Stackly&apos;s ProfilePreview component with
                        live GitHub data:
                      </span>
                      <a
                        href={data.profile.social?.github}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-signal hover:underline"
                      >
                        GitHub profile <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <ProfilePreview
                      profile={data.profile}
                      projects={data.projects}
                      appearance={{
                        background: "aurora",
                        accent: "signal",
                        typography: "default",
                        buttonStyle: "rounded",
                        layout: "centered",
                        colors: {},
                        surface: {
                          style: "glass",
                          borderWidth: 1,
                          opacity: 5,
                          radius: 22,
                        },
                        typographyScale: {
                          heading: 30,
                          subheading: 18,
                          body: 14,
                          small: 11,
                        },
                        button: { style: "rounded", radius: 14, height: "md" },
                        canvas: {
                          width: "standard",
                          padding: 24,
                          spacing: 40,
                          contentWidth: 680,
                          align: "center",
                        },
                        layoutOrder: [],
                      }}
                    />
                  </div>
                )}

                {/* TAB 2: Component Breakdown Matrix */}
                {activeTab === "breakdown" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h3 className="font-display text-lg text-foreground mb-1">
                        GitHub Profile Public Visibility Matrix
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Analysis of which components GitHub exposes publicly
                        without requiring an access token:
                      </p>

                      <div className="divide-y divide-border/60">
                        <MatrixRow
                          name="Avatar Image"
                          keyName="avatar_url"
                          isPublic={Boolean(data.raw.user.avatar_url)}
                          value={data.profile.avatarUrl}
                          notes="Publicly accessible image URL hosted on avatars.githubusercontent.com"
                        />
                        <MatrixRow
                          name="Display Name"
                          keyName="name"
                          isPublic={Boolean(data.raw.user.name)}
                          value={data.profile.displayName}
                          notes={
                            data.raw.user.name
                              ? "User-configured display name"
                              : "Not set by user; falls back to username"
                          }
                        />
                        <MatrixRow
                          name="Bio / Description"
                          keyName="bio"
                          isPublic={Boolean(data.raw.user.bio)}
                          value={data.profile.bio || "(None provided)"}
                          notes="Short biographical description written on GitHub"
                        />
                        <MatrixRow
                          name="Location"
                          keyName="location"
                          isPublic={Boolean(data.raw.user.location)}
                          value={data.profile.location || "(Not set)"}
                          notes="Public geographic location if configured in user profile"
                        />
                        <MatrixRow
                          name="Website / Blog"
                          keyName="blog"
                          isPublic={Boolean(data.raw.user.blog)}
                          value={data.profile.website || "(Not set)"}
                          notes="Personal portfolio, blog, or company URL"
                        />
                        <MatrixRow
                          name="Twitter / X Handle"
                          keyName="twitter_username"
                          isPublic={Boolean(data.raw.user.twitter_username)}
                          value={
                            data.raw.user.twitter_username
                              ? `@${data.raw.user.twitter_username}`
                              : "(Not linked)"
                          }
                          notes="Direct social connection exported by GitHub"
                        />
                        <MatrixRow
                          name="Public Repositories"
                          keyName="public_repos"
                          isPublic={true}
                          value={`${data.stats.publicRepos} public repositories`}
                          notes="Only public repositories are exposed; private repos require OAuth/Token"
                        />
                        <MatrixRow
                          name="Followers / Following"
                          keyName="followers / following"
                          isPublic={true}
                          value={`${data.stats.followers.toLocaleString()} followers · ${data.stats.following} following`}
                          notes="Public social graph counts on GitHub"
                        />
                        <MatrixRow
                          name="Email Address"
                          keyName="email"
                          isPublic={Boolean(data.stats.hasPublicEmail)}
                          value={data.stats.publicEmail || "Hidden / Private"}
                          notes={
                            data.stats.hasPublicEmail
                              ? "User opted to make their email address publicly visible"
                              : "Protected: GitHub hides emails by default unless user unchecks 'Keep email private' or uses OAuth"
                          }
                          statusVariant={
                            data.stats.hasPublicEmail ? "success" : "neutral"
                          }
                        />
                      </div>
                    </div>

                    {/* Quick Metric Tiles */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard
                        label="Public Repos"
                        value={data.stats.publicRepos}
                        hint="Visible to all"
                      />
                      <StatCard
                        label="Followers"
                        value={data.stats.followers.toLocaleString()}
                        hint="Public network"
                      />
                      <StatCard
                        label="Following"
                        value={data.stats.following}
                        hint="Subscriptions"
                      />
                      <StatCard
                        label="Account Age"
                        value={`${data.stats.accountAgeYears}y`}
                        hint="Since signup"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 3: Projects / Repositories */}
                {activeTab === "projects" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Public repositories mapped to Stackly ProjectCards:
                      </span>
                      <span>
                        Showing {data.projects.length} recent repositories
                      </span>
                    </div>

                    {data.projects.length === 0 ? (
                      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                        No public repositories found for @{data.username}.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.projects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            mode="preview"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: Raw JSON Inspector */}
                {activeTab === "raw" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                        <span className="font-mono text-xs text-muted-foreground">
                          GET https://api.github.com/users/{data.username}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          JSON Response
                        </Badge>
                      </div>
                      <pre className="max-h-[500px] overflow-auto p-4 font-mono text-xs text-foreground/90 bg-black/40">
                        {JSON.stringify(data.raw.user, null, 2)}
                      </pre>
                    </div>

                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                        <span className="font-mono text-xs text-muted-foreground">
                          GET https://api.github.com/users/{data.username}/repos
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {data.raw.repos.length} Repositories
                        </Badge>
                      </div>
                      <pre className="max-h-[400px] overflow-auto p-4 font-mono text-xs text-foreground/90 bg-black/40">
                        {JSON.stringify(data.raw.repos, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Right Column: Educational Guide & Process Explanation (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Guide Card: How GitHub Profile API Works */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 font-display text-base text-foreground mb-3">
                <Info className="h-4 w-4 text-signal" />
                <span>How GitHub Profile API Works</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                GitHub provides a REST API at:
              </p>
              <code className="mt-2 block rounded bg-black/40 p-2 font-mono text-[11px] text-signal">
                GET https://api.github.com/users/:username
              </code>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-signal font-bold">•</span>
                  <span>
                    <strong>No Token Required</strong> for public profile data
                    (avatar, bio, name, public repos, followers).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-signal font-bold">•</span>
                  <span>
                    <strong>Rate Limit:</strong> 60 requests/hr per IP
                    unauthenticated; increases to 5,000 requests/hr with a
                    token.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-signal font-bold">•</span>
                  <span>
                    <strong>User-Agent Header:</strong> GitHub API{" "}
                    <em>mandates</em> a{" "}
                    <code className="text-foreground">User-Agent</code> header
                    on all requests, or it returns 403 Forbidden.
                  </span>
                </li>
              </ul>
            </div>

            {/* Token Guide Card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 font-display text-base text-foreground mb-3">
                <Key className="h-4 w-4 text-signal" />
                <span>Do I Need a Token?</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Depends on your use case in Stackly:
              </p>

              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-border/80 bg-background/50 p-3">
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>1. Just Testing Public View</span>
                    <Badge variant="signal">No token</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Public endpoints work out of the box. 60 requests/hour
                    limit.
                  </p>
                </div>

                <div className="rounded-lg border border-border/80 bg-background/50 p-3">
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>2. Server / High Traffic</span>
                    <Badge variant="outline">Personal Access Token</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Boosts backend rate limit to 5,000 req/hr. Safe to keep in{" "}
                    <code className="text-foreground">.env</code>.
                  </p>
                </div>

                <div className="rounded-lg border border-border/80 bg-background/50 p-3">
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>3. User Connects GitHub</span>
                    <Badge variant="outline">GitHub OAuth App</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Used on the Stackly Integrations page so users authenticate
                    and verify ownership of their handle.
                  </p>
                </div>
              </div>
            </div>

            {/* How to Get a Token (Step-by-Step) */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 font-display text-base text-foreground mb-3">
                <ShieldCheck className="h-4 w-4 text-signal" />
                <span>How to Get a Token (Steps)</span>
              </div>
              <ol className="space-y-2.5 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
                <li>
                  Log in to GitHub and open <strong>Settings</strong>.
                </li>
                <li>
                  Scroll down the left sidebar to{" "}
                  <strong>Developer settings</strong>.
                </li>
                <li>
                  Click <strong>Personal access tokens</strong> &rarr;{" "}
                  <strong>Tokens (classic)</strong> (or Fine-grained).
                </li>
                <li>
                  Click <strong>Generate new token</strong>.
                </li>
                <li>
                  For public read-only profile access,{" "}
                  <strong>no extra permissions are needed</strong> (or check{" "}
                  <code className="text-foreground">read:user</code>).
                </li>
                <li>
                  Copy the generated token (starts with{" "}
                  <code className="text-foreground">ghp_...</code>).
                </li>
                <li>
                  In{" "}
                  <code className="text-foreground">stackly-backend/.env</code>,
                  add:
                  <pre className="mt-1 rounded bg-black/40 p-2 font-mono text-[11px] text-signal overflow-x-auto">
                    GITHUB_TOKEN=ghp_your_token_here
                  </pre>
                </li>
              </ol>
            </div>

            {/* Backend API reference */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 font-display text-base text-foreground mb-2">
                <Code2 className="h-4 w-4 text-signal" />
                <span>Stackly Test API Endpoint</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Your new backend API is active at:
              </p>
              <div className="rounded bg-black/40 p-2.5 font-mono text-xs text-foreground space-y-1">
                <div className="text-signal">
                  GET /api/v1/github-test/profile/:username
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Returns mapped profile + projects + raw JSON
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatrixRow({
  name,
  keyName,
  isPublic,
  value,
  notes,
  statusVariant,
}: {
  name: string;
  keyName: string;
  isPublic: boolean;
  value?: string;
  notes: string;
  statusVariant?: "success" | "neutral";
}) {
  return (
    <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
      <div className="sm:w-1/3">
        <div className="font-medium text-foreground flex items-center gap-2">
          {name}
          <span className="font-mono text-[11px] text-muted-foreground">
            ({keyName})
          </span>
        </div>
        <p className="text-muted-foreground text-[11px] mt-0.5">{notes}</p>
      </div>

      <div className="sm:w-1/2 font-mono text-foreground truncate">
        {value || <span className="text-muted-foreground italic">None</span>}
      </div>

      <div className="sm:w-1/6 flex justify-start sm:justify-end">
        {statusVariant === "neutral" ? (
          <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            <HelpCircle className="h-3 w-3" /> Private by default
          </span>
        ) : isPublic ? (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Public
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400">
            <XCircle className="h-3 w-3" /> Hidden / Empty
          </span>
        )}
      </div>
    </div>
  );
}
