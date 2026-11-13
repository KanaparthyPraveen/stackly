import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description:
      'Current password. Required unless the account has no password yet (created through an OAuth provider).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;

  @ApiProperty({ description: 'New password (min 8 characters)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72, { message: 'Password cannot exceed 72 characters' })
  newPassword!: string;
}
