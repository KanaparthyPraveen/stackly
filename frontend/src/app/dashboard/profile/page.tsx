"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, Loader2, Eye } from "lucide-react";
import { AppShell } from "@/components/stackly/app-shell";
import { Button } from "@/components/stackly/button";
import { Input, Textarea, Field } from "@/components/stackly/input";
import { PageHeader } from "@/components/stackly/page-header";
import {
  ProfilePreview,
  type Profile,
  type ProfileSocial,
} from "@/components/stackly/profile-preview";
import {
  SaveStatus,
  type SaveStatus as SaveStatusT,
} from "@/components/stackly/save-status";
import { useAuth } from "@/context/auth-context";
import { useDashboardProfile } from "@/context/profile-context";
import {
  api,
  type LinkItem,
  type ProfileData,
  type ProjectItem,
} from "@/lib/api";
import { normalizeAppearance } from "@/lib/appearance";

type FormState = {
  avatarUrl: string;
  username: string;
  displayName: string;
  bio: string;
  location: string;
  website: string;
  github: string;
  x: string;
  linkedin: string;
  discord: string;
};

const EMPTY_FORM: FormState = {
  avatarUrl: "",
  username: "",
  displayName: "",
  bio: "",
  location: "",
  website: "",
  github: "",
  x: "",
  linkedin: "",
  discord: "",
};

const toForm = (p: ProfileData | null): FormState =>
  p
    ? {
        avatarUrl: p.avatarUrl || "",
        username: p.username || "",
        displayName: p.displayName || "",
        bio: p.bio || "",
        location: p.location || "",
        website: p.website || "",
        github: p.social?.github || "",
        x: p.social?.x || "",
        linkedin: p.social?.linkedin || "",
        discord: p.social?.discord || "",
      }
    : EMPTY_FORM;

const normalizeClientSocial = (
  platform: "github" | "x" | "linkedin" | "discord",
  val: string,
) => {
  let trimmed = val.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("@")) trimmed = trimmed.slice(1);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  switch (platform) {
    case "github":
      return /^github\.com\//i.test(trimmed)
        ? `https://${trimmed}`
        : `https://github.com/${trimmed}`;
    case "x":
      return /^(x|twitter)\.com\//i.test(trimmed)
        ? `https://${trimmed}`
        : `https://x.com/${trimmed}`;
    case "linkedin":
      return /^linkedin\.com\//i.test(trimmed)
        ? `https://${trimmed}`
        : trimmed.startsWith("in/")
          ? `https://linkedin.com/${trimmed}`
          : `https://linkedin.com/in/${trimmed}`;
    case "discord":
      return /^discord\.(gg|com)\//i.test(trimmed)
        ? `https://${trimmed}`
        : `https://discord.gg/${trimmed}`;
    default:
      return trimmed;
  }
};

