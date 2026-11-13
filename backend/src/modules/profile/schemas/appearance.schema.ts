import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/* ─── Allowed values (single source of truth for schema + DTO validation) ── */

export const THEME_ACCENTS = [
  'signal',
  'ocean',
  'ember',
  'jade',
  'rose',
  'ice',
  'gold',
  'mono',
] as const;

export const BACKGROUND_STYLES = ['solid', 'gradient', 'aurora'] as const;

export const TYPOGRAPHY_SCALES = ['default', 'compact', 'editorial'] as const;

export const BUTTON_SHAPES = ['rounded', 'soft', 'square'] as const;

export const PROFILE_LAYOUTS = ['centered', 'compact'] as const;

export const SURFACE_STYLES = ['glass', 'solid', 'elevated', 'flat'] as const;

export const CANVAS_WIDTHS = ['narrow', 'standard', 'wide', 'full'] as const;

export const CANVAS_ALIGNMENTS = ['left', 'center'] as const;

export const BUTTON_HEIGHTS = ['sm', 'md', 'lg'] as const;

export type ThemeAccent = (typeof THEME_ACCENTS)[number];
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];
export type TypographyScale = (typeof TYPOGRAPHY_SCALES)[number];
export type ButtonShape = (typeof BUTTON_SHAPES)[number];
export type ProfileLayout = (typeof PROFILE_LAYOUTS)[number];
export type SurfaceStyle = (typeof SURFACE_STYLES)[number];
export type CanvasWidth = (typeof CANVAS_WIDTHS)[number];
export type CanvasAlignment = (typeof CANVAS_ALIGNMENTS)[number];
export type ButtonHeight = (typeof BUTTON_HEIGHTS)[number];

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/* ─── Sub-documents ─────────────────────────────────────────────────────── */

/** Custom colour overrides layered on top of the selected preset. */
@Schema({ _id: false })
export class AppearanceColors {
  /** Custom primary/accent colour (e.g. "#7C3AED"). */
  @Prop({ type: String, match: HEX_PATTERN })
  primary?: string;

  /** Secondary highlight colour used for gradients and hovers. */
  @Prop({ type: String, match: HEX_PATTERN })
  secondary?: string;

  /** Custom page background colour. */
  @Prop({ type: String, match: HEX_PATTERN })
  background?: string;

  /** Custom body text colour. */
  @Prop({ type: String, match: HEX_PATTERN })
  text?: string;
}
export const AppearanceColorsSchema =
  SchemaFactory.createForClass(AppearanceColors);

/** Card / panel / container surface treatment. */
@Schema({ _id: false })
export class AppearanceSurface {
  @Prop({ type: String, default: 'glass', enum: SURFACE_STYLES })
  style: SurfaceStyle;

  /** Custom surface colour. */
  @Prop({ type: String, match: HEX_PATTERN })
  color?: string;

  /** Custom border colour for surfaces. */
  @Prop({ type: String, match: HEX_PATTERN })
  borderColor?: string;

  /** Border thickness in px (0–4). */
  @Prop({ type: Number, default: 1, min: 0, max: 4 })
  borderWidth: number;

  /** Surface opacity percentage (0–100). */
  @Prop({ type: Number, default: 5, min: 0, max: 100 })
  opacity: number;

  /** Corner radius in px (0–48). */
  @Prop({ type: Number, default: 22, min: 0, max: 48 })
  radius: number;
}
export const AppearanceSurfaceSchema =
  SchemaFactory.createForClass(AppearanceSurface);

/** Numeric type scale for heading / subheading / body / small text. */
@Schema({ _id: false })
export class AppearanceTypographyScale {
  @Prop({ type: Number, default: 30, min: 16, max: 72 })
  heading: number;

  @Prop({ type: Number, default: 18, min: 12, max: 48 })
  subheading: number;

  @Prop({ type: Number, default: 14, min: 10, max: 32 })
  body: number;

