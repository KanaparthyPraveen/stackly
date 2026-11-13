import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export const DEV_SESSION_SECRET = 'dev-session-secret-change-in-production';

/** Minimum length for secrets that protect sessions and stored credentials. */
const MIN_SECRET_LENGTH = 32;

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3001;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  BACKEND_URL: string = 'http://localhost:3001';

  @IsNumber()
  @Min(0)
  @IsOptional()
  TRUST_PROXY?: number;

  @IsString()
  @IsOptional()
  MONGODB_URI: string = 'mongodb://localhost:27017/stackly';

  @IsString()
  @IsOptional()
  SESSION_SECRET: string = DEV_SESSION_SECRET;

  @IsString()
  @IsOptional()
  SESSION_COOKIE_NAME: string = 'stackly.sid';

  @IsNumber()
  @IsOptional()
  SESSION_MAX_AGE_MS: number = 86400000;

  @IsString()
  @IsOptional()
  GITHUB_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GITHUB_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GITHUB_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  GITHUB_TOKEN?: string;

  @IsString()
  @IsOptional()
  DISCORD_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  DISCORD_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  DISCORD_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  SPOTIFY_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  SPOTIFY_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  SPOTIFY_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  WAKATIME_API_BASE_URL?: string;

  @IsString()
  @IsOptional()
  OBJECT_STORAGE_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  OBJECT_STORAGE_REGION?: string;

  @IsString()
  @IsOptional()
  OBJECT_STORAGE_BUCKET?: string;

  @IsString()
  @IsOptional()
  OBJECT_STORAGE_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  OBJECT_STORAGE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  OBJECT_STORAGE_PUBLIC_URL?: string;

  @IsString()
  @IsOptional()
  R2_ACCOUNT_ID?: string;

  @IsString()
  @IsOptional()
  R2_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  R2_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  R2_BUCKET_NAME?: string;

  @IsString()
  @IsOptional()
  R2_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  R2_REGION?: string;

  @IsString()
  @IsOptional()
  ENCRYPTION_KEY?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  RATE_LIMIT_PER_MINUTE?: number;

  @IsIn(['true', 'false'])
  @IsOptional()
  BACKGROUND_JOBS_ENABLED?: string;

  @IsNumber()
  @Min(60_000)
  @IsOptional()
  INTEGRATION_SYNC_INTERVAL_MS?: number;
}

/**
 * Checks that only make sense once the app is exposed to real users.
 * Development keeps working with zero configuration; production refuses to
 * boot with guessable secrets.
 */
function productionErrors(config: EnvironmentVariables): string[] {
  if (config.NODE_ENV !== Environment.Production) return [];

  const errors: string[] = [];

  if (
    config.SESSION_SECRET === DEV_SESSION_SECRET ||
    config.SESSION_SECRET.length < MIN_SECRET_LENGTH
  ) {
    errors.push(
      `SESSION_SECRET must be a unique random value of at least ${MIN_SECRET_LENGTH} characters in production`,
    );
  }

  if (
    !config.ENCRYPTION_KEY ||
    config.ENCRYPTION_KEY.length < MIN_SECRET_LENGTH
  ) {
    errors.push(
      `ENCRYPTION_KEY must be set to a random value of at least ${MIN_SECRET_LENGTH} characters in production`,
    );
  }

  return errors;
}

export function validate(config: Record<string, unknown>) {
  // Empty strings (`FOO=` in a .env file) mean "not set".
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value !== '') cleaned[key] = value;
  }

  const validatedConfig = plainToInstance(EnvironmentVariables, cleaned, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation error: ${errors.toString()}`);
  }

  const prodErrors = productionErrors(validatedConfig);
  if (prodErrors.length > 0) {
    throw new Error(`Environment validation error: ${prodErrors.join('; ')}`);
  }

  return validatedConfig;
}
