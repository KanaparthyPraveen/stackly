"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, Star, GitFork, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/stackly/app-shell";
import { Button } from "@/components/stackly/button";
import { Dialog } from "@/components/stackly/dialog";
import { Input, Field } from "@/components/stackly/input";
import { PageHeader } from "@/components/stackly/page-header";
import {
  IntegrationCard,
  type Integration,
} from "@/components/stackly/integration-card";
import { GithubIcon } from "@/components/stackly/icons";
import { useAuth } from "@/context/auth-context";
import { useDashboardProfile } from "@/context/profile-context";
import {
  api,
  type IntegrationItem,
  type IntegrationProviderInfo,
} from "@/lib/api";
import { INTEGRATION_CATALOG } from "@/lib/integrations-catalog";
import {
  SaveStatus,
  type SaveStatus as SaveStatusT,
} from "@/components/stackly/save-status";
import { cn } from "@/lib/utils";

const RETURN_ERRORS: Record<string, string> = {
  login_required: "Sign in again to connect an account.",
  integration_denied: "The connection was cancelled.",
  integration_state_invalid:
    "The connection request expired or could not be verified. Please try again.",
  integration_connect_failed:
    "The provider did not complete the connection. Please try again.",
  integration_not_available:
    "That integration is not configured on this server yet.",
  oauth_state_invalid:
    "The connection request expired or could not be verified. Please try again.",
  oauth_denied: "The connection was cancelled.",
  oauth_missing_code: "The provider did not complete the connection.",
};

const errorText = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

/** The provider whose username or API key is being entered. */
type Prompt = { provider: IntegrationProviderInfo; name: string } | null;

