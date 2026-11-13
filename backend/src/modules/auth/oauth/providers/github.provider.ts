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

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const EMAILS_URL = 'https://api.github.com/user/emails';

interface GitHubUserResponse {
  id?: number;
  login?: string;
  name?: string | null;
  avatar_url?: string;
  html_url?: string;
}

interface GitHubEmailResponse {
  email?: string;
  primary?: boolean;
  verified?: boolean;
}

/**
 * GitHub OAuth 2.0 client (authorization-code flow with PKCE).
 *
 * The client secret never leaves the backend, and the provider's numeric user
 * id is the stable external identifier — the login/username is display-only.
 */
@Injectable()
export class GitHubOAuthProvider implements OAuthProviderClient {
  readonly name: OAuthProviderName = 'github';
  readonly label = 'GitHub';

  private readonly logger = new Logger(GitHubOAuthProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private get clientId(): string {
    return this.configService.get<string>('github.clientId') ?? '';
  }

  private get clientSecret(): string {
    return this.configService.get<string>('github.clientSecret') ?? '';
  }

  private get callbackUrl(): string {
    return (
      this.configService.get<string>('github.callbackUrl') ??
      `${this.configService.get<string>('backendUrl', 'http://localhost:3001')}/api/v1/auth/github/callback`
    );
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  buildAuthorizeUrl({ state, codeChallenge }: OAuthAuthorizeParams): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: 'read:user user:email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      allow_signup: 'true',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
    const response = await resilientFetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.callbackUrl,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) {
      this.logger.error(
        `GitHub token exchange failed with status ${response.status}`,
      );
      throw new Error(`GitHub token exchange failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!payload.access_token) {
      // GitHub reports exchange errors with a 200 and an `error` field.
      this.logger.error(
        `GitHub token exchange returned no access token: ${payload.error ?? 'unknown_error'}`,
      );
      throw new Error(payload.error || 'GitHub token exchange failed');
    }

    return { accessToken: payload.access_token };
  }

  async fetchIdentity(tokens: OAuthTokens): Promise<OAuthIdentity> {
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Stackly-OAuth',
    };

    const userResponse = await resilientFetch(USER_URL, { headers });
    if (!userResponse.ok) {
      this.logger.error(
        `GitHub user lookup failed with status ${userResponse.status}`,
      );
      throw new Error(`GitHub user lookup failed (${userResponse.status})`);
    }

    const user = (await userResponse.json()) as GitHubUserResponse;
    if (!user.id) {
      throw new Error('GitHub user response did not include an id');
    }

    // Only the emails endpoint says whether an address is verified, so the
    // public profile email is never trusted for account matching.
    let email: string | undefined;
    let emailVerified = false;

    try {
      const emailsResponse = await resilientFetch(EMAILS_URL, { headers });
      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as GitHubEmailResponse[];
        const primary = Array.isArray(emails)
          ? emails.find((e) => e.primary && e.verified)
          : undefined;
        if (primary?.email) {
          email = primary.email;
          emailVerified = true;
        }
      }
    } catch {
      // A missing email is not fatal — the account gets a placeholder address.
    }

    return {
      providerId: String(user.id),
      username: user.login,
      displayName: user.name ?? user.login ?? undefined,
      email,
      emailVerified,
      avatarUrl: user.avatar_url,
      profileUrl: user.html_url,
    };
  }
}
