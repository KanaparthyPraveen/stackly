import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  UpdateAppearanceDto,
  WEB_URL_OPTIONS,
} from '../../profile/dto/profile.dto';
import {
  COMPONENT_TYPES,
  type ComponentType,
} from '../../components/schemas/component.schema';
import type { AppearanceConfig } from '../../profile/schemas/appearance.schema';

const isSet = (_: unknown, value: unknown) =>
  value !== undefined && value !== null && value !== '';

export class TemplateComponentDto {
  @IsIn(COMPONENT_TYPES)
  type: ComponentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  order?: number;

  /** Validated against the component registry for `type`. */
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(600)
  previewImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAppearanceDto)
  appearance?: UpdateAppearanceDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => TemplateComponentDto)
  components?: TemplateComponentDto[];
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @ValidateIf(isSet)
  @IsUrl(WEB_URL_OPTIONS)
  @MaxLength(600)
  previewImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAppearanceDto)
  appearance?: UpdateAppearanceDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => TemplateComponentDto)
  components?: TemplateComponentDto[];
}

export class CreateTemplateFromProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];
}

/** What the API returns for a template. The creator's id is never included. */
export class TemplateResponseDto {
  _id: string;
  id: string;
  name: string;
  slug: string;
  description?: string;
  tags: string[];
  previewImageUrl?: string;
  isPublic: boolean;
  isDraft: boolean;
  /** True when the template is discoverable by everyone. */
  published: boolean;
  /** True when the caller created the template. */
  isOwner: boolean;
  appearance: AppearanceConfig;
  components: Array<{
    type: string;
    title: string;
    order: number;
    config: Record<string, unknown>;
  }>;
  clonesCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}
