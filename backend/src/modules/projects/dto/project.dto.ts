import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { WEB_URL_OPTIONS } from '../../profile/dto/profile.dto';

export const PROJECT_STATUSES = ['live', 'beta', 'wip', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const normalizeUrl = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `https://${trimmed}`;
};

/** An empty string clears an optional URL, so URL rules are skipped for it. */
const isSet = (_: unknown, value: unknown) =>
  value !== undefined && value !== null && value !== '';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tech?: string[];

  @Transform(normalizeUrl)
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(2000)
  repoUrl?: string;

  @Transform(normalizeUrl)
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(2000)
  liveUrl?: string;

  @Transform(normalizeUrl)
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(2000)
  docsUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl(WEB_URL_OPTIONS, { each: true })
  @MaxLength(2000, { each: true })
  images?: string[];

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tech?: string[];

  @Transform(normalizeUrl)
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(2000)
  repoUrl?: string;

  @Transform(normalizeUrl)
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(2000)
  liveUrl?: string;

  @Transform(normalizeUrl)
  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(2000)
  docsUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl(WEB_URL_OPTIONS, { each: true })
  @MaxLength(2000, { each: true })
  images?: string[];

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

export class ReorderProjectsDto {
  /** Project ids in their new display order. */
  @IsArray()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  ids: string[];
}

export class SetFeaturedDto {
  @IsBoolean()
  featured: boolean;
}

export class PublicProjectDto {
  id: string;
  name: string;
  description?: string;
  tech: string[];
  repoUrl?: string;
  liveUrl?: string;
  docsUrl?: string;
  images: string[];
  status: string;
  featured: boolean;
  stars: number;
  forks: number;
}
