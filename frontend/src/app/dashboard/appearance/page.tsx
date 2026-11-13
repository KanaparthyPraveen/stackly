"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Eye, Save } from "lucide-react";
import { AppShell } from "@/components/stackly/app-shell";
import { Button } from "@/components/stackly/button";
import { Field } from "@/components/stackly/input";
import { PageHeader } from "@/components/stackly/page-header";
import {
  ProfilePreview,
  resolveAccent,
  type AppearanceConfig,
  type ThemeAccent,
} from "@/components/stackly/profile-preview";
import {
  DEFAULT_APPEARANCE,
  mergeAppearance,
  normalizeAppearance,
  type AppearancePatch,
} from "@/lib/appearance";
import {
  SaveStatus,
  type SaveStatus as SaveStatusT,
} from "@/components/stackly/save-status";
import { useAuth } from "@/context/auth-context";
import { useDashboardProfile } from "@/context/profile-context";
import {
  api,
  type AppearancePatch as ServerPatch,
  type LinkItem,
  type ProjectItem,
} from "@/lib/api";

/** How long to wait after the last change before saving. */
const SAVE_DELAY_MS = 400;

const SECTION_KEYS = [
  "colors",
  "surface",
  "typographyScale",
  "button",
  "canvas",
] as const;

/** Folds a newer patch into one that is still waiting to be saved. */
function combinePatches(pending: ServerPatch, next: ServerPatch): ServerPatch {
  const combined: ServerPatch = { ...pending, ...next };
  for (const key of SECTION_KEYS) {
    if (pending[key] || next[key]) {
      Object.assign(combined, { [key]: { ...pending[key], ...next[key] } });
    }
  }
  return combined;
}

/* ─── Types ─────────────────────────────────────────────────────── */

type Option<T extends string> = { value: T; label: string; hint?: string };

type ThemeDef = {
  value: ThemeAccent;
  label: string;
  desc: string;
};

const THEMES: ThemeDef[] = [
  { value: "signal", label: "Signal", desc: "Electric Lavender" },
  { value: "ocean", label: "Ocean", desc: "Cyan Teal" },
  { value: "ember", label: "Ember", desc: "Amber Orange" },
  { value: "jade", label: "Jade", desc: "Emerald Green" },
  { value: "rose", label: "Rose", desc: "Crimson Pink" },
  { value: "ice", label: "Ice", desc: "Arctic Blue" },
  { value: "gold", label: "Gold", desc: "Champagne Gold" },
  { value: "mono", label: "Mono", desc: "Pure Monochrome" },
];

const BG_OPTIONS: Option<AppearanceConfig["background"]>[] = [
  { value: "solid", label: "Solid", hint: "Flat midnight surface" },
  { value: "gradient", label: "Gradient", hint: "Elevated violet tint" },
  { value: "aurora", label: "Atmosphere", hint: "Ambient glow orbs" },
];

const SURFACE_OPTIONS: Option<AppearanceConfig["surface"]["style"]>[] = [
  { value: "glass", label: "Glass", hint: "Translucent blur" },
  { value: "solid", label: "Solid", hint: "Opaque fill" },
  { value: "elevated", label: "Elevated", hint: "Raised panel" },
  { value: "flat", label: "Flat", hint: "No fill" },
];

const TYPOGRAPHY_OPTIONS: Option<AppearanceConfig["typography"]>[] = [
  { value: "default", label: "Default", hint: "Standard rounded sans." },
  { value: "compact", label: "Compact", hint: "Tighter developer scale." },
  { value: "editorial", label: "Expressive", hint: "Larger bold display." },
];

const BUTTON_OPTIONS: Option<AppearanceConfig["buttonStyle"]>[] = [
  { value: "rounded", label: "Rounded", hint: "11px modern radius." },
  { value: "soft", label: "Pill", hint: "Fully pill-shaped." },
  { value: "square", label: "Sharp", hint: "Terminal style." },
];

const BUTTON_HEIGHT_OPTIONS: Option<AppearanceConfig["button"]["height"]>[] = [
  { value: "sm", label: "Small", hint: "Compact." },
  { value: "md", label: "Medium", hint: "Default." },
  { value: "lg", label: "Large", hint: "Roomy." },
];

const LAYOUT_OPTIONS: Option<AppearanceConfig["layout"]>[] = [
  { value: "centered", label: "Centered", hint: "Standard column." },
  { value: "compact", label: "Spacious", hint: "Wider tech canvas." },
];

