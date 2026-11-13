import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  COMPONENT_TYPES,
  type ComponentType,
} from '../schemas/component.schema';

export class CreateComponentDto {
  @IsIn(COMPONENT_TYPES)
  type: ComponentType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledStart?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledEnd?: Date;

  /** Type-specific settings, validated against the component registry. */
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateComponentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  /** `null` removes the schedule. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledStart?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledEnd?: Date | null;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ReorderComponentsDto {
  /** Component ids in their new display order. */
  @IsArray()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  ids: string[];
}

export class PublicComponentDto {
  id: string;
  type: ComponentType;
  title?: string;
  order: number;
  config: Record<string, unknown>;
}