  @Prop({ type: Number, default: 11, min: 8, max: 24 })
  small: number;
}
export const AppearanceTypographyScaleSchema = SchemaFactory.createForClass(
  AppearanceTypographyScale,
);

/** Button geometry. `style` is the shape preset, `radius` the explicit override. */
@Schema({ _id: false })
export class AppearanceButton {
  @Prop({ type: String, default: 'rounded', enum: BUTTON_SHAPES })
  style: ButtonShape;

  /** Explicit corner radius in px. 0 = square, 999 = pill. */
  @Prop({ type: Number, default: 14, min: 0, max: 999 })
  radius: number;

  @Prop({ type: String, default: 'md', enum: BUTTON_HEIGHTS })
  height: ButtonHeight;
}
export const AppearanceButtonSchema =
  SchemaFactory.createForClass(AppearanceButton);

/** The profile canvas: overall width, rhythm and content area. */
@Schema({ _id: false })
export class AppearanceCanvas {
  @Prop({ type: String, default: 'standard', enum: CANVAS_WIDTHS })
  width: CanvasWidth;

  /** Outer padding in px (0–96). */
  @Prop({ type: Number, default: 24, min: 0, max: 96 })
  padding: number;

  /** Vertical rhythm between sections in px (8–96). */
  @Prop({ type: Number, default: 40, min: 8, max: 96 })
  spacing: number;

  /** Max content width in px (320–1600). 0 = fluid. */
  @Prop({ type: Number, default: 680, min: 0, max: 1600 })
  contentWidth: number;

  @Prop({ type: String, default: 'center', enum: CANVAS_ALIGNMENTS })
  align: CanvasAlignment;

  /** Custom canvas background colour. */
  @Prop({ type: String, match: HEX_PATTERN })
  background?: string;
}
export const AppearanceCanvasSchema =
  SchemaFactory.createForClass(AppearanceCanvas);

/* ─── Root appearance document ─────────────────────────────────────────── */

/**
 * Structured, validated appearance configuration for a profile.
 *
 * The five flat fields (`accent`, `background`, `typography`, `buttonStyle`,
 * `layout`) are kept for backwards compatibility with documents written before
 * the structured sections existed. The nested sections hold the granular
 * controls the appearance editor exposes.
 */
@Schema({ _id: false })
export class AppearanceConfig {
  @Prop({ type: String, default: 'signal', enum: THEME_ACCENTS })
  accent: ThemeAccent;

  @Prop({ type: String, default: 'aurora', enum: BACKGROUND_STYLES })
  background: BackgroundStyle;

  @Prop({ type: String, default: 'default', enum: TYPOGRAPHY_SCALES })
  typography: TypographyScale;

  @Prop({ type: String, default: 'rounded', enum: BUTTON_SHAPES })
  buttonStyle: ButtonShape;

  @Prop({ type: String, default: 'centered', enum: PROFILE_LAYOUTS })
  layout: ProfileLayout;

  @Prop({ type: AppearanceColorsSchema, default: () => ({}) })
  colors: AppearanceColors;

  @Prop({ type: AppearanceSurfaceSchema, default: () => ({}) })
  surface: AppearanceSurface;

  @Prop({ type: AppearanceTypographyScaleSchema, default: () => ({}) })
  typographyScale: AppearanceTypographyScale;

  @Prop({ type: AppearanceButtonSchema, default: () => ({}) })
  button: AppearanceButton;

  @Prop({ type: AppearanceCanvasSchema, default: () => ({}) })
  canvas: AppearanceCanvas;

  /** Ordered list of public component types for the public profile. */
  @Prop({ type: [String], default: [] })
  layoutOrder: string[];
}
export const AppearanceConfigSchema =
  SchemaFactory.createForClass(AppearanceConfig);

/* ─── Defaults + merge helpers ─────────────────────────────────────────── */

