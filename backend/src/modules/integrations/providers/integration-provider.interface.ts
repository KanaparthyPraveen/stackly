import {
  ProviderRateLimitError,
  resilientFetch,
  type ResilientFetchOptions,
} from '../../../common/http/resilient-fetch';

/**
 * How a provider is connected:
 * - `oauth`    — the user authorises Stackly at the provider (authorization-code flow).
 * - `api_key`  — the user supplies a personal API key issued by the provider.
 * - `manual`   — the provider has no official API for this; the user links
 *                their public profile by username and nothing is fetched.
 */
export type IntegrationKind = 'oauth' | 'api_key' | 'manual';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string[];
}

/** The account at the provider, normalised across providers. */
export interface ProviderAccount {
  /** Stable id issued by the provider, when it has one. */
  externalId?: string;
  /** Display handle, e.g. "@octocat". */
  handle: string;
  profileUrl?: string;
  avatarUrl?: string;
}

export interface OAuthAuthorizeRequest {
  state: string;
  codeChallenge: string;
}

export interface IntegrationProvider {
  readonly id: string;
  readonly name: string;
  readonly kind: IntegrationKind;
  /** One-line explanation shown next to the provider in the catalogue. */
  readonly description: string;

  /** True when the server has what it needs to offer this provider. */
  isConfigured(): boolean;

  /* ── OAuth providers ──────────────────────────────────────────────── */
  buildAuthorizeUrl?(request: OAuthAuthorizeRequest): string;
  exchangeCode?(code: string, codeVerifier: string): Promise<TokenSet>;
  /** Exchanges a refresh token for a new token set (may rotate the refresh token). */
  refreshTokens?(refreshToken: string): Promise<TokenSet>;
  /** Best-effort revocation of the token at the provider on disconnect. */
  revokeToken?(accessToken: string): Promise<void>;

  /* ── OAuth and API-key providers ──────────────────────────────────── */
  /** Validates the credential and identifies the account it belongs to. */
  fetchAccount?(accessToken: string): Promise<ProviderAccount>;
  /** Fetches and normalises the data shown on the profile. */
  fetchData?(accessToken: string): Promise<Record<string, unknown>>;

  /* ── Manual providers ─────────────────────────────────────────────── */
  /** Validates a username and builds the public profile link for it. */
  resolveManualAccount?(input: string): ProviderAccount;
}

/** The provider no longer accepts the stored credential (revoked or expired). */
export class ProviderAuthError extends Error {
  constructor(message = 'Provider authorization is no longer valid') {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

export { ProviderRateLimitError };

/**
 * JSON request to a provider API with timeout and retries.
 * A 401 becomes a {@link ProviderAuthError} so the caller can mark the
 * integration as needing re-authorisation.
 */
export async function providerRequest<T>(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<{ status: number; body: T | null }> {
  const response = await resilientFetch(url, options);

  if (response.status === 401) {
    throw new ProviderAuthError();
  }
  if (response.status === 204) {
    return { status: 204, body: null };
  }
  if (!response.ok) {
    throw new Error(`${new URL(url).host} responded with ${response.status}`);
  }

  const body = (await response.json().catch(() => null)) as T | null;
  return { status: response.status, body };
}

/** Parses an OAuth token endpoint response into a {@link TokenSet}. */
export async function readTokenResponse(
  response: Response,
  providerName: string,
): Promise<TokenSet> {
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };

  if (response.status === 400 || response.status === 401) {
    // `invalid_grant` on refresh means the user revoked access.
    if (payload.error === 'invalid_grant') throw new ProviderAuthError();
  }

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `${providerName} token request failed: ${payload.error ?? response.status}`,
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt:
      typeof payload.expires_in === 'number' && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000)
        : undefined,
    scopes: payload.scope
      ? payload.scope.split(/[\s,]+/).filter(Boolean)
      : undefined,
  };
}
