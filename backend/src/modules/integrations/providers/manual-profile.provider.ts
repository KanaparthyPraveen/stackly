import { BadRequestException } from '@nestjs/common';
import {
  IntegrationProvider,
  ProviderAccount,
} from './integration-provider.interface';

interface ManualProviderOptions {
  id: string;
  name: string;
  /** Accepted username format on the platform. */
  usernamePattern: RegExp;
  /** Builds the public profile URL for a username. */
  profileUrl: (username: string) => string;
}

/**
 * A platform Stackly links to but does not read from.
 *
 * LeetCode, CodeChef and HackerRank do not offer an official public API or
 * OAuth for third-party apps to read a user's statistics. Rather than scrape
 * private endpoints or invent numbers, the user links their public profile
 * by username: Stackly validates the format, stores the link and shows it as
 * an unverified, self-declared profile. No data is fetched or displayed.
 */
export class ManualProfileProvider implements IntegrationProvider {
  readonly id: string;
  readonly name: string;
  readonly kind = 'manual' as const;
  readonly description: string;

  constructor(private readonly options: ManualProviderOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = `Link your public ${options.name} profile. Self-declared — ${options.name} has no official API for verified stats.`;
  }

  isConfigured(): boolean {
    return true;
  }

  resolveManualAccount(input: string): ProviderAccount {
    // Accept a bare username, an "@name" handle or a pasted profile URL.
    const cleaned = String(input ?? '')
      .trim()
      .replace(/^@/, '')
      .replace(/^https?:\/\/[^/]+\/(?:u\/|users\/|profile\/)?/i, '')
      .replace(/\/+$/, '');

    if (!this.options.usernamePattern.test(cleaned)) {
      throw new BadRequestException(
        `"${cleaned || input}" is not a valid ${this.name} username`,
      );
    }

    return {
      handle: `@${cleaned}`,
      profileUrl: this.options.profileUrl(cleaned),
    };
  }
}

export const MANUAL_PROVIDERS: ManualProfileProvider[] = [
  new ManualProfileProvider({
    id: 'leetcode',
    name: 'LeetCode',
    usernamePattern: /^[A-Za-z0-9_-]{1,40}$/,
    profileUrl: (u) => `https://leetcode.com/u/${encodeURIComponent(u)}/`,
  }),
  new ManualProfileProvider({
    id: 'codechef',
    name: 'CodeChef',
    usernamePattern: /^[A-Za-z0-9_]{1,40}$/,
    profileUrl: (u) =>
      `https://www.codechef.com/users/${encodeURIComponent(u)}`,
  }),
  new ManualProfileProvider({
    id: 'hackerrank',
    name: 'HackerRank',
    usernamePattern: /^[A-Za-z0-9_-]{1,40}$/,
    profileUrl: (u) =>
      `https://www.hackerrank.com/profile/${encodeURIComponent(u)}`,
  }),
];
