import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resilientFetch } from '../../../common/http/resilient-fetch';
import {
  IntegrationProvider,
  OAuthAuthorizeRequest,
  ProviderAccount,
  TokenSet,
  providerRequest,
  readTokenResponse,
} from './integration-provider.interface';

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const API = 'https://api.github.com';

interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string;
  html_url?: string;
  public_repos?: number;
  followers?: number;
  following?: number;
}

interface GitHubRepo {
  name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  fork: boolean;
  private: boolean;
  pushed_at?: string;
}

/**
 * GitHub as a profile integration (separate from "Sign in with GitHub").
 *
 * Uses the documented OAuth web flow and REST API. Only `read:user` is
 * requested: the integration shows public profile data and public
 * repositories, so it never asks for access to private code.
 */
@Injectable()
export class GitHubProvider implements IntegrationProvider {
  readonly id = 'github';
  readonly name = 'GitHub';
  readonly kind = 'oauth' as const;
  readonly description =
    'Public profile, followers and recently pushed public repositories.';

  constructor(private readonly configService: ConfigService) {}

  private get clientId(): string {
    return this.configService.get<string>('github.clientId') ?? '';
  }

  private get clientSecret(): string {
    return this.configService.get<string>('github.clientSecret') ?? '';
  }

  /**
   * A GitHub OAuth app has exactly one callback URL, so the integration
   * shares the sign-in callback; the flow's purpose travels in the state.
   */
  private get redirectUri(): string {
    return this.configService.get<string>('github.callbackUrl') ?? '';
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Stackly-Integrations',
    };
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  buildAuthorizeUrl({ state, codeChallenge }: OAuthAuthorizeRequest): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read:user',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  private async tokenRequest(body: Record<string, string>): Promise<TokenSet> {
    const response = await resilientFetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        ...body,
      }).toString(),
    });
    return readTokenResponse(response, 'GitHub');
  }

  exchangeCode(code: string, codeVerifier: string): Promise<TokenSet> {
    return this.tokenRequest({
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });
  }

  /** Only used when the OAuth app has expiring user tokens enabled. */
  refreshTokens(refreshToken: string): Promise<TokenSet> {
    return this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  /** Revokes just this token — not the user's whole grant, which sign-in shares. */
  async revokeToken(accessToken: string): Promise<void> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    await resilientFetch(`${API}/applications/${this.clientId}/token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Stackly-Integrations',
      },
      body: JSON.stringify({ access_token: accessToken }),
    });
  }

  async fetchAccount(accessToken: string): Promise<ProviderAccount> {
    const { body } = await providerRequest<GitHubUser>(`${API}/user`, {
      headers: this.headers(accessToken),
    });
    if (!body?.id || !body.login) {
      throw new Error('GitHub did not return a user');
    }
    return {
      externalId: String(body.id),
      handle: `@${body.login}`,
      profileUrl: body.html_url,
      avatarUrl: body.avatar_url,
    };
  }

  async fetchData(accessToken: string): Promise<Record<string, unknown>> {
    const headers = this.headers(accessToken);
    const [user, repos] = await Promise.all([
      providerRequest<GitHubUser>(`${API}/user`, { headers }),
      providerRequest<GitHubRepo[]>(
        `${API}/user/repos?visibility=public&affiliation=owner&sort=pushed&per_page=30`,
        { headers },
      ),
    ]);

    // Belt and braces: never surface a private repository.
    const publicRepos = (repos.body ?? []).filter((r) => !r.private && !r.fork);

    const languages = new Map<string, number>();
    for (const repo of publicRepos) {
      if (repo.language) {
        languages.set(repo.language, (languages.get(repo.language) ?? 0) + 1);
      }
    }

    return {
      login: user.body?.login,
      name: user.body?.name ?? undefined,
      publicRepos: user.body?.public_repos ?? 0,
      followers: user.body?.followers ?? 0,
      following: user.body?.following ?? 0,
      totalStars: publicRepos.reduce((sum, r) => sum + r.stargazers_count, 0),
      topLanguages: [...languages.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, repos]) => ({ name, repos })),
      repos: publicRepos.slice(0, 6).map((r) => ({
        name: r.name,
        url: r.html_url,
        description: r.description ?? undefined,
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language ?? undefined,
        pushedAt: r.pushed_at,
      })),
    };
  }
}
