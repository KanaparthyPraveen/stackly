"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/stackly/app-shell";
import { Button } from "@/components/stackly/button";
import { Input, Textarea, Field } from "@/components/stackly/input";
import { PageHeader } from "@/components/stackly/page-header";
import {
  ProfileLinkCard,
  type ProfileLink,
} from "@/components/stackly/profile-link-card";
import { EmptyState } from "@/components/stackly/empty-state";
import { Dialog } from "@/components/stackly/dialog";
import { Link2 } from "lucide-react";
import {
  SaveStatus,
  type SaveStatus as SaveStatusT,
} from "@/components/stackly/save-status";
import { useAuth } from "@/context/auth-context";
import { useDashboardProfile } from "@/context/profile-context";
import { api, type LinkItem } from "@/lib/api";

type EditState =
  { mode: "closed" } | { mode: "add" } | { mode: "edit"; id: string };

type LinkFormState = {
  title: string;
  url: string;
  description: string;
  icon: string;
};

const emptyLinkForm = (): LinkFormState => ({
  title: "",
  url: "",
  description: "",
  icon: "↗",
});

const validate = (form: LinkFormState): string | null => {
  if (!form.title.trim()) return "Title is required.";
  if (!form.url.trim()) return "URL is required.";
  try {
    const u = new URL(form.url);
    if (!["http:", "https:"].includes(u.protocol))
      return "URL must start with http:// or https://";
  } catch {
    return "URL is not valid.";
  }
  return null;
};

const toProfileLink = (item: LinkItem): ProfileLink => ({
  id: item.id || item._id || "",
  title: item.title,
  url: item.url,
  description: item.description,
  icon: item.icon || "↗",
  enabled: item.enabled !== false,
});

const errorText = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

export default function LinksPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profile } = useDashboardProfile();

  const [links, setLinks] = React.useState<ProfileLink[]>([]);

  const [edit, setEdit] = React.useState<EditState>({ mode: "closed" });
  const [form, setForm] = React.useState<LinkFormState>(emptyLinkForm);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatusT>("idle");
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  const markSaved = React.useCallback(() => {
    setSaveStatus("saved");
    window.setTimeout(
      () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
      2000,
    );
  }, []);

  /** Shows the failure and puts the list back the way the server has it. */
  const markFailed = React.useCallback(
    (err: unknown, fallback: string, restore?: ProfileLink[]) => {
      if (restore) setLinks(restore);
      setSaveStatus("error");
      setPageError(errorText(err, fallback));
    },
    [],
  );

  // Load the user's links from the backend.
  React.useEffect(() => {
    let mounted = true;
    api
      .getLinks()
      .then((fetched) => {
        if (mounted) setLinks(fetched.map(toProfileLink));
      })
      .catch((err) => {
        if (mounted) {
          setPageError(errorText(err, "Couldn't load your links."));
        }
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  // Native HTML5 drag-and-drop.
  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (overId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    if (!fromId || fromId === overId) return;

    const fromIdx = links.findIndex((l) => l.id === fromId);
    const toIdx = links.findIndex((l) => l.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;

    const previous = links;
    const next = [...links];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setLinks(next);

    setSaveStatus("saving");
    setPageError(null);
    try {
      await api.reorderLinks(next.map((l) => l.id).filter(Boolean));
      markSaved();
    } catch (err) {
      markFailed(err, "Couldn't save the new order.", previous);
    }
  };
  const handleDragEnd = () => setDraggingId(null);

  const openAdd = () => {
    setForm(emptyLinkForm());
    setFormError(null);
    setEdit({ mode: "add" });
  };
  const openEdit = (link: ProfileLink) => {
    setForm({
      title: link.title,
      url: link.url,
      description: link.description ?? "",
      icon: link.icon ?? "↗",
    });
    setFormError(null);
    setEdit({ mode: "edit", id: link.id });
  };
  const closeDialog = () => {
    setEdit({ mode: "closed" });
    setFormError(null);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(form);
    if (err) {
      setFormError(err);
      return;
    }

    const payload = {
      title: form.title.trim(),
      url: form.url.trim(),
      description: form.description.trim(),
      icon: form.icon.trim() || "↗",
    };

    setSaveStatus("saving");
    setPageError(null);
    try {
      if (edit.mode === "add") {
        const created = await api.createLink(payload);
        setLinks((prev) => [...prev, toProfileLink(created)]);
      } else if (edit.mode === "edit") {
        const updated = await api.updateLink(edit.id, payload);
        setLinks((prev) =>
          prev.map((l) => (l.id === edit.id ? toProfileLink(updated) : l)),
        );
      }
      markSaved();
      closeDialog();
    } catch (saveErr) {
      // Keep the dialog open so nothing typed is lost.
      setSaveStatus("error");
      setFormError(errorText(saveErr, "Couldn't save this link."));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this link?")) return;
    const previous = links;
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setSaveStatus("saving");
    setPageError(null);
    try {
      await api.deleteLink(id);
      markSaved();
    } catch (err) {
      markFailed(err, "Couldn't delete this link.", previous);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    const previous = links;
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, enabled } : l)));
    setSaveStatus("saving");
    setPageError(null);
    try {
      await api.updateLink(id, { enabled });
      markSaved();
    } catch (err) {
      markFailed(err, "Couldn't update this link.", previous);
    }
  };

  const handleLogout = React.useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  const isDialogOpen = edit.mode !== "closed";

  return (
    <AppShell
      title="Links"
      subtitle="Drag to reorder. Toggle off to hide without deleting."
      profile={profile}
      headerAction={
        <div className="flex items-center gap-2">
          <SaveStatus status={saveStatus} />
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            Add link
          </Button>
        </div>
      }
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow="Links"
          title="Your links"
          description="Each link shows up on your public profile in the order below."
        />

        {pageError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {pageError}
          </div>
        )}

        {links.length === 0 ? (
          <EmptyState
            icon={<Link2 className="h-4 w-4" />}
            title="Your profile has no links yet."
            description="Add your first link to start building your public profile."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add link
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                draggable
                onDragStart={handleDragStart(link.id)}
                onDragOver={handleDragOver}
                onDrop={handleDrop(link.id)}
                onDragEnd={handleDragEnd}
                className={
                  draggingId === link.id ? "opacity-50" : "opacity-100"
                }
              >
                <ProfileLinkCard
                  link={link}
                  mode="manage"
                  onEdit={() => openEdit(link)}
                  onDelete={() => handleDelete(link.id)}
                  onToggle={(enabled) => handleToggle(link.id, enabled)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={isDialogOpen}
        onClose={closeDialog}
        title={edit.mode === "edit" ? "Edit link" : "Add link"}
        description="Links appear on your public profile in the order you set."
      >
        <form onSubmit={handleSaveLink} className="space-y-4" noValidate>
          {formError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {formError}
            </div>
          )}
          <Field label="Title" htmlFor="link-title">
            <Input
              id="link-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="GitHub"
              required
            />
          </Field>
          <Field label="URL" htmlFor="link-url">
            <Input
              id="link-url"
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://github.com/you"
              required
            />
          </Field>
          <Field label="Description" htmlFor="link-desc">
            <Textarea
              id="link-desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              placeholder="One-line summary."
            />
          </Field>
          <Field
            label="Icon"
            htmlFor="link-icon"
            hint="A single emoji or character."
          >
            <Input
              id="link-icon"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              maxLength={3}
              className="w-20 text-center"
            />
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
    </AppShell>
  );
}