const CANVAS_WIDTH_OPTIONS: Option<AppearanceConfig["canvas"]["width"]>[] = [
  { value: "narrow", label: "Narrow", hint: "440px." },
  { value: "standard", label: "Standard", hint: "680px." },
  { value: "wide", label: "Wide", hint: "900px." },
  { value: "full", label: "Full", hint: "1200px." },
];

const ALIGN_OPTIONS: Option<AppearanceConfig["canvas"]["align"]>[] = [
  { value: "center", label: "Centered", hint: "Stacked." },
  { value: "left", label: "Left", hint: "Editorial." },
];

/* ─── RadioRow ───────────────────────────────────────────────────── */

function RadioRow<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={
              "rounded-[12px] border px-3.5 py-2.5 text-left text-sm transition-all " +
              (selected
                ? "border-[#B88CFF]/50 bg-[#7C3AED]/15 text-[#FAF7FF] shadow-xs"
                : "border-white/8 bg-[#15101E] text-[#9C92A8] hover:border-white/15 hover:text-[#FAF7FF]")
            }
          >
            <div className="font-medium text-[#FAF7FF]">{opt.label}</div>
            {opt.hint && (
              <div className="mt-0.5 text-[11px] font-mono uppercase tracking-wider text-[#9C92A8]">
                {opt.hint}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── ThemePicker ────────────────────────────────────────────────── */

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeAccent;
  onChange: (next: ThemeAccent) => void;
}) {
  return (
    <div
      className="grid grid-cols-4 gap-2.5"
      role="radiogroup"
      aria-label="Color theme"
    >
      {THEMES.map((theme) => {
        const { primary, glow } = resolveAccent(theme.value);
        const selected = theme.value === value;
        return (
          <button
            key={theme.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={`${theme.label} — ${theme.desc}`}
            onClick={() => onChange(theme.value)}
            className={[
              "group relative flex flex-col items-center gap-2 rounded-[14px] border p-3 text-center transition-all",
              selected
                ? "border-white/20 bg-[#191321] shadow-md"
                : "border-white/6 bg-[#15101E] hover:border-white/12 hover:bg-[#191321]",
            ].join(" ")}
            style={selected ? { boxShadow: `0 0 20px -4px ${glow}` } : {}}
          >
            <span
              className="h-8 w-8 rounded-full transition-transform group-hover:scale-105"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${primary}, ${primary}99)`,
                boxShadow: selected
                  ? `0 0 14px 2px ${glow}`
                  : `0 0 0px 0px transparent`,
              }}
              aria-hidden
            />

            {selected && (
              <span
                className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full"
                style={{ background: primary }}
              >
                <Check className="h-2.5 w-2.5 text-[#09070D]" strokeWidth={3} />
              </span>
            )}

            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-[#FAF7FF] leading-none">
                {theme.label}
              </p>
              <p className="text-[10px] font-mono text-[#9C92A8] leading-none">
                {theme.desc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Slider + colour helpers ────────────────────────────────────── */

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-[#9C92A8]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[#B88CFF]"
      />
      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-[#FAF7FF]">
        {value}
        {suffix}
      </span>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value?: string;
  onChange: (next: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-[#9C92A8]">{label}</span>
      <input
        type="color"
        aria-label={label}
        value={value ?? "#7C3AED"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
      />
      <span className="font-mono text-[11px] text-[#FAF7FF]">
        {value ?? "preset"}
      </span>
      {value ? (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-[11px] font-mono uppercase tracking-wider text-[#9C92A8] underline-offset-2 hover:text-[#FAF7FF] hover:underline"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function AppearancePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { reload: reloadProfile } = useDashboardProfile();
  const [config, setConfig] =
    React.useState<AppearanceConfig>(DEFAULT_APPEARANCE);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatusT>("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<{
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    location?: string;
    website?: string;
    social?: Record<string, string | undefined>;
  } | null>(null);
  const [links, setLinks] = React.useState<LinkItem[]>([]);
  const [projects, setProjects] = React.useState<ProjectItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Load the saved profile, its content and the appearance config.
  React.useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [prof, userLinks, userProjects] = await Promise.allSettled([
          api.getMyProfile(),
          api.getLinks(),
          api.getProjects(),
        ]);

        if (!mounted) return;

        if (prof.status === "fulfilled" && prof.value) {
          setProfile({
            username: prof.value.username,
            displayName: prof.value.displayName || prof.value.username,
            bio: prof.value.bio,
            avatarUrl: prof.value.avatarUrl,
            location: prof.value.location,
            website: prof.value.website,
            social: prof.value.social as Record<string, string | undefined>,
          });
          if (prof.value.appearance) {
            setConfig(normalizeAppearance(prof.value.appearance));
          }
        }

        if (userLinks.status === "fulfilled" && userLinks.value) {
          setLinks(userLinks.value);
        }
        if (userProjects.status === "fulfilled" && userProjects.value) {
          setProjects(userProjects.value);
        }
      } catch (err) {
        console.warn("Could not load appearance settings:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  const pendingRef = React.useRef<ServerPatch | null>(null);
  const timerRef = React.useRef<number | null>(null);

  /** Sends everything changed since the last save in one request. */
  const flush = React.useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const patch = pendingRef.current;
    pendingRef.current = null;
    if (!patch) return;

    try {
      await api.updateAppearance(patch);
      // Other dashboard pages preview the profile with its saved look.
      void reloadProfile();
      // A newer change may already be waiting; only then is it not "saved".
      if (!pendingRef.current) {
        setSaveStatus("saved");
        window.setTimeout(
          () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
          1800,
        );
      }
    } catch (err) {
      setSaveStatus("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not save appearance settings.",
      );
      // The preview must not show something that was never saved: go back
      // to what the server actually has.
      try {
        setConfig(normalizeAppearance(await api.getMyAppearance()));
      } catch {
        /* keep the local state; the error is already shown */
      }
    }
  }, [reloadProfile]);

  /**
   * Applies a change locally for an instant preview and schedules a save.
   * Rapid changes (dragging a slider) are batched into a single request.
   *
   * `serverPatch` differs from `patch` only when a value is being reset: the
   * preview drops the value, while the server is told to clear it (`null`).
   */
  const update = React.useCallback(
    (patch: AppearancePatch, serverPatch: ServerPatch = patch) => {
      setConfig((current) => mergeAppearance(current, patch));
      pendingRef.current = combinePatches(
        pendingRef.current ?? {},
        serverPatch,
      );
      setSaveStatus("saving");
      setErrorMsg(null);

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // Leaving the page must not drop a change that is still waiting.
  React.useEffect(() => () => void flush(), [flush]);

  const handleLogout = React.useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  const previewProfile = {
    username: profile?.username ?? "yourhandle",
    displayName: profile?.displayName ?? "Your Name",
    bio: profile?.bio,
    avatarUrl: profile?.avatarUrl,
    location: profile?.location,
    website: profile?.website,
    social: profile?.social,
  };

  const enabledLinks = links
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

  return (
    <AppShell
      title="Appearance"
      subtitle="Tune your public portfolio appearance. Preview updates live."
      profile={previewProfile}
      headerAction={
        <div className="flex items-center gap-2">
          {profile?.username && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/${profile.username}`} target="_blank">
                <Eye className="h-3.5 w-3.5" />
                View Live
              </Link>
            </Button>
          )}
          <SaveStatus status={saveStatus} />
          <Button
            size="sm"
            variant="default"
            onClick={() => void flush()}
            disabled={saveStatus === "idle" || saveStatus === "saved"}
            aria-label="Save appearance changes"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      }
      onLogout={handleLogout}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-w-6xl">
        {/* ── Left: Controls ── */}
        <section className="space-y-6">
          <PageHeader
            eyebrow="Styling"
            title="Theme & Appearance"
            description="Calibrate color, surfaces, typography, and button geometry."
          />

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[12px] border border-[#FF5C70]/30 bg-[#FF5C70]/10 p-3.5 text-sm text-[#FF5C70]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-6 rounded-[18px] border border-white/8 bg-[#191321] p-5 sm:p-6">
            {/* Color Theme */}
            <Field
              label="Color Theme"
              hint="Sets the accent color across your entire public profile."
            >
              <div className="space-y-3">
                <ThemePicker
                  value={config.accent}
                  onChange={(v) => update({ accent: v })}
                />
                <ColorInput
                  label="Custom accent"
                  value={config.colors?.primary}
                  onChange={(hex) => update({ colors: { primary: hex } })}
                  onReset={() =>
                    update(
                      { colors: { primary: undefined } },
                      { colors: { primary: null } },
                    )
                  }
                />
                <ColorInput
                  label="Custom secondary"
                  value={config.colors?.secondary}
                  onChange={(hex) => update({ colors: { secondary: hex } })}
                  onReset={() =>
                    update(
                      { colors: { secondary: undefined } },
                      { colors: { secondary: null } },
                    )
                  }
                />
                <ColorInput
                  label="Custom text color"
                  value={config.colors?.text}
                  onChange={(hex) => update({ colors: { text: hex } })}
                  onReset={() =>
                    update(
                      { colors: { text: undefined } },
                      { colors: { text: null } },
                    )
                  }
                />
              </div>
            </Field>

            <div className="h-px bg-white/6" />

            {/* Background */}
            <Field
              label="Background Surface"
              hint="Sets what visitors see behind your linkcard."
            >
              <div className="space-y-3">
                <div
                  className="grid grid-cols-3 gap-2"
                  role="radiogroup"
                  aria-label="Background surface"
                >
                  {BG_OPTIONS.map((opt) => {
                    const selected = opt.value === config.background;
                    const { primary, glow } = resolveAccent(
                      config.accent,
                      config.colors,
                    );
                    const previewStyle =
                      opt.value === "solid"
                        ? { background: "#0F0B16" }
                        : opt.value === "gradient"
                          ? {
                              background: `linear-gradient(160deg, #15101E 0%, #09070D 100%)`,
                              boxShadow: `inset 0 1px 0 ${primary}22`,
                            }
                          : {
                              background: `radial-gradient(ellipse 120% 60% at 50% 0%, ${glow.replace("0.18", "0.35")} 0%, #09070D 70%)`,
                            };
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => update({ background: opt.value })}
                        className={[
                          "flex flex-col gap-2 rounded-[12px] border p-2.5 text-left transition-all",
                          selected
                            ? "border-[#B88CFF]/50 bg-[#7C3AED]/10"
                            : "border-white/8 bg-[#15101E] hover:border-white/15",
                        ].join(" ")}
                      >
                        <div
                          className="h-10 w-full rounded-[8px] border border-white/8"
                          style={previewStyle}
                          aria-hidden
                        />
                        <div>
                          <div className="text-xs font-semibold text-[#FAF7FF]">
                            {opt.label}
                          </div>
                          <div className="text-[10px] font-mono text-[#9C92A8]">
                            {opt.hint}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <ColorInput
                  label="Custom background"
                  value={config.colors?.background}
                  onChange={(hex) => update({ colors: { background: hex } })}
                  onReset={() =>
                    update(
                      { colors: { background: undefined } },
                      { colors: { background: null } },
                    )
                  }
                />
              </div>
            </Field>

            <div className="h-px bg-white/6" />

            {/* Surface */}
            <Field
              label="Surface"
              hint="Controls cards, panels, containers, borders and surface colors."
            >
              <div className="space-y-3">
                <RadioRow
                  name="surface style"
                  value={config.surface.style}
                  options={SURFACE_OPTIONS}
                  onChange={(v) => update({ surface: { style: v } })}
                />
                <ColorInput
                  label="Surface color"
                  value={config.surface.color}
                  onChange={(hex) => update({ surface: { color: hex } })}
                  onReset={() =>
                    update(
                      { surface: { color: undefined } },
                      { surface: { color: null } },
                    )
                  }
                />
                <ColorInput
                  label="Border color"
                  value={config.surface.borderColor}
                  onChange={(hex) => update({ surface: { borderColor: hex } })}
                  onReset={() =>
                    update(
                      { surface: { borderColor: undefined } },
                      { surface: { borderColor: null } },
                    )
                  }
                />
                <Slider
                  label="Opacity"
                  value={config.surface.opacity}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => update({ surface: { opacity: v } })}
                />
                <Slider
                  label="Border width"
                  value={config.surface.borderWidth}
                  min={0}
                  max={4}
                  onChange={(v) => update({ surface: { borderWidth: v } })}
                />
                <Slider
                  label="Corner radius"
                  value={config.surface.radius}
                  min={0}
                  max={48}
                  onChange={(v) => update({ surface: { radius: v } })}
                />
              </div>
            </Field>

            <div className="h-px bg-white/6" />

            {/* Typography */}
            <Field
              label="Typography Scale"
              hint="Heading, subheading, body and small-text sizes."
            >
              <div className="space-y-3">
                <RadioRow
                  name="typography"
                  value={config.typography}
                  options={TYPOGRAPHY_OPTIONS}
                  onChange={(v) => update({ typography: v })}
                />
                <Slider
                  label="Heading"
                  value={config.typographyScale.heading}
                  min={16}
                  max={72}
                  onChange={(v) => update({ typographyScale: { heading: v } })}
                />
                <Slider
                  label="Subheading"
                  value={config.typographyScale.subheading}
                  min={12}
                  max={48}
                  onChange={(v) =>
                    update({ typographyScale: { subheading: v } })
                  }
                />
                <Slider
                  label="Body"
                  value={config.typographyScale.body}
                  min={10}
                  max={32}
                  onChange={(v) => update({ typographyScale: { body: v } })}
                />
                <Slider
                  label="Small text"
                  value={config.typographyScale.small}
                  min={8}
                  max={24}
                  onChange={(v) => update({ typographyScale: { small: v } })}
                />
              </div>
            </Field>

            <div className="h-px bg-white/6" />

            {/* Button Geometry */}
            <Field
              label="Button Geometry"
              hint="Shape, radius and height of profile buttons."
            >
              <div className="space-y-3">
                <RadioRow
                  name="button style"
                  value={config.buttonStyle}
                  options={BUTTON_OPTIONS}
                  onChange={(v) => {
                    const defaultRadius =
                      v === "square" ? 0 : v === "soft" ? 999 : 14;
                    update({
                      buttonStyle: v,
                      button: { style: v, radius: defaultRadius },
                    });
                  }}
                />
                <RadioRow
                  name="button height"
                  value={config.button.height}
                  options={BUTTON_HEIGHT_OPTIONS}
                  onChange={(v) => update({ button: { height: v } })}
                />
                <Slider
                  label="Corner radius"
                  value={
                    config.button.radius >= 999 ? 48 : config.button.radius
                  }
                  min={0}
                  max={48}
                  onChange={(v) => {
                    const style =
                      v === 0 ? "square" : v >= 48 ? "soft" : "rounded";
                    update({
                      buttonStyle: style,
                      button: { radius: v, style },
                    });
                  }}
                />
              </div>
            </Field>

            <div className="h-px bg-white/6" />

            {/* Canvas */}
            <Field
              label="Profile Canvas"
              hint="Canvas width, spacing, padding and content area."
            >
              <div className="space-y-3">
                <RadioRow
                  name="canvas width"
                  value={config.canvas.width}
                  options={CANVAS_WIDTH_OPTIONS}
                  onChange={(v) => update({ canvas: { width: v } })}
                />
                <RadioRow
                  name="canvas alignment"
                  value={config.canvas.align}
                  options={ALIGN_OPTIONS}
                  onChange={(v) => update({ canvas: { align: v } })}
                />
                <Slider
                  label="Padding"
                  value={config.canvas.padding}
                  min={0}
                  max={96}
                  onChange={(v) => update({ canvas: { padding: v } })}
                />
                <Slider
                  label="Spacing"
                  value={config.canvas.spacing}
                  min={8}
                  max={96}
                  onChange={(v) => update({ canvas: { spacing: v } })}
                />
                <Slider
                  label="Content width"
                  value={config.canvas.contentWidth}
                  min={320}
                  max={1600}
                  step={10}
                  onChange={(v) => update({ canvas: { contentWidth: v } })}
                />
                <ColorInput
                  label="Canvas color"
                  value={config.canvas.background}
                  onChange={(hex) => update({ canvas: { background: hex } })}
                  onReset={() =>
                    update(
                      { canvas: { background: undefined } },
                      { canvas: { background: null } },
                    )
                  }
                />
              </div>
            </Field>

            <div className="h-px bg-white/6" />

            {/* Layout */}
            <Field
              label="Profile Canvas Layout"
              hint="How components are arranged."
            >
              <RadioRow
                name="layout"
                value={config.layout}
                options={LAYOUT_OPTIONS}
                onChange={(v) => update({ layout: v })}
              />
            </Field>
          </div>
        </section>

        {/* ── Right: Live preview ── */}
        <section className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#9C92A8]">
              Live Preview
            </h2>
            <span className="font-mono text-[10px] text-[#46D369]">
              ● {loading ? "Loading" : "Live"}
            </span>
          </div>

          {/* Browser-frame shell — fixed height, internal scroll */}
          <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#0D0A12] shadow-2xl shadow-black/60">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-white/6 bg-[#15101E] px-3.5 py-2.5">
              <span className="h-2 w-2 rounded-full bg-[#FF5C70]/60" />
              <span className="h-2 w-2 rounded-full bg-[#F5B84B]/60" />
              <span className="h-2 w-2 rounded-full bg-[#46D369]/60" />
              <span className="ml-2 flex-1 truncate rounded-md bg-[#0D0A12] px-2.5 py-0.5 font-mono text-[10px] text-[#9C92A8]">
                stackly.dev/@{previewProfile.username}
              </span>
            </div>

            {/* Scrollable preview — max 600px tall */}
            <div className="max-h-[600px] overflow-y-auto">
              <ProfilePreview
                profile={previewProfile}
                links={enabledLinks}
                projects={previewProjects}
                appearance={config}
                className="border-0 shadow-none"
              />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
