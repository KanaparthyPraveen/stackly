/** Shared types for the OAuth 2.0 authorization-code flow. */

export type OAuthProviderName = 'github' | 'google';

/** The identity of a user at the OAuth provider, normalised across providers. */
export interface OAuthIdentity {
  /** Stable id issued by the provider (GitHub numeric id, Google `sub`). */
  providerId: string;
  /** Handle/login of the user at the provider — display only, never a key. */
  username?: string;
  displayName?: string;
  email?: string;
  /** Whether the provider vouches for the email address. */
  emailVerified?: boolean;
  avatarUrl?: string;
  profileUrl?: string;
}

export interface OAuthAuthorizeParams {
  /** Signed, single-use CSRF token. */
  state: string;
  /** PKCE S256 challenge derived from the verifier kept in the session. */
  codeChallenge: string;
  /** OpenID Connect nonce — only used by providers that issue ID tokens. */
  nonce: string;
}

export interface OAuthTokens {
  accessToken: string;
  /** OpenID Connect ID token, when the provider issues one. */
  idToken?: string;
}

/** Contract every OAuth provider implementation fulfils. */
export interface OAuthProviderClient {
  readonly name: OAuthProviderName;
  /** Human-readable name used in the UI. */
  readonly label: string;
  /** True when the provider has both client id and client secret configured. */
  isConfigured(): boolean;
  /** Builds the provider authorization URL. */
  buildAuthorizeUrl(params: OAuthAuthorizeParams): string;
  /** Exchanges an authorization code (plus PKCE verifier) for tokens. */
  exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens>;
  /** Verifies the tokens and returns the authenticated user's identity. */
  fetchIdentity(
    tokens: OAuthTokens,
    expectedNonce: string,
  ): Promise<OAuthIdentity>;
}

/** Error codes handed back to the frontend through the login redirect. */
export const OAUTH_ERROR_CODES = {
  NOT_CONFIGURED: 'oauth_not_configured',
  DENIED: 'oauth_denied',
  INVALID_STATE: 'oauth_state_invalid',
  EXCHANGE_FAILED: 'oauth_exchange_failed',
  API_FAILED: 'oauth_api_failed',
  UNKNOWN_PROVIDER: 'oauth_unknown_provider',
  MISSING_CODE: 'oauth_missing_code',
  IDENTITY_IN_USE: 'oauth_identity_in_use',
  LOGIN_REQUIRED: 'oauth_login_required',
} as const;

export type OAuthErrorCode =
  (typeof OAUTH_ERROR_CODES)[keyof typeof OAUTH_ERROR_CODES];
