import {
  IsString,
  IsOptional,
  IsUrl,
  IsBoolean,
  IsInt,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  IsIn,
  Matches,
  ArrayMaxSize,
  IsArray,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  BACKGROUND_STYLES,
  BUTTON_HEIGHTS,
  BUTTON_SHAPES,
  CANVAS_ALIGNMENTS,
  CANVAS_WIDTHS,
  PROFILE_LAYOUTS,
  SURFACE_STYLES,
  THEME_ACCENTS,
  TYPOGRAPHY_SCALES,
} from '../schemas/appearance.schema';

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Only http(s) links are ever stored. Without the protocol restriction a
 * `javascript:` URL could be saved and later rendered as a clickable link on
 * a public profile.
 */
export const WEB_URL_OPTIONS = {
  require_protocol: true,
  protocols: ['http', 'https'],
  // Local development serves media from http://localhost.
  require_tld: false,
};

/** An empty string means "clear this field", so URL rules are skipped for it. */
const isSet = (_: unknown, value: unknown) =>
  value !== undefined && value !== null && value !== '';

const normalizeUsername = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase().trim() : value;

const normalizeUrl = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `https://${trimmed}`;
};

const normalizeSocial =
  (
    platform: 'github' | 'x' | 'linkedin' | 'discord' | 'youtube' | 'instagram',
  ) =>
  ({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    let trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('@')) trimmed = trimmed.slice(1);
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    switch (platform) {
      case 'github':
        if (/^github\.com\//i.test(trimmed)) return `https://${trimmed}`;
        return `https://github.com/${trimmed}`;
      case 'x':
        if (/^(x|twitter)\.com\//i.test(trimmed)) return `https://${trimmed}`;
        return `https://x.com/${trimmed}`;
      case 'linkedin':
        if (/^linkedin\.com\//i.test(trimmed)) return `https://${trimmed}`;
        if (/^in\//i.test(trimmed)) return `https://linkedin.com/${trimmed}`;
        return `https://linkedin.com/in/${trimmed}`;
      case 'discord':
        if (/^discord\.(gg|com)\//i.test(trimmed)) return `https://${trimmed}`;
        return `https://discord.gg/${trimmed}`;
      case 'youtube':
        if (/^youtube\.com\//i.test(trimmed)) return `https://${trimmed}`;
        return `https://youtube.com/@${trimmed}`;
      case 'instagram':
        if (/^instagram\.com\//i.test(trimmed)) return `https://${trimmed}`;
        return `https://instagram.com/${trimmed}`;
      default:
        return `https://${trimmed}`;
    }
  };

const normalizeHexOrNull = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed.startsWith('#')
      ? trimmed.toUpperCase()
      : `#${trimmed.toUpperCase()}`;
  }
  return value;
};

const normalizeInt = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return Math.round(parsed);
  }
  return value;
};

const normalizeOpacity = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    if (value > 0 && value <= 1) return Math.round(value * 100);
    return Math.round(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      if (parsed > 0 && parsed <= 1) return Math.round(parsed * 100);
      return Math.round(parsed);
    }
  }
  return value;
};

export class UpdateSocialDto {
  @Transform(normalizeSocial('github'))
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(300)
  github?: string;

  @Transform(normalizeSocial('x'))
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(300)
  x?: string;

  @Transform(normalizeSocial('linkedin'))
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(300)
  linkedin?: string;

  @Transform(normalizeSocial('discord'))
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(300)
  discord?: string;

  @Transform(normalizeSocial('youtube'))
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(300)
  youtube?: string;

  @Transform(normalizeSocial('instagram'))
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(300)
  instagram?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(normalizeUsername)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @Transform(normalizeUrl)
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(600)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  location?: string;

  @Transform(normalizeUrl)
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsBoolean()
  live?: boolean;

  @IsOptional()
  @IsBoolean()
  usernameClaimed?: boolean;

  @IsOptional()
  @IsBoolean()
  ghostMode?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSocialDto)
  social?: UpdateSocialDto;
}

export class ClaimUsernameDto {
  @IsString()
  @MaxLength(30)
  @Transform(normalizeUsername)
  username: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;
}

/* ─── Appearance DTOs ───────────────────────────────────────────────────── */

export class UpdateAppearanceColorsDto {
  @Transform(normalizeHexOrNull)
  @ValidateIf(isSet)
  @IsString()
  @Matches(HEX_REGEX, {
    message: 'colors.primary must be a #RRGGBB hex colour',
  })
  primary?: string;

  @Transform(normalizeHexOrNull)
  @ValidateIf(isSet)
  @IsString()
  @Matches(HEX_REGEX, {
    message: 'colors.secondary must be a #RRGGBB hex colour',
  })
  secondary?: string;