export default function IntegrationsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profile } = useDashboardProfile();

  const [providers, setProviders] = React.useState<IntegrationProviderInfo[]>(
    [],
  );
  const [connected, setConnected] = React.useState<IntegrationItem[]>([]);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatusT>("idle");
  const [message, setMessage] = React.useState<{
    kind: "error" | "info";
    text: string;
  } | null>(null);
  const [prompt, setPrompt] = React.useState<Prompt>(null);
  const [promptValue, setPromptValue] = React.useState("");
  const [promptError, setPromptError] = React.useState<string | null>(null);

  const markSaved = React.useCallback(() => {
    setSaveStatus("saved");
    window.setTimeout(
      () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
      1800,
    );
  }, []);

  // Providers and connection state both come from the backend.
  React.useEffect(() => {
    let mounted = true;
    Promise.all([api.getIntegrationProviders(), api.getIntegrations()])
      .then(([catalog, mine]) => {
        if (!mounted) return;
        setProviders(catalog);
        setConnected(mine);
      })
      .catch((err) => {
        if (mounted) {
          setMessage({
            kind: "error",
            text: errorText(err, "Couldn't load your integrations."),
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  // Result of an OAuth round-trip, reported by the backend in the URL.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const done = params.get("connected");
    const error = params.get("error");
    if (!done && !error) return;

    window.history.replaceState(null, "", window.location.pathname);

    const timer = window.setTimeout(() => {
      if (done) {
        const name =
          INTEGRATION_CATALOG.find((c) => c.id === done)?.name ?? done;
        setMessage({ kind: "info", text: `${name} connected.` });
      } else if (error) {
        setMessage({
          kind: "error",
          text:
            RETURN_ERRORS[error] ?? "The connection could not be completed.",
        });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const replaceItem = (item: IntegrationItem) =>
    setConnected((prev) => [
      ...prev.filter((i) => i.integrationId !== item.integrationId),
      item,
    ]);

  const items: Integration[] = INTEGRATION_CATALOG.map((entry) => {
    const provider = providers.find((p) => p.id === entry.id);
    const mine = connected.find((i) => i.integrationId === entry.id);
    const isConnected = mine?.status === "connected";

    return {
      id: entry.id,
      name: entry.name,
      description:
        mine?.status === "reauth_required"
          ? `${entry.name} access was revoked or expired. Connect again to resume.`
          : entry.description,
      icon: entry.icon,
      status: isConnected
        ? "connected"
        : provider?.configured
          ? "available"
          : "coming-soon",
      handle: isConnected ? mine?.handle : undefined,
    };
  });

  const handleConnect = (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;
    setMessage(null);

    if (provider.kind === "oauth") {
      // The backend runs the whole authorization flow and redirects back.
      window.location.assign(api.integrationOAuthUrl(id));
      return;
    }

    setPromptValue("");
    setPromptError(null);
    setPrompt({
      provider,
      name: INTEGRATION_CATALOG.find((c) => c.id === id)?.name ?? provider.name,
    });
  };

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    const value = promptValue.trim();
    if (!value) {
      setPromptError(
        prompt.provider.kind === "api_key"
          ? "Enter your API key."
          : "Enter your username.",
      );
      return;
    }

    setSaveStatus("saving");
    try {
      const saved = await api.connectIntegration(
        prompt.provider.kind === "api_key"
          ? { integrationId: prompt.provider.id, apiKey: value }
          : { integrationId: prompt.provider.id, handle: value },
      );
      replaceItem(saved);
      setPrompt(null);
      setPromptValue("");
      markSaved();
    } catch (err) {
      setSaveStatus("error");
      setPromptError(errorText(err, "Couldn't connect this account."));
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!window.confirm("Disconnect this integration?")) return;
    setSaveStatus("saving");
    setMessage(null);
    try {
      replaceItem(await api.disconnectIntegration(id));
      markSaved();
    } catch (err) {
      setSaveStatus("error");
      setMessage({
        kind: "error",
        text: errorText(err, "Couldn't disconnect this integration."),
      });
    }
  };

  /** Refreshes the provider data now, or re-opens the form for manual links. */
  const handleConfigure = async (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;

    if (provider.kind !== "oauth") {
      handleConnect(id);
      return;
    }

    setSaveStatus("saving");
    setMessage(null);
    try {
      const synced = await api.syncIntegration(id);
      replaceItem(synced);
      markSaved();
      setMessage({
        kind: "info",
        text: synced.lastSyncedAt
          ? `${provider.name} synced ${new Date(synced.lastSyncedAt).toLocaleString()}.`
          : `${provider.name} is up to date.`,
      });
    } catch (err) {
      setSaveStatus("error");
      setMessage({
        kind: "error",
        text: errorText(err, "Couldn't sync this integration."),
      });
    }
  };

  const handleLogout = React.useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  const isApiKey = prompt?.provider.kind === "api_key";

  const githubIntegration = connected.find(
    (i) => i.integrationId === "github" && i.status === "connected",
  );
  const githubDataObj = githubIntegration?.data as
    Record<string, unknown> | undefined;
  const githubRepos = (githubDataObj?.repos ?? []) as Array<{
    name: string;
    url: string;
    description?: string;
    stars: number;
    forks: number;
    language?: string;
    pushedAt?: string;
  }>;

  return (
    <AppShell
      title="Integrations"
      subtitle="Connect accounts to surface verified handles and live activity."
      profile={profile}
      headerAction={<SaveStatus status={saveStatus} />}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow="Integrations"
          title="Linked accounts"
          description="Connected accounts sync in the background. Access tokens are encrypted and never leave the server."
        />

        {message && (
          <div
            role={message.kind === "error" ? "alert" : "status"}
            className={
              message.kind === "error"
                ? "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                : "rounded-md border border-white/8 bg-[#15101E] p-3 text-sm text-[#D8D1E0]"
            }
          >
            {message.text}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <IntegrationCard
              key={i.id}
              integration={i}
              onConnect={() => handleConnect(i.id)}
              onDisconnect={() => handleDisconnect(i.id)}
              onConfigure={() => handleConfigure(i.id)}
            />
          ))}
        </div>

        {githubIntegration && (
          <section className="rounded-[16px] border border-white/8 bg-[#191321] p-5 sm:p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/6 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/8 bg-[#15101E] text-[#FAF7FF]">
                  <GithubIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-[#FAF7FF] flex items-center gap-2">
                    GitHub Content & Repositories
                    <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 font-mono text-[10px] text-green-400">
                      Synced
                    </span>
                  </h3>
                  <p className="text-xs text-[#9C92A8]">
                    {githubIntegration.handle
                      ? `Active account: ${githubIntegration.handle}`
                      : "Connected to GitHub"}
                    {githubIntegration.lastSyncedAt &&
                      ` · Synced ${new Date(githubIntegration.lastSyncedAt).toLocaleTimeString()}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleConfigure("github")}
                  disabled={saveStatus === "saving"}
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5 mr-1.5",
                      saveStatus === "saving" && "animate-spin",
                    )}
                  />
                  Sync now
                </Button>
              </div>
            </div>

            {githubDataObj && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3 text-center">
                  <span className="text-[11px] font-mono uppercase text-[#9C92A8]">
                    Public Repos
                  </span>
                  <div className="mt-1 font-display text-lg font-bold text-[#FAF7FF]">
                    {Number(githubDataObj.publicRepos ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3 text-center">
                  <span className="text-[11px] font-mono uppercase text-[#9C92A8]">
                    Total Stars
                  </span>
                  <div className="mt-1 font-display text-lg font-bold text-[#FAF7FF] flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 text-amber-400" />
                    {Number(githubDataObj.totalStars ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3 text-center">
                  <span className="text-[11px] font-mono uppercase text-[#9C92A8]">
                    Followers
                  </span>
                  <div className="mt-1 font-display text-lg font-bold text-[#FAF7FF]">
                    {Number(githubDataObj.followers ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3 text-center">
                  <span className="text-[11px] font-mono uppercase text-[#9C92A8]">
                    Following
                  </span>
                  <div className="mt-1 font-display text-lg font-bold text-[#FAF7FF]">
                    {Number(githubDataObj.following ?? 0)}
                  </div>
                </div>
              </div>
            )}

            {githubRepos.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-mono text-[#9C92A8]">
                  <span>Recently Pushed Repositories</span>
                  <Link
                    href="/dashboard/projects"
                    className="text-[#B88CFF] hover:underline"
                  >
                    Import to Projects →
                  </Link>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {githubRepos.map((repo) => (
                    <a
                      key={repo.url}
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="group flex flex-col justify-between rounded-xl border border-white/6 bg-white/[0.02] p-3.5 transition-all hover:border-white/15 hover:bg-white/[0.04]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-[#FAF7FF] group-hover:text-[#B88CFF] transition-colors truncate">
                            {repo.name}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-[#9C92A8] shrink-0" />
                        </div>
                        {repo.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-[#9C92A8]">
                            {repo.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-[#9C92A8]">
                        {repo.language && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[#B8AFC4]">
                            {repo.language}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-400" />
                          {repo.stars}
                        </span>
                        {repo.forks > 0 && (
                          <span className="flex items-center gap-1">
                            <GitFork className="h-3 w-3" />
                            {repo.forks}
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <Dialog
        open={prompt !== null}
        onClose={() => setPrompt(null)}
        title={prompt ? `Connect ${prompt.name}` : "Connect"}
        description={
          isApiKey
            ? "Your key is checked with the provider, then stored encrypted. It is never shown again."
            : "Your public profile is linked as self-declared. No data is fetched from it."
        }
      >
        <form onSubmit={handlePromptSubmit} className="space-y-4" noValidate>
          {promptError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {promptError}
            </div>
          )}
          <Field
            label={isApiKey ? "API key" : "Username"}
            htmlFor="integration-value"
          >
            <Input
              id="integration-value"
              type={isApiKey ? "password" : "text"}
              autoComplete="off"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={isApiKey ? "waka_…" : "your-username"}
              required
            />
          </Field>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPrompt(null)}
            >
              Cancel
            </Button>
            <Button type="submit">Connect</Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
