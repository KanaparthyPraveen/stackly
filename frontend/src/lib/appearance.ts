/**
 * Appearance model shared by the editor, the live preview and the public
 * profile. Mirrors the backend `AppearanceConfig` schema.
 */

export type ThemeAccent =
  | "signal" // Electric Lavender / Midnight Purple (default)
  | "ocean" // Cyan / Deep Teal
  | "ember" // Amber / Deep Orange
  | "jade" // Emerald / Forest Green
  | "rose" // Rose / Crimson
  | "ice" // Arctic Blue / Slate
  | "gold" // Champagne Gold / Deep Bronze
  | "mono"; // Pure Monochrome / near-white

export type BackgroundStyle = "solid" | "gradient" | "aurora";
export type TypographyScale = "default" | "compact" | "editorial";
export type ButtonShape = "rounded" | "soft" | "square";
export type ProfileLayout = "centered" | "compact";
export type SurfaceStyle = "glass" | "solid" | "elevated" | "flat";
export type CanvasWidth = "narrow" | "standard" | "wide" | "full";
export type CanvasAlignment = "left" | "center";
export type ButtonHeight = "sm" | "md" | "lg";

export type AppearanceColors = {
  primary?: string;
  secondary?: string;
  background?: string;
  text?: string;
};

export type AppearanceSurface = {
  style: SurfaceStyle;
  color?: string;
  borderColor?: string;
  borderWidth: number;
  opacity: number;
  radius: number;
};

export type AppearanceTypographyScale = {
  heading: number;
  subheading: number;
  body: number;
  small: number;
};

export type AppearanceButton = {
  style: ButtonShape;
  radius: number;
  height: ButtonHeight;
};

export type AppearanceCanvas = {
  width: CanvasWidth;
  padding: number;
  spacing: number;
  contentWidth: number;
  align: CanvasAlignment;
  background?: string;
};

export type AppearanceConfig = {
  background: BackgroundStyle;
  accent: ThemeAccent;
  typography: TypographyScale;
  buttonStyle: ButtonShape;
  layout: ProfileLayout;
  colors: AppearanceColors;
  surface: AppearanceSurface;
  typographyScale: AppearanceTypographyScale;
  button: AppearanceButton;
  canvas: AppearanceCanvas;
  layoutOrder: string[];
};

/**
 * A partial appearance update. Nested sections are partial too, so a single
 * field (e.g. `surface.opacity`) can be patched without touching its siblings.
 */
export type AppearancePatch = {
  background?: BackgroundStyle;
  accent?: ThemeAccent;
  typography?: TypographyScale;
  buttonStyle?: ButtonShape;
  layout?: ProfileLayout;
  colors?: Partial<AppearanceColors>;
  surface?: Partial<AppearanceSurface>;
  typographyScale?: Partial<AppearanceTypographyScale>;
  button?: Partial<AppearanceButton>;
  canvas?: Partial<AppearanceCanvas>;
  layoutOrder?: string[];
};

export const DEFAULT_APPEARANCE: AppearanceConfig = {
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
  button: {
    style: "rounded",
    radius: 14,
    height: "md",
  },
  canvas: {
    width: "standard",
    padding: 24,
    spacing: 40,
    contentWidth: 680,
    align: "center",
  },
  layoutOrder: [],
};

/** Accent presets: strong colour, soft tint and the ambient glow colour. */
export const ACCENT_PRESETS: Record<
  ThemeAccent,
  { primary: string; soft: string; glow: string }
> = {
  signal: {
    primary: "#B88CFF",
    soft: "#9B6DFF",
    glow: "rgba(124,58,237,0.18)",
  },
  ocean: { primary: "#22D3EE", soft: "#67E8F9", glow: "rgba(34,211,238,0.18)" },
  ember: { primary: "#F97316", soft: "#FBB975", glow: "rgba(249,115,22,0.18)" },
  jade: { primary: "#10B981", soft: "#6EE7B7", glow: "rgba(16,185,129,0.18)" },
  rose: { primary: "#F43F5E", soft: "#FDA4AF", glow: "rgba(244,63,94,0.18)" },
  ice: { primary: "#60A5FA", soft: "#BAE6FD", glow: "rgba(96,165,250,0.18)" },
  gold: { primary: "#EAB308", soft: "#FDE68A", glow: "rgba(234,179,8,0.18)" },
  mono: { primary: "#E2E8F0", soft: "#CBD5E1", glow: "rgba(226,232,240,0.10)" },
};

/** Converts a hex colour to an rgba() string with the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Resolves the accent colours for a configuration. A custom primary colour
 * overrides the preset and derives its own glow.
 */
export function resolveAccent(
  accent: ThemeAccent,
  colors?: AppearanceColors,
): { primary: string; soft: string; glow: string } {
  const preset = ACCENT_PRESETS[accent] ?? ACCENT_PRESETS.signal;

  if (colors?.primary) {
    return {
      primary: colors.primary,
      soft: colors.secondary ?? colors.primary,
      glow: withAlpha(colors.primary, 0.18),
    };
  }

  return preset;
}

/** Deep-merges a partial appearance patch onto a base configuration. */
export function mergeAppearance(
  base: AppearanceConfig,
  patch?: AppearancePatch | null,
): AppearanceConfig {
  const next: AppearanceConfig = {
    ...base,
    ...(patch ?? {}),
    colors: { ...base.colors, ...(patch?.colors ?? {}) },
    surface: { ...base.surface, ...(patch?.surface ?? {}) },
    typographyScale: {
      ...base.typographyScale,
      ...(patch?.typographyScale ?? {}),
    },
    button: { ...base.button, ...(patch?.button ?? {}) },
    canvas: { ...base.canvas, ...(patch?.canvas ?? {}) },
    layoutOrder: patch?.layoutOrder
      ? [...patch.layoutOrder]
      : [...base.layoutOrder],
  };

  // The flat `buttonStyle` mirrors `button.style` — keep them in sync.
  if (patch?.button?.style) next.buttonStyle = patch.button.style;
  if (patch?.buttonStyle) next.button.style = patch.buttonStyle;

  return next;
}

