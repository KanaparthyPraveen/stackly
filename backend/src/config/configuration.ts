export interface AppConfig {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  backendUrl: string;
  /** Express `trust proxy` setting — number of proxy hops in front of the API. */
  trustProxy: number;
  mongodb: {
    uri: string;
  };
  session: {
    secret: string;
    cookieName: string;
    maxAgeMs: number;
  };
  github: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    token: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  discord: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  spotify: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  wakatime: {
    baseUrl: string;
  };
  r2: {
    accountId: string;
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  encryption: {
    key: string;
  };
  throttle: {
    /** Requests per minute per client for endpoints without a tighter limit. */
    limit: number;
  };
  jobs: {
    enabled: boolean;
    /** How often a connected integration is re-synchronised. */
    integrationSyncIntervalMs: number;
  };
}

const DEFAULT_BACKEND_URL = 'http://localhost:3001';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export default (): AppConfig => {
  const backendUrl = trimTrailingSlash(
    process.env.BACKEND_URL || DEFAULT_BACKEND_URL,
  );
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv,
    frontendUrl: trimTrailingSlash(
      process.env.FRONTEND_URL || 'http://localhost:3000',
    ),
    backendUrl,
    trustProxy: parseInt(process.env.TRUST_PROXY || '0', 10) || 0,
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/stackly',
    },
    session: {
      secret:
        process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
      cookieName: process.env.SESSION_COOKIE_NAME || 'stackly.sid',
      maxAgeMs: parseInt(process.env.SESSION_MAX_AGE_MS || '86400000', 10),
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackUrl:
        process.env.GITHUB_CALLBACK_URL ||
        `${backendUrl}/api/v1/auth/github/callback`,
      token: process.env.GITHUB_TOKEN || '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ||
        `${backendUrl}/api/v1/auth/google/callback`,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      callbackUrl:
        process.env.DISCORD_CALLBACK_URL ||
        `${backendUrl}/api/v1/integrations/oauth/discord/callback`,
    },
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
      callbackUrl:
        process.env.SPOTIFY_CALLBACK_URL ||
        `${backendUrl}/api/v1/integrations/oauth/spotify/callback`,
    },
    wakatime: {
      baseUrl: trimTrailingSlash(
        process.env.WAKATIME_API_BASE_URL || 'https://wakatime.com/api/v1',
      ),
    },
    r2: {
      accountId: process.env.R2_ACCOUNT_ID || '',
      // The generic OBJECT_STORAGE_* names are accepted as a fallback so any
      // S3-compatible bucket can be used in place of R2.
      endpoint:
        process.env.R2_ENDPOINT ||
        process.env.OBJECT_STORAGE_ENDPOINT ||
        (process.env.R2_ACCOUNT_ID
          ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
          : ''),
      region:
        process.env.R2_REGION || process.env.OBJECT_STORAGE_REGION || 'auto',
      bucket:
        process.env.R2_BUCKET_NAME ||
        process.env.OBJECT_STORAGE_BUCKET ||
        'stackly',
      accessKeyId:
        process.env.R2_ACCESS_KEY_ID ||
        process.env.OBJECT_STORAGE_ACCESS_KEY ||
        '',
      secretAccessKey:
        process.env.R2_SECRET_ACCESS_KEY ||
        process.env.OBJECT_STORAGE_SECRET_KEY ||
        '',
    },
    encryption: {
      key: process.env.ENCRYPTION_KEY || '',
    },
    throttle: {
      limit: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '120', 10) || 120,
    },
    jobs: {
      enabled:
        nodeEnv !== 'test' && process.env.BACKGROUND_JOBS_ENABLED !== 'false',
      integrationSyncIntervalMs: parseInt(
        process.env.INTEGRATION_SYNC_INTERVAL_MS || String(30 * 60 * 1000),
        10,
      ),
    },
  };
};
