import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resilientFetch } from '../../../../common/http/resilient-fetch';
import type {
  OAuthAuthorizeParams,
  OAuthIdentity,
  OAuthProviderClient,
  OAuthProviderName,
  OAuthTokens,
} from '../oauth.types';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const VALID_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
}

interface GoogleIdTokenClaims {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  sub?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

/** Decodes the payload segment of a JWT without verifying its signature. */
export function decodeJwtClaims<T>(jwt: string): T {
  const segments = jwt.split('.');
  if (segments.length !== 3) {
    throw new Error('Malformed ID token');
  }
  return JSON.parse(
    Buffer.from(segments[1], 'base64url').toString('utf8'),
  ) as T;
}

/**
 * Google sign-in using OpenID Connect (authorization-code flow with PKCE).
 *
 * The ID token is obtained directly from Google's token endpoint over TLS
 * using the client secret, which per OpenID Connect Core §3.1.3.7 lets TLS
 * server authentication stand in for checking the token signature. Its claims
 * are still validated: issuer, audience, expiry and the nonce bound to this
 * browser session.
 *
 * The `sub` claim is the stable subject identifier and the identity key.
 */
@Injectable()
export class GoogleOAuthProvider implements OAuthProviderClient {
  readonly name: OAuthProviderName = 'google';
  readonly label = 'Google';

  private readonly logger = new Logger(GoogleOAuthProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private get clientId(): string {
    return this.configService.get<string>('google.clientId') ?? '';
  }

  private get clientSecret(): string {
    return this.configService.get<string>('google.clientSecret') ?? '';
  }

  private get callbackUrl(): string {
    return (
      this.configService.get<string>('google.callbackUrl') ??
      `${this.configService.get<string>('backendUrl', 'http://localhost:3001')}/api/v1/auth/google/callback`
    );
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  buildAuthorizeUrl({
    state,
    codeChallenge,
    nonce,
  }: OAuthAuthorizeParams): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
    const response = await resilientFetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.callbackUrl,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    });

    const payload = (await response
      .json()
      .catch(() => ({}))) as GoogleTokenResponse;

    if (!response.ok || !payload.access_token || !payload.id_token) {
      this.logger.error(
        `Google token exchange failed (${response.status}): ${payload.error ?? 'no tokens returned'}`,
      );
      throw new Error(payload.error || 'Google token exchange failed');
    }

    return { accessToken: payload.access_token, idToken: payload.id_token };
  }

  async fetchIdentity(
    tokens: OAuthTokens,
    expectedNonce: string,
  ): Promise<OAuthIdentity> {
    if (!tokens.idToken) {
      throw new Error('Google did not return an ID token');
    }

    const claims = decodeJwtClaims<GoogleIdTokenClaims>(tokens.idToken);

    if (!claims.iss || !VALID_ISSUERS.includes(claims.iss)) {
      throw new Error('ID token has an unexpected issuer');
    }

    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(this.clientId)) {
      throw new Error('ID token was issued for a different client');
    }
    if (audiences.length > 1 && claims.azp !== this.clientId) {
      throw new Error('ID token has an unexpected authorized party');
    }

    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
      throw new Error('ID token has expired');
    }

    if (!claims.nonce || claims.nonce !== expectedNonce) {
      throw new Error('ID token nonce does not match this sign-in request');
    }

    if (!claims.sub) {
      throw new Error('ID token did not include a subject');
    }

    return {
      providerId: String(claims.sub),
      displayName: claims.name,
      email: claims.email,
      emailVerified:
        claims.email_verified === true || claims.email_verified === 'true',
      avatarUrl: claims.picture,
    };
  }
}
