import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const PROVIDER_ID = /^[a-z0-9_-]{2,40}$/;

/**
 * Connects a provider that does not use OAuth.
 * - API-key providers (WakaTime) need `apiKey`.
 * - Manual providers (LeetCode, CodeChef, HackerRank) need `handle`.
 */
export class ConnectIntegrationDto {
  @IsString()
  @Matches(PROVIDER_ID, { message: 'integrationId is not a valid provider id' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  integrationId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  handle?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  apiKey?: string;
}

/** What the owner sees for one of their integrations. Never contains credentials. */
export class IntegrationResponseDto {
  _id: string;
  integrationId: string;
  name: string;
  kind: string;
  status: string;
  handle?: string;
  profileUrl?: string;
  avatarUrl?: string;
  /** True when the provider itself confirmed the account (OAuth or API key). */
  verified: boolean;
  data: Record<string, unknown>;
  syncStatus: string;
  lastSyncedAt?: Date;
  lastSyncError?: string;
  connectedAt?: Date;
  updatedAt?: Date;
}

/** What a visitor sees for a connected integration on a public profile. */
export class PublicIntegrationDto {
  integrationId: string;
  name: string;
  status: 'connected';
  handle?: string;
  profileUrl?: string;
  avatarUrl?: string;
  verified: boolean;
  data: Record<string, unknown>;
  lastSyncedAt?: Date;
}
