import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntegrationProvider,
  ProviderAccount,
  providerRequest,
} from './integration-provider.interface';

interface WakaTimeUser {
  data?: {
    id?: string;
    username?: string | null;
    display_name?: string | null;
    photo?: string | null;
    profile_url?: string | null;
  };
}

interface WakaTimeStats {
  data?: {
    human_readable_total?: string;
    human_readable_daily_average?: string;
    languages?: Array<{ name: string; percent: number; text: string }>;
    editors?: Array<{ name: string; percent: number; text: string }>;
  };
}

/**
 * WakaTime through its documented API-key authentication
 * (HTTP Basic with the base64-encoded key). The user supplies their own
 * personal key; it is validated against the API before being stored
 * encrypted, and it never expires or refreshes.
 */
@Injectable()
export class WakaTimeProvider implements IntegrationProvider {
  readonly id = 'wakatime';
  readonly name = 'WakaTime';
  readonly kind = 'api_key' as const;
  readonly description =
    'Coding time, languages and editors over the last 7 days.';

  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.configService.get<string>('wakatime.baseUrl') ||
      'https://wakatime.com/api/v1'
    );
  }

  private headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Basic ${Buffer.from(apiKey.trim()).toString('base64')}`,
      'User-Agent': 'Stackly-Integrations',
    };
  }

  /** Needs no server-side credentials — each user brings their own key. */
  isConfigured(): boolean {
    return true;
  }

  async fetchAccount(apiKey: string): Promise<ProviderAccount> {
    const { body } = await providerRequest<WakaTimeUser>(
      `${this.baseUrl}/users/current`,
      { headers: this.headers(apiKey) },
    );
    const user = body?.data;
    if (!user?.id) {
      throw new Error('WakaTime did not return a user');
    }
    const name = user.username || user.display_name || 'wakatime';
    return {
      externalId: user.id,
      handle: `@${name}`,
      profileUrl:
        user.profile_url ??
        (user.username ? `https://wakatime.com/@${user.username}` : undefined),
      avatarUrl: user.photo ?? undefined,
    };
  }

  async fetchData(apiKey: string): Promise<Record<string, unknown>> {
    const { body } = await providerRequest<WakaTimeStats>(
      `${this.baseUrl}/users/current/stats/last_7_days`,
      { headers: this.headers(apiKey) },
    );
    const stats = body?.data ?? {};

    return {
      range: 'last_7_days',
      totalCodingTime: stats.human_readable_total ?? null,
      dailyAverage: stats.human_readable_daily_average ?? null,
      topLanguages: (stats.languages ?? []).slice(0, 5).map((l) => ({
        name: l.name,
        percent: l.percent,
        text: l.text,
      })),
      topEditors: (stats.editors ?? []).slice(0, 3).map((e) => ({
        name: e.name,
        percent: e.percent,
        text: e.text,
      })),
    };
  }
}