/** A complete appearance config with every field populated. */
export function defaultAppearance(): AppearanceConfig {
  return {
    accent: 'signal',
    background: 'aurora',
    typography: 'default',
    buttonStyle: 'rounded',
    layout: 'centered',
    colors: {},
    surface: {
      style: 'glass',
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
      style: 'rounded',
      radius: 14,
      height: 'md',
    },
    canvas: {
      width: 'standard',
      padding: 24,
      spacing: 40,
      contentWidth: 680,
      align: 'center',
    },
    layoutOrder: [],
  };
}

type PlainObject = Record<string, unknown>;

/** A partial appearance update; `null` clears an optional override. */
export type AppearanceInput = {
  [K in keyof AppearanceConfig]?: AppearanceConfig[K] extends unknown[]
    ? AppearanceConfig[K]
    : AppearanceConfig[K] extends object
      ? { [P in keyof AppearanceConfig[K]]?: AppearanceConfig[K][P] | null }
      : AppearanceConfig[K];
};

const SECTION_KEYS = [
  'colors',
  'surface',
  'typographyScale',
  'button',
  'canvas',
] as const;

const SCALAR_KEYS = [
  'accent',
  'background',
  'typography',
  'buttonStyle',
  'layout',
] as const;

/**
 * Turns anything object-like into a plain key/value record.
 *
 * The value may be a Mongoose sub-document (stored config), a validated DTO
 * instance (incoming patch) or a plain object. Sub-documents are unwrapped
 * with `toObject()`; without that their internal bookkeeping keys would be
 * read instead of the stored values. `undefined` entries are dropped so an
 * unset DTO property never overwrites a stored value.
 */
function toRecord(value: unknown): PlainObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const source =
    typeof (value as { toObject?: unknown }).toObject === 'function'
      ? (value as { toObject: () => unknown }).toObject()
      : value;

  const out: PlainObject = {};
  for (const [key, entry] of Object.entries(source as PlainObject)) {
    if (entry !== undefined) out[key] = entry;
  }
  return out;
}

/**
 * Deep-merges a (possibly partial) appearance patch onto the stored config
 * and the defaults. Nested sections are merged key by key; the component
 * order array is replaced wholesale. A `null` value clears an optional
 * override (for example a custom colour) or restores a required field's
 * default.
 */
export function mergeAppearance(
  base?: unknown,
  patch?: unknown,
): AppearanceConfig {
  const defaults = defaultAppearance() as unknown as PlainObject;
  const baseObj = toRecord(base);
  const patchObj = toRecord(patch);

  const merged: PlainObject = {};

  for (const key of SCALAR_KEYS) {
    const patched = patchObj[key];
    merged[key] =
      patched !== undefined && patched !== null
        ? patched
        : (baseObj[key] ?? defaults[key]);
  }

  for (const key of SECTION_KEYS) {
    const sectionDefaults = toRecord(defaults[key]);
    const section: PlainObject = {
      ...sectionDefaults,
      ...toRecord(baseObj[key]),
    };

    for (const [field, value] of Object.entries(toRecord(patchObj[key]))) {
      if (value === null) {
        if (field in sectionDefaults) section[field] = sectionDefaults[field];
        else delete section[field];
      } else {
        section[field] = value;
      }
    }

    // Stored documents may carry explicit nulls for cleared overrides.
    for (const field of Object.keys(section)) {
      if (section[field] === null) delete section[field];
    }

    merged[key] = section;
  }

  const order = Array.isArray(patchObj.layoutOrder)
    ? patchObj.layoutOrder
    : Array.isArray(baseObj.layoutOrder)
      ? baseObj.layoutOrder
      : [];
  merged.layoutOrder = order.filter(
    (entry): entry is string => typeof entry === 'string',
  );

  return merged as unknown as AppearanceConfig;
}

/** Resolves the effective appearance for a (possibly legacy) stored document. */
export function resolveAppearance(stored?: unknown): AppearanceConfig {
  return mergeAppearance(stored, undefined);
}