/** Normalises an appearance payload coming from the API. */
export function normalizeAppearance(
  raw?: AppearancePatch | null,
): AppearanceConfig {
  if (!raw) return DEFAULT_APPEARANCE;
  return mergeAppearance(DEFAULT_APPEARANCE, raw);
}

/* ─── Resolved presentation helpers ───────────────────────────────────── */

export type ResolvedButton = {
  radiusClass: string;
  radiusPx: number;
  heightClass: string;
  paddingClass: string;
};

export function resolveButton(appearance: AppearanceConfig): ResolvedButton {
  const style = appearance.button?.style ?? appearance.buttonStyle;
  const explicitRadius = appearance.button?.radius;

  let radiusPx: number;
  if (
    style === "square" &&
    (explicitRadius === undefined ||
      explicitRadius === 14 ||
      explicitRadius === 0)
  ) {
    radiusPx = 0;
  } else if (
    style === "soft" &&
    (explicitRadius === undefined ||
      explicitRadius === 14 ||
      explicitRadius >= 999)
  ) {
    radiusPx = 999;
  } else if (typeof explicitRadius === "number") {
    radiusPx = explicitRadius;
  } else if (style === "square") {
    radiusPx = 0;
  } else if (style === "soft") {
    radiusPx = 999;
  } else {
    radiusPx = 14;
  }

  const radiusClass =
    radiusPx === 0
      ? "rounded-none"
      : radiusPx >= 999
        ? "rounded-full"
        : radiusPx <= 6
          ? "rounded"
          : radiusPx <= 10
            ? "rounded-lg"
            : radiusPx <= 14
              ? "rounded-[14px]"
              : radiusPx <= 20
                ? "rounded-2xl"
                : "rounded-3xl";

  const height = appearance.button?.height ?? "md";
  const heightClass =
    height === "sm" ? "py-2.5" : height === "lg" ? "py-4" : "py-3.5";
  const paddingClass =
    height === "sm" ? "px-4" : height === "lg" ? "px-6" : "px-5";

  return { radiusClass, radiusPx, heightClass, paddingClass };
}

export type ResolvedSurface = {
  background: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
};

export function resolveSurface(appearance: AppearanceConfig): ResolvedSurface {
  const surface = appearance.surface ?? DEFAULT_APPEARANCE.surface;
  const style = surface.style ?? "glass";
  const opacity = surface.opacity ?? 5;

  let background = `rgba(255,255,255,${opacity / 100})`;
  if (style === "solid") {
    background = surface.color ?? "#15101E";
  } else if (style === "elevated") {
    background = surface.color ?? "#191321";
  } else if (style === "flat") {
    background = "transparent";
  } else if (surface.color) {
    background = withAlpha(surface.color, Math.max(opacity, 20) / 100);
  }

  return {
    background,
    borderColor:
      surface.borderColor ??
      (style === "flat" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.10)"),
    borderWidth: surface.borderWidth ?? 1,
    radius: surface.radius ?? 22,
  };
}

export type ResolvedCanvas = {
  maxWidth: number | null;
  padding: number;
  spacing: number;
  align: CanvasAlignment;
  background?: string;
};

export function resolveCanvas(appearance: AppearanceConfig): ResolvedCanvas {
  const canvas = appearance.canvas ?? DEFAULT_APPEARANCE.canvas;
  const width = canvas.width ?? "standard";

  const maxWidth =
    canvas.contentWidth && canvas.contentWidth > 0
      ? canvas.contentWidth
      : width === "narrow"
        ? 440
        : width === "wide"
          ? 900
          : width === "full"
            ? 1200
            : 680;

  return {
    maxWidth,
    padding: canvas.padding ?? 24,
    spacing: canvas.spacing ?? 40,
    align: canvas.align ?? "center",
    background: canvas.background,
  };
}

export type ResolvedTypography = {
  headingPx: number;
  subheadingPx: number;
  bodyPx: number;
  smallPx: number;
  headingWeight: number;
};

export function resolveTypography(
  appearance: AppearanceConfig,
): ResolvedTypography {
  const scale =
    appearance.typographyScale ?? DEFAULT_APPEARANCE.typographyScale;
  const preset = appearance.typography ?? "default";

  const multiplier =
    preset === "editorial" ? 1.25 : preset === "compact" ? 0.85 : 1;

  return {
    headingPx: Math.round((scale.heading ?? 30) * multiplier),
    subheadingPx: Math.round((scale.subheading ?? 18) * multiplier),
    bodyPx: Math.round((scale.body ?? 14) * multiplier),
    smallPx: Math.round((scale.small ?? 11) * multiplier),
    headingWeight:
      preset === "editorial" ? 800 : preset === "compact" ? 700 : 700,
  };
}

/** Page background style for the public profile. */
export function resolvePageBackground(
  appearance: AppearanceConfig,
  accent: { glow: string },
): React.CSSProperties {
  if (appearance.colors?.background) {
    return { backgroundColor: appearance.colors.background };
  }

  switch (appearance.background) {
    case "solid":
      return { backgroundColor: "#0F0B16" };
    case "gradient":
      return {
        background: "linear-gradient(160deg, #15101E 0%, #09070D 100%)",
      };
    case "aurora":
    default:
      return {
        background: `radial-gradient(ellipse 120% 60% at 50% 0%, ${accent.glow.replace(
          "0.18",
          "0.32",
        )} 0%, #09070D 70%)`,
      };
  }
}