const normalizeClientUrl = (val: string) => {
  const trimmed = val.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function ProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { data: saved, setData: setSaved } = useDashboardProfile();

  const [form, setForm] = React.useState<FormState>(() => toForm(saved));
  const [status, setStatus] = React.useState<SaveStatusT>("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [links, setLinks] = React.useState<LinkItem[]>([]);
  const [projects, setProjects] = React.useState<ProjectItem[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fill the form once the saved profile has loaded.
  const loadedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!saved || loadedFor.current === saved.username) return;
    loadedFor.current = saved.username;
    setForm(toForm(saved));
  }, [saved]);

  // The preview shows the user's real links and projects.
  React.useEffect(() => {
    let mounted = true;
    Promise.allSettled([api.getLinks(), api.getProjects()]).then(([l, p]) => {
      if (!mounted) return;
      if (l.status === "fulfilled") setLinks(l.value);
      if (p.status === "fulfilled") setProjects(p.value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const update =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      if (status === "saved" || status === "error") setStatus("idle");
    };

  // Live preview derives from the form state.
  const liveProfile: Profile = React.useMemo(() => {
    const social: ProfileSocial = {
      github: form.github || undefined,
      x: form.x || undefined,
      linkedin: form.linkedin || undefined,
      discord: form.discord || undefined,
      website: form.website || undefined,
    };
    return {
      username: form.username,
      displayName: form.displayName || form.username,
      bio: form.bio,
      avatarUrl: form.avatarUrl || undefined,
      location: form.location,
      website: form.website,
      live: saved?.live === true && saved?.ghostMode !== true,
      social,
    };
  }, [form, saved]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg(null);
    try {
      const cleanUsername = form.username
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
      if (!cleanUsername) {
        throw new Error("Username can't be empty.");
      }
      if (
        cleanUsername.length < 3 ||
        cleanUsername.length > 30 ||
        !/^[a-z0-9_-]+$/.test(cleanUsername)
      ) {
        throw new Error(
          "Username must be 3–30 characters and contain only lowercase letters, numbers, hyphens, or underscores.",
        );
      }

      const cleanWebsite = form.website.trim()
        ? normalizeClientUrl(form.website)
        : "";
      const cleanAvatar = form.avatarUrl.trim()
        ? normalizeClientUrl(form.avatarUrl)
        : "";
      const cleanGithub = normalizeClientSocial("github", form.github);
      const cleanX = normalizeClientSocial("x", form.x);
      const cleanLinkedin = normalizeClientSocial("linkedin", form.linkedin);
      const cleanDiscord = normalizeClientSocial("discord", form.discord);

      // An empty string clears a field on the server; omitting it would
      // leave the old value in place.
      const updated = await api.updateProfile({
        username: cleanUsername,
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        avatarUrl: cleanAvatar,
        location: form.location.trim(),
        website: cleanWebsite,
        social: {
          github: cleanGithub,
          x: cleanX,
          linkedin: cleanLinkedin,
          discord: cleanDiscord,
        },
      });
      loadedFor.current = updated.username;
      setSaved(updated);
      setForm(toForm(updated));
      setStatus("saved");
      window.setTimeout(() => {
        setStatus((s) => (s === "saved" ? "idle" : s));
      }, 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Couldn't save.");
    }
  };

  /** Uploads an image to storage and uses it as the avatar straight away. */
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setStatus("saving");
    setErrorMsg(null);
    try {
      const media = await api.uploadMedia(file, "avatar");
      const updated = await api.updateProfile({ avatarUrl: media.url });
      setSaved(updated);
      setForm((prev) => ({
        ...prev,
        avatarUrl: updated.avatarUrl || media.url,
      }));
      setStatus("saved");
      window.setTimeout(() => {
        setStatus((s) => (s === "saved" ? "idle" : s));
      }, 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Couldn't upload that image.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const previewLinks = links
    .filter((l) => l.enabled !== false)
    .map((l) => ({
      id: l.id || l._id || "",
      title: l.title,
      url: l.url,
      description: l.description,
      icon: l.icon,
      enabled: true,
    }));

  const previewProjects = projects.slice(0, 2).map((p) => ({
    id: p.id || p._id || "",
    name: p.name,
    description: p.description ?? "",
    tech: p.tech ?? [],
    repoUrl: p.repoUrl,
    liveUrl: p.liveUrl,
    status: p.status ?? "live",
    featured: p.featured ?? false,
  }));

  const handleLogout = React.useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  return (
    <AppShell
      title="Profile"
      subtitle="Edit what visitors see on your public page."
      profile={liveProfile}
      headerAction={
        <div className="flex items-center gap-2">
          {(saved?.username || liveProfile.username) && (
            <Button size="sm" variant="outline" asChild>
              <Link
                href={`/${saved?.username || liveProfile.username}`}
                target="_blank"
              >
                <Eye className="h-3.5 w-3.5" />
                View Live
              </Link>
            </Button>
          )}
          <SaveStatus status={status} />
          <Button
            onClick={(e) =>
              handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
            }
            disabled={status === "saving"}
            size="sm"
          >
            {status === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin-slow" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      }
      onLogout={handleLogout}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Form column */}
        <section className="space-y-6">
          <PageHeader
            eyebrow="Profile"
            title="Your identity"
            description="Update your username, bio, and the social links you want to show."
          />

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {errorMsg && status === "error" && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {errorMsg}
              </div>
            )}

            <div className="rounded-[18px] border border-white/8 bg-[#191321] p-5 sm:p-6 shadow-sm">
              <h3 className="mb-4 font-display text-base font-semibold tracking-tight text-[#FAF7FF]">
                Identity & Bio
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Avatar URL"
                  hint="Square image, ≥256×256 recommended."
                  htmlFor="avatarUrl"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      id="avatarUrl"
                      type="url"
                      value={form.avatarUrl}
                      onChange={update("avatarUrl")}
                      placeholder="https://…"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleAvatarFile}
                      className="hidden"
                      aria-label="Upload avatar image"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin-slow" />
                      ) : (
                        "Upload"
                      )}
                    </Button>
                  </div>
                </Field>
                <Field
                  label="Username"
                  htmlFor="username"
                  hint="stackly.app/username"
                >
                  <Input
                    id="username"
                    value={form.username}
                    onChange={update("username")}
                    placeholder="ada"
                    required
                    invalid={status === "error" && !form.username.trim()}
                  />
                </Field>
                <Field label="Display name" htmlFor="displayName">
                  <Input
                    id="displayName"
                    value={form.displayName}
                    onChange={update("displayName")}
                    placeholder="Ada Lovelace"
                  />
                </Field>
                <Field label="Location" htmlFor="location">
                  <Input
                    id="location"
                    value={form.location}
                    onChange={update("location")}
                    placeholder="London, UK"
                  />
                </Field>
                <Field
                  label="Bio"
                  htmlFor="bio"
                  className="sm:col-span-2"
                  hint="Up to ~280 characters."
                >
                  <Textarea
                    id="bio"
                    value={form.bio}
                    onChange={update("bio")}
                    rows={3}
                    maxLength={280}
                    placeholder="A few sentences about you."
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-[18px] border border-white/8 bg-[#191321] p-5 sm:p-6 shadow-sm">
              <h3 className="mb-4 font-display text-base font-semibold tracking-tight text-[#FAF7FF]">
                Public Links & Socials
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Website" htmlFor="website">
                  <Input
                    id="website"
                    type="text"
                    value={form.website}
                    onChange={update("website")}
                    placeholder="https://example.com"
                  />
                </Field>
                <Field label="GitHub" htmlFor="github">
                  <Input
                    id="github"
                    type="text"
                    value={form.github}
                    onChange={update("github")}
                    placeholder="@you or https://github.com/you"
                  />
                </Field>
                <Field label="X (Twitter)" htmlFor="x">
                  <Input
                    id="x"
                    type="text"
                    value={form.x}
                    onChange={update("x")}
                    placeholder="@you or https://x.com/you"
                  />
                </Field>
                <Field label="LinkedIn" htmlFor="linkedin">
                  <Input
                    id="linkedin"
                    type="text"
                    value={form.linkedin}
                    onChange={update("linkedin")}
                    placeholder="you or https://linkedin.com/in/you"
                  />
                </Field>
                <Field
                  label="Discord"
                  htmlFor="discord"
                  className="sm:col-span-2"
                >
                  <Input
                    id="discord"
                    type="text"
                    value={form.discord}
                    onChange={update("discord")}
                    placeholder="server or https://discord.gg/your-server"
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setForm(toForm(saved))}
              >
                Reset
              </Button>
              <Button type="submit" disabled={status === "saving"}>
                {status === "saving" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin-slow" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save changes
              </Button>
            </div>
          </form>
        </section>

        {/* Live preview */}
        <section className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Live preview
          </h2>
          <ProfilePreview
            profile={liveProfile}
            links={previewLinks}
            projects={previewProjects}
            appearance={normalizeAppearance(saved?.appearance)}
          />
        </section>
      </div>
    </AppShell>
  );
}
