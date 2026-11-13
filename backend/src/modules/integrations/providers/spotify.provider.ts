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

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

interface SpotifyUser {
  id: string;
  display_name?: string | null;
  images?: Array<{ url: string }>;
  external_urls?: { spotify?: string };
}

interface SpotifyTrack {
  name: string;
  artists: Array<{ name: string }>;
  album?: { images?: Array<{ url: string }> };
  external_urls?: { spotify?: string };
}

interface CurrentlyPlaying {
  is_playing?: boolean;
  item?: SpotifyTrack | null;
}

/**
 * Spotify via the documented Authorization Code flow (with PKCE) and Web API.
 *
 * Access tokens live for one hour, so every sync goes through the refresh
 * token. Spotify offers no token revocation endpoint; disconnecting deletes
 * the stored tokens.
 */
@Injectable()
export class SpotifyProvider implements IntegrationProvider {
  readonly id = 'spotify';
  readonly name = 'Spotify';
  readonly kind = 'oauth' as const;
  readonly description = 'Currently playing track and your top tracks.';

  constructor(private readonly configService: ConfigService) {}

  private get clientId(): string {
    return this.configService.get<string>('spotify.clientId') ?? '';
  }

  private get clientSecret(): string {
    return this.configService.get<string>('spotify.clientSecret') ?? '';
  }

  private get redirectUri(): string {
    return this.configService.get<string>('spotify.callbackUrl') ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  buildAuthorizeUrl({ state, codeChallenge }: OAuthAuthorizeRequest): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: 'user-read-private user-top-read user-read-currently-playing',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  private async tokenRequest(body: Record<string, string>): Promise<TokenSet> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    const response = await resilientFetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body).toString(),
    });
    return readTokenResponse(response, 'Spotify');
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

  private auth(accessToken: string): Record<string, string> {
    return { Authorization: `Bearer ${accessToken}` };
  }

  private toTrack(track: SpotifyTrack) {
    return {
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      albumArt: track.album?.images?.[0]?.url,
      url: track.external_urls?.spotify,
    };
  }

  async fetchAccount(accessToken: string): Promise<ProviderAccount> {
    const { body } = await providerRequest<SpotifyUser>(`${API}/me`, {
      headers: this.auth(accessToken),
    });
    if (!body?.id) {
      throw new Error('Spotify did not return a user');
    }
    return {
      externalId: body.id,
      handle: `@${body.display_name || body.id}`,
      profileUrl: body.external_urls?.spotify,
      avatarUrl: body.images?.[0]?.url,
    };
  }

  async fetchData(accessToken: string): Promise<Record<string, unknown>> {
    const headers = this.auth(accessToken);

    // 204 means nothing is playing right now.
    const [current, top] = await Promise.all([
      providerRequest<CurrentlyPlaying>(`${API}/me/player/currently-playing`, {
        headers,
      }),
      providerRequest<{ items?: SpotifyTrack[] }>(
        `${API}/me/top/tracks?limit=5&time_range=short_term`,
        { headers },
      ),
    ]);

    const item = current.body?.item;

    return {
      currentlyPlaying: item
        ? {
            isPlaying: current.body?.is_playing === true,
            ...this.toTrack(item),
          }
        : null,
      topTracks: (top.body?.items ?? []).map((t) => this.toTrack(t)),
    };
  }
}
