"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FolderGit2,
  Star,
  ExternalLink,
  Loader2,
  Check,
} from "lucide-react";
import { AppShell } from "@/components/stackly/app-shell";
import { Button } from "@/components/stackly/button";
import { Input, Textarea, Field } from "@/components/stackly/input";
import { PageHeader } from "@/components/stackly/page-header";
import {
  ProjectCard,
  type Project,
  type ProjectStatus,
} from "@/components/stackly/project-card";
import { EmptyState } from "@/components/stackly/empty-state";
import { Dialog } from "@/components/stackly/dialog";
import { GithubIcon } from "@/components/stackly/icons";
import {
  SaveStatus,
  type SaveStatus as SaveStatusT,
} from "@/components/stackly/save-status";
import { useAuth } from "@/context/auth-context";
import { useDashboardProfile } from "@/context/profile-context";
import {
  api,
  type ProjectItem,
  type GitHubContentResponse,
  type GitHubRepoItem,
} from "@/lib/api";

type EditState =
  { mode: "closed" } | { mode: "add" } | { mode: "edit"; id: string };

type ProjectFormState = {
  name: string;
  description: string;
  tech: string;
  repoUrl: string;
  liveUrl: string;
  status: ProjectStatus;
};

const emptyForm = (): ProjectFormState => ({
  name: "",
  description: "",
  tech: "",
  repoUrl: "",
  liveUrl: "",
  status: "live",
});

const toProject = (p: ProjectItem): Project => ({
  id: p.id || p._id || "",
  name: p.name,
  description: p.description || "",
  tech: p.tech || [],
  repoUrl: p.repoUrl,
  liveUrl: p.liveUrl,
  status: (p.status as ProjectStatus) || "wip",
  featured: p.featured || false,
});

const errorText = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

