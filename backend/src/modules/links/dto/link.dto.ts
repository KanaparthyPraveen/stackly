import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WEB_URL_OPTIONS } from '../../profile/dto/profile.dto';

export class CreateLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsUrl(WEB_URL_OPTIONS, { message: 'url must be an http(s) URL' })
  @MaxLength(2000)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledStart?: Date;
}

export class UpdateLinkDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsUrl(WEB_URL_OPTIONS, { message: 'url must be an http(s) URL' })
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  /** `null` removes the expiry. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;

  /** `null` removes the schedule. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledStart?: Date | null;
}

export class ReorderLinksDto {
  /** Link ids in their new display order. */
  @IsArray()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  ids: string[];
}

export class PublicLinkDto {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon: string;
  category?: string;
  order: number;
}
