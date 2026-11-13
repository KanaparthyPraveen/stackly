import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MEDIA_TYPES,
  MEDIA_VISIBILITIES,
  type MediaType,
  type MediaVisibility,
} from '../schemas/media.schema';

export class SignedUploadDto {
  @ApiProperty({
    enum: MEDIA_TYPES,
    description: 'Category of file being uploaded',
  })
  @IsIn(MEDIA_TYPES)
  type!: MediaType;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  @MaxLength(255)
  filename!: string;

  @ApiProperty({ description: 'File MIME type' })
  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  sizeBytes!: number;

  @ApiProperty({ required: false, description: 'Project the asset belongs to' })
  @IsOptional()
  @IsMongoId()
  projectId?: string;
}

export class UploadQueryDto {
  @IsOptional()
  @IsIn(MEDIA_TYPES)
  type?: MediaType;

  @IsOptional()
  @IsMongoId()
  projectId?: string;
}

export class UpdateMediaDto {
  @ApiProperty({ enum: MEDIA_VISIBILITIES })
  @IsIn(MEDIA_VISIBILITIES)
  visibility!: MediaVisibility;
}
