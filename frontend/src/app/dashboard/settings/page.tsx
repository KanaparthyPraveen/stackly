"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/stackly/app-shell";
import { Button } from "@/components/stackly/button";
import { Input, Field } from "@/components/stackly/input";
import { PageHeader } from "@/components/stackly/page-header";
import { SettingsSection } from "@/components/stackly/settings-section";
import { Separator } from "@/components/stackly/separator";
import {
  SaveStatus,
  type SaveStatus as SaveStatusT,
} from "@/components/stackly/save-status";
import { useAuth } from "@/context/auth-context";
import { api, type ChangelogItem, type SessionInfo } from "@/lib/api";
import { useDashboardProfile } from "@/context/profile-context";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profile, setData: setSavedProfile } = useDashboardProfile();

  const email = user?.email ?? "";
  const [username, setUsername] = React.useState("");
  const [sessions, setSessions] = React.useState<SessionInfo[]>([]);
  const [visibility, setVisibility] = React.useState<"public" | "private">(
    "public",
  );
  const [ghostMode, setGhostMode] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatusT>("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [changelog, setChangelog] = React.useState<ChangelogItem[]>([]);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  // Security / Password state
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordStatus, setPasswordStatus] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [passwordMsg, setPasswordMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [prof, logs, sess] = await Promise.allSettled([
          api.getMyProfile(),
          api.getChangelog(25),
          api.getSessions(),
        ]);
        if (!mounted) return;
        if (sess.status === "fulfilled" && sess.value) {
          setSessions(sess.value);
        }
        if (prof.status === "fulfilled" && prof.value) {
          if (prof.value.username) {
            setUsername(prof.value.username);
          }
          if (prof.value.live !== undefined) {
            setVisibility(prof.value.live ? "public" : "private");
          }
          if (prof.value.ghostMode !== undefined) {
            setGhostMode(prof.value.ghostMode);
          }
        }
        if (logs.status === "fulfilled" && logs.value) {
          setChangelog(logs.value);
        }
      } catch (e) {
        console.warn("Could not load settings data:", e);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("saving");
    setErrorMsg(null);
    try {
      const live = visibility === "public";
      const updated = await api.updateProfile({ username, live, ghostMode });
      setSavedProfile(updated);
      setUsername(updated.username);
      setSaveStatus("saved");
      const updatedLogs = await api.getChangelog(25);
      setChangelog(updatedLogs);
    } catch (err) {
      setSaveStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Couldn't save your settings.",
      );
      return;
    }
    window.setTimeout(
      () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
      1800,
    );
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordStatus("error");
      setPasswordMsg("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus("error");
      setPasswordMsg("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus("error");
      setPasswordMsg("New passwords do not match.");
      return;
    }
    setPasswordStatus("saving");
    setPasswordMsg(null);
    try {
      await api.updatePassword({ currentPassword, newPassword });
      setPasswordStatus("saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("Password changed successfully.");
      window.setTimeout(() => setPasswordStatus("idle"), 3000);
    } catch (err) {
      setPasswordStatus("error");
      setPasswordMsg(
        err instanceof Error ? err.message : "Couldn't update password.",
      );
    }
  };

  const handleLogout = React.useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  const handleRevokeSession = async (id: string) => {
    try {
      await api.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Couldn't revoke that session.",
      );
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stackly-export-${username || "data"}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
      window.alert("Failed to export workspace data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete your account? All profiles, links, projects, and media will be erased. This cannot be undone.",
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      await api.deleteAccount();
      await logout();
      router.push("/login");
    } catch (e) {
      console.error("Failed to delete account:", e);
      window.alert("Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <AppShell
      title="Settings"
      subtitle="Account, profile URL, privacy, sessions, and the danger zone."
      profile={profile}
      headerAction={<SaveStatus status={saveStatus} />}
      onLogout={handleLogout}
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow="Settings"
          title="Workspace settings"
          description="A small set of knobs. Most things stay simple."
        />

        <form onSubmit={handleSave} className="space-y-5" noValidate>
          {errorMsg && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errorMsg}
            </div>
          )}

          <SettingsSection
            title="Account"
            description="The email and username tied to your Stackly workspace."
          >
            <Field label="Email" htmlFor="settings-email">
              <Input
                id="settings-email"
                type="email"
                value={email}
                disabled
                className="opacity-75 cursor-not-allowed"
              />
            </Field>
            <Field
              label="Username"
              htmlFor="settings-username"
              hint="stackly.app/username"
            >
              <Input
                id="settings-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
          </SettingsSection>

          <SettingsSection
            title="Public profile URL"
            description="Your profile is hosted at the address below. Changes propagate within a minute."
          >
            <Field label="Public URL">
              <div className="flex items-center rounded-md border border-input bg-card font-mono text-sm">
                <span className="px-3 text-muted-foreground">stackly.app/</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-9 w-full bg-transparent px-1 text-foreground focus-visible:outline-none"
                />
              </div>
            </Field>
          </SettingsSection>

          <SettingsSection
            title="Privacy"
            description="Control who can see your public profile."
          >
            <Field label="Visibility">
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as typeof visibility)
                }
                className="block h-9 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
              >
                <option value="public">Public — anyone can view</option>
                <option value="private">Private — hidden from public</option>
              </select>
            </Field>

            <div className="mt-4 rounded-md border border-border bg-card p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={ghostMode}
                  onChange={(e) => setGhostMode(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-[#B88CFF]"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    Ghost mode
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Your profile, links, projects and components become
                    invisible to visitors — they see the same page as a username
                    that does not exist. Nothing is deleted, and you keep full
                    access.
                  </span>
                </span>
              </label>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Sessions"
            description="Active sessions on this workspace."
          >
            <ul className="divide-y divide-border rounded-md border border-border">
              {sessions
                .map((session) => ({
                  id: session.id,
                  device: session.current ? "This browser" : session.browser,
                  os: `${session.os} · ${session.browser}`,
                  when: session.current
                    ? "Active now"
                    : session.createdAt
                      ? `Signed in ${new Date(session.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}`
                      : "Signed in",
                  current: session.current,
                }))
                .map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.when}
                    </span>
                    <span className="flex-1 truncate">{s.device}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.os}
                    </span>
                    {s.current ? (
                      <span className="rounded-full bg-signal/15 px-2 py-0.5 text-[11px] font-medium text-signal-foreground">
                        current
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Revoke ${s.device}`}
                        onClick={() => handleRevokeSession(s.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </SettingsSection>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.refresh()}
            >
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>

        <Separator />

        <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
          <SettingsSection
            title="Security & Password"
            description="Update the password used to sign in to your Stackly workspace."
          >
            {passwordMsg && (
              <div
                role="alert"
                className={`rounded-md border p-3 text-sm ${
                  passwordStatus === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-[#46D369]/30 bg-[#46D369]/10 text-[#46D369]"
                }`}
              >
                {passwordMsg}
              </div>
            )}
            <Field label="Current Password" htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="New Password"
                htmlFor="new-password"
                hint="At least 8 characters"
              >
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Field label="Confirm New Password" htmlFor="confirm-password">
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={passwordStatus === "saving"}>
                {passwordStatus === "saving" ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </SettingsSection>
        </form>

        <Separator />

        <SettingsSection
          title="Data Export"
          description="Download a machine-readable JSON archive of your entire workspace."
        >
          <div className="flex flex-col items-start justify-between gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-foreground">
                Export workspace archive
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Export your account, profile, links, projects, components,
                integrations, and activity changelog in JSON format.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export JSON"}
            </Button>
          </div>
        </SettingsSection>

        <Separator />

        <SettingsSection
          title="Activity & Change Log"
          description="A complete audit trail of modifications made to your link page, connected apps, profile, and theme."
        >
          {changelog.length === 0 ? (
            <div className="rounded-md border border-border bg-card p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No recent activity recorded.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every edit to your links, connected apps, and appearance will be
                logged here.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {changelog.map((entry) => (
                <div
                  key={entry._id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3.5 py-2.5 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">
                      {entry.summary}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {entry.action}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>

        <Separator />

        <SettingsSection
          title="Danger zone"
          description="Deleting your account removes all your data. This cannot be undone."
          destructive
        >
          <div className="flex flex-col items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/[0.06] p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-foreground">
                Delete account
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Permanently remove your Stackly workspace, public profile, and
                all associated links and projects.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete account"}
            </Button>
          </div>
        </SettingsSection>
      </div>
    </AppShell>
  );
}
