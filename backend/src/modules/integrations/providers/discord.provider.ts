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

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const API = 'https://discord.com/api/v10';

interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
  global_name?: string | null;
  avatar?: string | null;
}

/**
 * Discord via the documented OAuth2 authorization-code flow.
 *
 * Only the `identify` scope is requested, which exposes the username and
 * avatar — no email, guilds or messages. Access tokens last about a week and
 * are renewed with the refresh token.
 */
@Injectable()
export class DiscordProvider implements IntegrationProvider {
  readonly id = 'discord';
  readonly name = 'Discord';
  readonly kind = 'oauth' as const;
  readonly description = 'Verified Discord username and avatar.';

  constructor(private readonly configService: ConfigService) {}

  private get clientId(): string {
    return this.configService.get<string>('discord.clientId') ?? '';
  }

  private get clientSecret(): string {
    return this.configService.get<string>('discord.clientSecret') ?? '';
  }

  private get redirectUri(): string {
    return this.configService.get<string>('discord.callbackUrl') ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  buildAuthorizeUrl({ state, codeChallenge }: OAuthAuthorizeRequest): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'consent',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  private async tokenRequest(body: Record<string, string>): Promise<TokenSet> {
    const response = await resilientFetch(`${API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        ...body,
      }).toString(),
    });
    return readTokenResponse(response, 'Discord');
  }

  exchangeCode(code: string, codeVerifier: string): Promise<TokenSet> {
    return this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });
  }

  refreshTokens(refreshToken: string): Promise<TokenSet> {
    return this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  async revokeToken(accessToken: string): Promise<void> {
    await resilientFetch(`${API}/oauth2/token/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        token: accessToken,
        token_type_hint: 'access_token',
      }).toString(),
    });
  }

  private async me(accessToken: string): Promise<DiscordUser> {
    const { body } = await providerRequest<DiscordUser>(`${API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!body?.id || !body.username) {
      throw new Error('Discord did not return a user');
    }
    return body;
  }

  private avatarUrl(user: DiscordUser): string | undefined {
    return user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : undefined;
  }

  private handle(user: DiscordUser): string {
    return user.discriminator && user.discriminator !== '0'
      ? `@${user.username}#${user.discriminator}`
      : `@${user.username}`;
  }

  async fetchAccount(accessToken: string): Promise<ProviderAccount> {
    const user = await this.me(accessToken);
    return {
      externalId: user.id,
      handle: this.handle(user),
      profileUrl: `https://discord.com/users/${user.id}`,
      avatarUrl: this.avatarUrl(user),
    };
  }

  async fetchData(accessToken: string): Promise<Record<string, unknown>> {
    const user = await this.me(accessToken);
    return {
      username: user.username,
      displayName: user.global_name || user.username,
      avatarUrl: this.avatarUrl(user),
    };
  }
}