  @Transform(normalizeHexOrNull)
  @ValidateIf(isSet)
  @IsString()
  @Matches(HEX_REGEX, {
    message: 'colors.background must be a #RRGGBB hex colour',
  })
  background?: string;

  @Transform(normalizeHexOrNull)
  @ValidateIf(isSet)
  @IsString()
  @Matches(HEX_REGEX, { message: 'colors.text must be a #RRGGBB hex colour' })
  text?: string;
}

export class UpdateAppearanceSurfaceDto {
  @IsOptional() @IsIn(SURFACE_STYLES) style?: string;

  @Transform(normalizeHexOrNull)
  @ValidateIf(isSet)
  @IsString()
  @Matches(HEX_REGEX, { message: 'surface.color must be a #RRGGBB hex colour' })
  color?: string;

  @Transform(normalizeHexOrNull)
  @ValidateIf(isSet)
  @IsString()
  @Matches(HEX_REGEX, {
    message: 'surface.borderColor must be a #RRGGBB hex colour',
  })
  borderColor?: string;

  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  borderWidth?: number;

  @Transform(normalizeOpacity)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  opacity?: number;

  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(48)
  radius?: number;
}

export class UpdateAppearanceTypographyScaleDto {
  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(16)
  @Max(72)
  heading?: number;

  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(12)
  @Max(48)
  subheading?: number;

  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(32)
  body?: number;

  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(24)
  small?: number;
}

export class UpdateAppearanceButtonDto {
  @IsOptional() @IsIn(BUTTON_SHAPES) style?: string;

  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  radius?: number;

  @IsOptional() @IsIn(BUTTON_HEIGHTS) height?: string;
}

export class UpdateAppearanceCanvasDto {
  @IsOptional() @IsIn(CANVAS_WIDTHS) width?: string;

  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(96)
  padding?: number;

  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(96)
  spacing?: number;

  @Transform(normalizeInt)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1600)
  contentWidth?: number;

  @IsOptional() @IsIn(CANVAS_ALIGNMENTS) align?: string;

  @Transform(normalizeHexOrNull)
  @ValidateIf(isSet)
  @IsString()
  @Matches(HEX_REGEX, {
    message: 'canvas.background must be a #RRGGBB hex colour',
  })
  background?: string;
}

export class UpdateAppearanceDto {
  @IsOptional()
  @IsString()
  @IsIn(THEME_ACCENTS)
  accent?: string;

  @IsOptional()
  @IsString()
  @IsIn(BACKGROUND_STYLES)
  background?: string;

  @IsOptional()
  @IsString()
  @IsIn(TYPOGRAPHY_SCALES)
  typography?: string;

  @IsOptional()
  @IsString()
  @IsIn(BUTTON_SHAPES)
  buttonStyle?: string;

  @IsOptional()
  @IsString()
  @IsIn(PROFILE_LAYOUTS)
  layout?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAppearanceColorsDto)
  colors?: UpdateAppearanceColorsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAppearanceSurfaceDto)
  surface?: UpdateAppearanceSurfaceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAppearanceTypographyScaleDto)
  typographyScale?: UpdateAppearanceTypographyScaleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAppearanceButtonDto)
  button?: UpdateAppearanceButtonDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAppearanceCanvasDto)
  canvas?: UpdateAppearanceCanvasDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  layoutOrder?: string[];
}

export class CreateProfileDto {
  @IsString()
  @MaxLength(40)
  @Transform(normalizeUsername)
  username: string;
}

/* ─── Response DTOs ─────────────────────────────────────────────────────── */

export class AppearanceColorsDto {
  primary?: string;
  secondary?: string;
  background?: string;
  text?: string;
}

export class AppearanceSurfaceDto {
  style: string;
  color?: string;
  borderColor?: string;
  borderWidth: number;
  opacity: number;
  radius: number;
}

export class AppearanceTypographyScaleDto {
  heading: number;
  subheading: number;
  body: number;
  small: number;
}

export class AppearanceButtonDto {
  style: string;
  radius: number;
  height: string;
}

export class AppearanceCanvasDto {
  width: string;
  padding: number;
  spacing: number;
  contentWidth: number;
  align: string;
  background?: string;
}

export class AppearanceDto {
  accent: string;
  background: string;
  typography: string;
  buttonStyle: string;
  layout: string;
  colors: AppearanceColorsDto;
  surface: AppearanceSurfaceDto;
  typographyScale: AppearanceTypographyScaleDto;
  button: AppearanceButtonDto;
  canvas: AppearanceCanvasDto;
  layoutOrder: string[];
}

export class PublicProfileDto {
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  live: boolean;
  usernameClaimed?: boolean;
  ghostMode: boolean;
  social: {
    github?: string;
    x?: string;
    linkedin?: string;
    discord?: string;
    youtube?: string;
    instagram?: string;
  };
  appearance: AppearanceDto;
}