export default function ProjectsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profile } = useDashboardProfile();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [edit, setEdit] = React.useState<EditState>({ mode: "closed" });
  const [form, setForm] = React.useState<ProjectFormState>(emptyForm);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatusT>("idle");
  const [githubOpen, setGithubOpen] = React.useState(false);
  const [githubData, setGithubData] =
    React.useState<GitHubContentResponse | null>(null);
  const [githubLoading, setGithubLoading] = React.useState(false);
  const [githubUsernameInput, setGithubUsernameInput] = React.useState("");
  const [githubImporting, setGithubImporting] = React.useState<string | null>(
    null,
  );
  const [githubError, setGithubError] = React.useState<string | null>(null);

  const markSaved = React.useCallback(() => {
    setSaveStatus("saved");
    window.setTimeout(
      () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
      2000,
    );
  }, []);

  const reload = React.useCallback(async () => {
    const items = await api.getProjects();
    setProjects(items.map(toProject));
  }, []);

  React.useEffect(() => {
    let mounted = true;
    api
      .getProjects()
      .then((items) => {
        if (mounted) setProjects(items.map(toProject));
      })
      .catch((err) => {
        if (mounted) {
          setPageError(errorText(err, "Couldn't load your projects."));
        }
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  const loadGithub = React.useCallback(
    async (userCandidate?: string) => {
      setGithubLoading(true);
      setGithubError(null);
      try {
        const data = await api.getGitHubContent(userCandidate);
        setGithubData(data);
        if (data.handle && !githubUsernameInput) {
          setGithubUsernameInput(data.handle.replace(/^@/, ""));
        }
      } catch (err) {
        setGithubError(errorText(err, "Couldn't load GitHub repositories."));
      } finally {
        setGithubLoading(false);
      }
    },
    [githubUsernameInput],
  );

  const openGithubImport = () => {
    setGithubOpen(true);
    setGithubError(null);
    if (!githubData) {
      loadGithub();
    }
  };

  const handleImportRepo = async (repo: GitHubRepoItem) => {
    setGithubImporting(repo.name);
    setGithubError(null);
    try {
      const created = await api.createProject({
        name: repo.name,
        description: repo.description ?? "",
        repoUrl: repo.url,
        tech: repo.language ? [repo.language] : [],
        status: "live",
      });
      setProjects((prev) => [...prev, toProject(created)]);
      markSaved();
    } catch (err) {
      setGithubError(errorText(err, `Failed to import ${repo.name}.`));
    } finally {
      setGithubImporting(null);
    }
  };

  const isRepoImported = (repo: GitHubRepoItem) =>
    projects.some(
      (p) =>
        (p.repoUrl && p.repoUrl.toLowerCase() === repo.url.toLowerCase()) ||
        p.name.toLowerCase() === repo.name.toLowerCase(),
    );

  const openAdd = () => {
    setForm(emptyForm());
    setFormError(null);
    setEdit({ mode: "add" });
  };
  const openEdit = (p: Project) => {
    setForm({
      name: p.name,
      description: p.description,
      tech: p.tech.join(", "),
      repoUrl: p.repoUrl ?? "",
      liveUrl: p.liveUrl ?? "",
      status: p.status,
    });
    setFormError(null);
    setEdit({ mode: "edit", id: p.id });
  };
  const closeDialog = () => {
    setEdit({ mode: "closed" });
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    const tech = form.tech
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Empty strings clear an optional field on the server.
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      tech,
      repoUrl: form.repoUrl.trim(),
      liveUrl: form.liveUrl.trim(),
      status: form.status,
    };

    setSaveStatus("saving");
    setPageError(null);
    try {
      if (edit.mode === "add") {
        // The first project is featured automatically by the backend.
        const created = await api.createProject(payload);
        setProjects((prev) => [...prev, toProject(created)]);
      } else if (edit.mode === "edit") {
        const updated = await api.updateProject(edit.id, payload);
        setProjects((prev) =>
          prev.map((p) => (p.id === edit.id ? toProject(updated) : p)),
        );
      }
      markSaved();
      closeDialog();
    } catch (err) {
      // Keep the dialog open so nothing typed is lost.
      setSaveStatus("error");
      setFormError(errorText(err, "Couldn't save this project."));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this project?")) return;
    setSaveStatus("saving");
    setPageError(null);
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      markSaved();
    } catch (err) {
      setSaveStatus("error");
      setPageError(errorText(err, "Couldn't delete this project."));
    }
  };

  const handleFeatureToggle = async (id: string) => {
    const current = projects.find((p) => p.id === id);
    const newFeatured = !current?.featured;

    setSaveStatus("saving");
    setPageError(null);
    try {
      await api.toggleProjectFeatured(id, newFeatured);
      // Featuring one project unfeatures the rest; re-read the saved state.
      await reload();
      markSaved();
    } catch (err) {
      setSaveStatus("error");
      setPageError(errorText(err, "Couldn't update the featured project."));
    }
  };

  const handleLogout = React.useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  return (
    <AppShell
      title="Projects"
      subtitle="Show the work. Pin one as featured."
      profile={profile}
      headerAction={
        <div className="flex items-center gap-2">
          <SaveStatus status={saveStatus} />
          <Button size="sm" variant="outline" onClick={openGithubImport}>
            <GithubIcon className="h-3.5 w-3.5" />
            Import from GitHub
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            Add project
          </Button>
        </div>
      }
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow="Projects"
          title="Show your work"
          description="Featured projects pin to the top of your public profile."
        />

        {pageError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {pageError}
          </div>
        )}

        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderGit2 className="h-4 w-4" />}
            title="No projects yet."
            description="Add the first one — pinned repo, live URL, the tech stack."
            action={
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={openGithubImport}>
                  <GithubIcon className="h-3.5 w-3.5" />
                  Import from GitHub
                </Button>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="h-3.5 w-3.5" />
                  Add project
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                mode="manage"
                onEdit={() => openEdit(p)}
                onDelete={() => handleDelete(p.id)}
                onFeatureToggle={() => handleFeatureToggle(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={edit.mode !== "closed"}
        onClose={closeDialog}
        title={edit.mode === "edit" ? "Edit project" : "Add project"}
        description="Project metadata shown on the public profile."
      >
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          {formError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {formError}
            </div>
          )}
          <Field label="Name" htmlFor="project-name">
            <Input
              id="project-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Stackly DNS"
              required
            />
          </Field>
          <Field label="Description" htmlFor="project-desc">
            <Textarea
              id="project-desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              placeholder="One paragraph about what it does."
            />
          </Field>
          <Field
            label="Tech"
            htmlFor="project-tech"
            hint="Comma-separated, e.g. Rust, DNS, Postgres."
          >
            <Input
              id="project-tech"
              value={form.tech}
              onChange={(e) => setForm({ ...form, tech: e.target.value })}
              placeholder="Rust, DNS"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Repository URL" htmlFor="project-repo">
              <Input
                id="project-repo"
                type="url"
                value={form.repoUrl}
                onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
                placeholder="https://github.com/…"
              />
            </Field>
            <Field label="Live URL" htmlFor="project-live">
              <Input
                id="project-live"
                type="url"
                value={form.liveUrl}
                onChange={(e) => setForm({ ...form, liveUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>
          <Field label="Status" htmlFor="project-status">
            <select
              id="project-status"
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as ProjectStatus,
                })
              }
              className="block h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            >
              <option value="live">Live</option>
              <option value="beta">Beta</option>
              <option value="wip">In progress</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit">
              {edit.mode === "edit" ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        title="Import from GitHub"
        description="Sync public repositories directly into your Stackly projects."
      >
        <div className="space-y-4">
          {githubError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {githubError}
            </div>
          )}

          {/* Account & Handle Bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-white/8 bg-[#15101E] p-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/5">
                <GithubIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="font-mono text-xs font-semibold text-[#FAF7FF]">
                  {githubData?.handle || "GitHub Account"}
                </div>
                <div className="text-[11px] text-[#9C92A8]">
                  {githubData?.connected
                    ? "Connected via OAuth"
                    : "Public profile preview"}
                </div>
              </div>
            </div>

            {githubData?.stats && (
              <div className="flex items-center gap-3 font-mono text-xs text-[#9C92A8]">
                <span>{githubData.stats.publicRepos} repos</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-400" />
                  {githubData.stats.totalStars}
                </span>
                <span>·</span>
                <span>{githubData.stats.followers} followers</span>
              </div>
            )}
          </div>

          {/* Username lookup form if needed */}
          <div className="flex items-center gap-2">
            <Input
              value={githubUsernameInput}
              onChange={(e) => setGithubUsernameInput(e.target.value)}
              placeholder="Enter GitHub username (e.g. torvalds)"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadGithub(githubUsernameInput)}
              disabled={githubLoading || !githubUsernameInput.trim()}
            >
              {githubLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Fetch"
              )}
            </Button>
          </div>

          {/* Repository List */}
          <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {githubLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-[#9C92A8]">
                <Loader2 className="h-6 w-6 animate-spin text-[#B88CFF]" />
                <span className="mt-2 text-xs font-mono">
                  Fetching repositories…
                </span>
              </div>
            ) : !githubData?.repos || githubData.repos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-[#9C92A8]">
                No repositories found. Enter a GitHub username above to fetch
                public repositories.
              </div>
            ) : (
              githubData.repos.map((repo) => {
                const imported = isRepoImported(repo);
                const isCurrentImporting = githubImporting === repo.name;
                return (
                  <div
                    key={repo.url}
                    className="flex items-start justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-3 transition-colors hover:border-white/15"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="font-medium text-sm text-[#FAF7FF] hover:underline flex items-center gap-1"
                        >
                          {repo.name}
                          <ExternalLink className="h-3 w-3 text-[#9C92A8]" />
                        </a>
                        {repo.language && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-[#B8AFC4]">
                            {repo.language}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 font-mono text-[11px] text-[#9C92A8]">
                          <Star className="h-3 w-3 text-amber-400" />
                          {repo.stars}
                        </span>
                      </div>
                      {repo.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-[#9C92A8]">
                          {repo.description}
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant={imported ? "ghost" : "outline"}
                      disabled={imported || isCurrentImporting}
                      onClick={() => handleImportRepo(repo)}
                      className="shrink-0 text-xs"
                    >
                      {isCurrentImporting ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Importing…
                        </>
                      ) : imported ? (
                        <>
                          <Check className="h-3 w-3 text-green-400 mr-1" />
                          Imported
                        </>
                      ) : (
                        "Import"
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/6 pt-3">
            <span className="text-[11px] font-mono text-[#9C92A8]">
              {githubData?.repos?.length || 0} repositories available
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setGithubOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}
