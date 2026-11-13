import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Session, SessionData } from 'express-session';
import { Model, Types } from 'mongoose';
import { TokenEncryption } from '../../common/crypto/crypto.util';
import { resilientFetch } from '../../common/http/resilient-fetch';
import { OAuthStateService } from '../../common/oauth/oauth-state.service';
import { ChangelogService } from '../changelog/changelog.service';
import {
  ConnectIntegrationDto,
  IntegrationResponseDto,
  PublicIntegrationDto,
} from './dto/integration.dto';
import { DiscordProvider } from './providers/discord.provider';
import { GitHubProvider } from './providers/github.provider';
import {
  IntegrationProvider,
  ProviderAccount,
  ProviderAuthError,
  ProviderRateLimitError,
  TokenSet,
} from './providers/integration-provider.interface';
import { MANUAL_PROVIDERS } from './providers/manual-profile.provider';
import { SpotifyProvider } from './providers/spotify.provider';
import { WakaTimeProvider } from './providers/wakatime.provider';
import { Integration, IntegrationDocument } from './schemas/integration.schema';

/** Refresh an access token this long before it actually expires. */
const TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000;
/** How long one sync may hold its lease before another worker may take over. */
const SYNC_LEASE_MS = 2 * 60 * 1000;
/** Minimum gap between two on-demand syncs of the same integration. */
const MANUAL_SYNC_COOLDOWN_MS = 60 * 1000;
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  kind: string;
  description: string;
  /** False when the server lacks the credentials to offer this provider. */
  configured: boolean;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly providers: Map<string, IntegrationProvider>;

  constructor(
    @InjectModel(Integration.name)
    private readonly integrationModel: Model<IntegrationDocument>,
    private readonly changelog: ChangelogService,
    private readonly configService: ConfigService,
    private readonly stateService: OAuthStateService,
    githubProvider: GitHubProvider,
    discordProvider: DiscordProvider,
    spotifyProvider: SpotifyProvider,
    wakatimeProvider: WakaTimeProvider,
  ) {
    // Adding a provider means implementing IntegrationProvider and listing it
    // here; the lifecycle below is shared by all of them.
    const all: IntegrationProvider[] = [
      githubProvider,
      discordProvider,
      spotifyProvider,
      wakatimeProvider,
      ...MANUAL_PROVIDERS,
    ];
    this.providers = new Map(all.map((p) => [p.id, p]));
  }

  /* ─── Provider registry ─────────────────────────────────────────────── */

  listProviders(): ProviderCatalogEntry[] {
    return [...this.providers.values()].map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      description: p.description,
      configured: p.isConfigured(),
    }));
  }

  private getProvider(providerId: string): IntegrationProvider {
    const provider = this.providers.get(String(providerId).toLowerCase());
    if (!provider) {
      throw new NotFoundException(`Unknown integration "${providerId}"`);
    }
    return provider;
  }

  /* ─── Credentials at rest ───────────────────────────────────────────── */

  private get encryptionKey(): string | undefined {
    return this.configService.get<string>('encryption.key') || undefined;
  }

  private encrypt(value: string): string {
    return TokenEncryption.encrypt(value, this.encryptionKey);
  }

  private decrypt(value: string): string {
    return TokenEncryption.decrypt(value, this.encryptionKey);
  }

  private storeTokens(
    integration: IntegrationDocument,
    tokens: TokenSet,
  ): void {
    integration.accessToken = this.encrypt(tokens.accessToken);
    // Providers that rotate refresh tokens return a new one; providers that
    // do not keep the existing one valid, so it is only replaced when present.
    if (tokens.refreshToken) {
      integration.refreshToken = this.encrypt(tokens.refreshToken);
    }
    integration.tokenExpiresAt = tokens.expiresAt;
    if (tokens.scopes) integration.scopes = tokens.scopes;
  }

  private clearCredentials(integration: IntegrationDocument): void {
    integration.accessToken = undefined;
    integration.refreshToken = undefined;
    integration.tokenExpiresAt = undefined;
    integration.scopes = undefined;
  }

  /* ─── Response shaping ──────────────────────────────────────────────── */

  private isVerified(
    integration: IntegrationDocument,
    provider?: IntegrationProvider,
  ): boolean {
    const kind = integration.kind ?? provider?.kind;
    return kind === 'oauth' || kind === 'api_key';
  }

  /** Owner view. Built field by field so a credential can never slip in. */
  toDto(integration: IntegrationDocument): IntegrationResponseDto {
    const provider = this.providers.get(integration.integrationId);
    const timestamps = integration as IntegrationDocument & {
      updatedAt?: Date;
    };
    return {
      _id: integration._id.toString(),
      integrationId: integration.integrationId,
      name: provider?.name ?? integration.name,
      kind: integration.kind ?? provider?.kind ?? 'manual',
      status: integration.status,
      handle: integration.handle,
      profileUrl: integration.profileUrl,
      avatarUrl: integration.avatarUrl,
      verified: this.isVerified(integration, provider),
      data: integration.data ?? {},
      syncStatus: integration.syncStatus ?? 'idle',
      lastSyncedAt: integration.lastSyncedAt,
      lastSyncError: integration.lastSyncError,
      connectedAt: integration.connectedAt,
      updatedAt: timestamps.updatedAt,
    };
  }

  async findAllForUser(userId: string): Promise<IntegrationResponseDto[]> {
    const integrations = await this.integrationModel
      .find({ userId: new Types.ObjectId(userId) })
      .exec();
    return integrations.map((i) => this.toDto(i));
  }

  /**
   * What visitors see. Served entirely from the cache in MongoDB — a public
   * profile view never triggers a call to a provider.
   */
  async findPublicForUser(userId: string): Promise<PublicIntegrationDto[]> {
    const integrations = await this.integrationModel
      .find({ userId: new Types.ObjectId(userId), status: 'connected' })
      .exec();

    return integrations
      .filter((i) => this.providers.has(i.integrationId))
      .map((i) => {
        const provider = this.providers.get(i.integrationId);
        return {
          integrationId: i.integrationId,
          name: provider?.name ?? i.name,
          status: 'connected' as const,
          handle: i.handle,
          profileUrl: i.profileUrl,
          avatarUrl: i.avatarUrl,
          verified: this.isVerified(i, provider),
          data: i.data ?? {},
          lastSyncedAt: i.lastSyncedAt,
        };
      });
  }

  /* ─── Connect: OAuth ────────────────────────────────────────────────── */

  /**
   * Step 1 of an OAuth connection. Stores the CSRF nonce and PKCE verifier in
   * the caller's session and returns the provider's authorization URL.
   */
  beginOAuth(
    session: Session & Partial<SessionData>,
    providerId: string,
  ): string {
    const provider = this.getProvider(providerId);
    if (provider.kind !== 'oauth' || !provider.buildAuthorizeUrl) {
      throw new BadRequestException(
        `${provider.name} is not connected through OAuth`,
      );
    }
    if (!provider.isConfigured()) {
      throw new BadRequestException(
        `${provider.name} is not configured on this server`,
      );
    }

    const { state, codeChallenge } = this.stateService.begin(
      session,
      provider.id,
      'integration',
    );
    return provider.buildAuthorizeUrl({ state, codeChallenge });
  }

  /**
   * Step 2 of an OAuth connection, called from the provider callback once the
   * state has been verified: exchanges the code, confirms the account with
   * the provider, stores the encrypted tokens and runs a first sync.
   */
  async completeOAuthConnection(
    userId: string,
    providerId: string,
    code: string,
    codeVerifier: string,
  ): Promise<IntegrationResponseDto> {
    const provider = this.getProvider(providerId);
    if (
      provider.kind !== 'oauth' ||
      !provider.exchangeCode ||
      !provider.fetchAccount
    ) {
      throw new BadRequestException(
        `${provider.name} is not connected through OAuth`,
      );
    }

    const tokens = await provider.exchangeCode(code, codeVerifier);
    const account = await provider.fetchAccount(tokens.accessToken);

    const integration = await this.upsertConnection(userId, provider, account);
    // A reconnect must not keep a refresh token from the previous grant.
    integration.refreshToken = undefined;
    this.storeTokens(integration, tokens);
    await integration.save();

    await this.afterConnect(userId, provider, integration);
    return this.toDto(integration);
  }

  /**
   * Connects or updates an integration using an OAuth token set (e.g. from sign-in).
   */
  async connectWithToken(
    userId: string,
    providerId: string,
    tokens: TokenSet,
  ): Promise<IntegrationResponseDto | null> {
    const provider = this.getProvider(providerId);
    if (!provider || !provider.fetchAccount) return null;
    try {
      const account = await provider.fetchAccount(tokens.accessToken);
      const integration = await this.upsertConnection(
        userId,
        provider,
        account,
      );
      integration.refreshToken = undefined;
      this.storeTokens(integration, tokens);
      await integration.save();
      await this.afterConnect(userId, provider, integration);
      return this.toDto(integration);
    } catch (err) {
      this.logger.warn(
        `Could not attach ${providerId} integration for user ${userId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /* ─── Connect: API key and manual ───────────────────────────────────── */

  async connect(
    userId: string,
    dto: ConnectIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    const provider = this.getProvider(dto.integrationId);

    if (provider.kind === 'oauth') {
      throw new BadRequestException(
        `${provider.name} must be connected through its authorization flow`,
      );
    }

    if (provider.kind === 'api_key') {
      if (!dto.apiKey || !provider.fetchAccount) {
        throw new BadRequestException(
          `An API key is required to connect ${provider.name}`,
        );
      }
      const apiKey = dto.apiKey.trim();

      // The key is validated against the provider before anything is stored.
      let account: ProviderAccount;
      try {
        account = await provider.fetchAccount(apiKey);
      } catch (err) {
        if (err instanceof ProviderAuthError) {
          throw new BadRequestException(
            `${provider.name} rejected that API key`,
          );
        }
        throw this.toHttpError(err, provider);
      }

      const integration = await this.upsertConnection(
        userId,
        provider,
        account,
      );
      this.storeTokens(integration, { accessToken: apiKey });
      await integration.save();

      await this.afterConnect(userId, provider, integration);
      return this.toDto(integration);
    }

    if (!dto.handle || !provider.resolveManualAccount) {
      throw new BadRequestException(
        `A username is required to link ${provider.name}`,
      );
    }

    const account = provider.resolveManualAccount(dto.handle);
    const integration = await this.upsertConnection(userId, provider, account);
    this.clearCredentials(integration);
    integration.syncStatus = 'idle';
    integration.nextSyncAt = undefined;
    await integration.save();

    await this.afterConnect(userId, provider, integration);
    return this.toDto(integration);
  }

  private async upsertConnection(
    userId: string,
    provider: IntegrationProvider,
    account: ProviderAccount,
  ): Promise<IntegrationDocument> {
    const owner = new Types.ObjectId(userId);
    const existing = await this.integrationModel
      .findOne({ userId: owner, integrationId: provider.id })
      .select('+accessToken +refreshToken')
      .exec();

    const integration =
      existing ??
      new this.integrationModel({ userId: owner, integrationId: provider.id });

    integration.name = provider.name;
    integration.kind = provider.kind;
    integration.status = 'connected';
    integration.handle = account.handle;
    integration.externalId = account.externalId;
    integration.profileUrl = account.profileUrl;
    integration.avatarUrl = account.avatarUrl;
    integration.connectedAt = new Date();
    integration.lastSyncError = undefined;
    integration.syncFailures = 0;
    integration.data = {};
    integration.markModified('data');
    return integration;
  }

  private async afterConnect(
    userId: string,
    provider: IntegrationProvider,
    integration: IntegrationDocument,
  ): Promise<void> {
    await this.changelog.record(
      userId,
      'integration.connected',
      `Connected ${provider.name} (${integration.handle ?? 'linked'})`,
      { integrationId: provider.id, handle: integration.handle },
      integration._id.toString(),
    );

    if (provider.fetchData) {
      // The connection already succeeded; a failed first sync is recorded on
      // the integration and retried by the background job.
      await this.runSync(integration._id).catch(() => undefined);
      const fresh = await this.integrationModel
        .findById(integration._id)
        .exec();
      if (fresh) {
        integration.data = fresh.data;
        integration.syncStatus = fresh.syncStatus;
        integration.lastSyncedAt = fresh.lastSyncedAt;
        integration.lastSyncError = fresh.lastSyncError;
      }
    }
  }

  /* ─── Token management ──────────────────────────────────────────────── */

  /**
   * Returns a usable access token, refreshing it first when it is about to
   * expire. A rotated refresh token is persisted before the access token is
   * handed out, so a crash can never strand the integration with a refresh
   * token the provider has already invalidated.
   */
  private async getAccessToken(
    integration: IntegrationDocument,
    provider: IntegrationProvider,
  ): Promise<string> {
    if (!integration.accessToken) {
      throw new ProviderAuthError('No credential stored');
    }

    const expiresAt = integration.tokenExpiresAt?.getTime();
    const needsRefresh =
      expiresAt !== undefined &&
      expiresAt - Date.now() < TOKEN_REFRESH_MARGIN_MS;

    if (!needsRefresh) {
      return this.decrypt(integration.accessToken);
    }

    if (!integration.refreshToken || !provider.refreshTokens) {
      throw new ProviderAuthError(
        'Access token expired and cannot be refreshed',
      );
    }

    const tokens = await provider.refreshTokens(
      this.decrypt(integration.refreshToken),
    );
    this.storeTokens(integration, tokens);
    await integration.save();
    return tokens.accessToken;
  }

  /* ─── Synchronisation ───────────────────────────────────────────────── */

  private syncIntervalMs(): number {
    return this.configService.get<number>(
      'jobs.integrationSyncIntervalMs',
      30 * 60 * 1000,
    );
  }

  /** On-demand sync requested by the owner. */
  async sync(
    userId: string,
    providerId: string,
  ): Promise<IntegrationResponseDto> {
    const provider = this.getProvider(providerId);
    const integration = await this.integrationModel
      .findOne({
        userId: new Types.ObjectId(userId),
        integrationId: provider.id,
      })
      .exec();

    if (!integration || integration.status === 'disconnected') {
      throw new NotFoundException(`${provider.name} is not connected`);
    }
    if (integration.status === 'reauth_required') {
      throw new BadRequestException(
        `${provider.name} needs to be reconnected before it can sync`,
      );
    }
    if (!provider.fetchData) {
      // Manual links have nothing to fetch.
      return this.toDto(integration);
    }

    const last = integration.lastSyncedAt?.getTime() ?? 0;
    if (Date.now() - last < MANUAL_SYNC_COOLDOWN_MS) {
      return this.toDto(integration);
    }

    try {
      await this.runSync(integration._id);
    } catch (err) {
      throw this.toHttpError(err, provider);
    }

    const fresh = await this.integrationModel.findById(integration._id).exec();
    return this.toDto(fresh ?? integration);
  }

  /**
   * Background entry point: syncs integrations whose refresh is due.
   * Safe to run from several instances at once — each integration is leased
   * atomically before it is touched.
   */
  async syncDue(limit = 20): Promise<{ attempted: number; failed: number }> {
    const now = new Date();
    const due = await this.integrationModel
      .find({
        status: 'connected',
        kind: { $in: ['oauth', 'api_key'] },
        $or: [
          { nextSyncAt: { $lte: now } },
          { nextSyncAt: { $exists: false } },
          { nextSyncAt: null },
        ],
      })
      .sort({ nextSyncAt: 1 })
      .limit(limit)
      .select('_id')
      .lean()
      .exec();

    let failed = 0;
    for (const { _id } of due) {
      try {
        await this.runSync(_id);
      } catch {
        failed += 1;
      }
    }
    return { attempted: due.length, failed };
  }

  /**
   * Syncs one integration: lease → token → fetch → normalise → cache.
   * Throws on failure after recording it; the caller decides whether that
   * matters.
   */
  private async runSync(id: Types.ObjectId): Promise<void> {
    const now = new Date();

    // Atomic lease. If another worker holds it, this sync is skipped —
    // running twice would only double the provider calls.
    const integration = await this.integrationModel
      .findOneAndUpdate(
        {
          _id: id,
          status: 'connected',
          $or: [
            { syncLockedUntil: { $exists: false } },
            { syncLockedUntil: null },
            { syncLockedUntil: { $lt: now } },
          ],
        },
        {
          $set: {
            syncLockedUntil: new Date(now.getTime() + SYNC_LEASE_MS),
            syncStatus: 'syncing',
          },
        },
        { new: true },
      )
      .select('+accessToken +refreshToken')
      .exec();

    if (!integration) return;

    const provider = this.providers.get(integration.integrationId);
    if (!provider?.fetchData) {
      integration.syncLockedUntil = undefined;
      integration.syncStatus = 'idle';
      await integration.save();
      return;
    }

    try {
      const accessToken = await this.getAccessToken(integration, provider);
      const data = await provider.fetchData(accessToken);

      integration.data = data;
      integration.markModified('data');
      integration.syncStatus = 'ok';
      integration.lastSyncedAt = new Date();
      integration.lastSyncError = undefined;
      integration.syncFailures = 0;
      integration.nextSyncAt = new Date(Date.now() + this.syncIntervalMs());
      integration.syncLockedUntil = undefined;
      await integration.save();
    } catch (err) {
      await this.recordSyncFailure(integration, provider, err);
      throw err;
    }
  }

  private async recordSyncFailure(
    integration: IntegrationDocument,
    provider: IntegrationProvider,
    err: unknown,
  ): Promise<void> {
    integration.syncLockedUntil = undefined;
    integration.syncStatus = 'error';
    integration.syncFailures = (integration.syncFailures ?? 0) + 1;

    if (err instanceof ProviderAuthError) {
      // The user revoked access (or the credential expired for good). Stop
      // retrying, drop the dead credential and ask them to reconnect. The
      // last good data stays cached so the profile does not go blank.
      integration.status = 'reauth_required';
      integration.lastSyncError =
        'Authorization was revoked or expired. Reconnect to resume.';
      integration.nextSyncAt = undefined;
      this.clearCredentials(integration);
    } else if (err instanceof ProviderRateLimitError) {
      integration.lastSyncError =
        'The provider is rate limiting requests. Will retry later.';
      integration.nextSyncAt = new Date(
        Date.now() + Math.max(err.retryAfterMs, 5 * 60 * 1000),
      );
    } else {
      // Exponential backoff, capped at a day.
      const backoff = Math.min(
        this.syncIntervalMs() * 2 ** Math.min(integration.syncFailures, 6),
        MAX_BACKOFF_MS,
      );
      integration.lastSyncError =
        'Could not reach the provider. Will retry later.';
      integration.nextSyncAt = new Date(Date.now() + backoff);
    }

    await integration.save().catch(() => undefined);
    this.logger.warn(
      `${provider.name} sync failed for integration ${integration._id.toString()}: ${
        err instanceof Error ? err.message : 'unknown error'
      }`,
    );
  }

  /* ─── Disconnect ────────────────────────────────────────────────────── */

  /**
   * Disconnects a provider: revokes the token at the provider where that is
   * supported, then deletes the stored credentials and cached data.
   */
  async disconnect(
    userId: string,
    providerId: string,
  ): Promise<IntegrationResponseDto> {
    const id = String(providerId).toLowerCase();
    const integration = await this.integrationModel
      .findOne({ userId: new Types.ObjectId(userId), integrationId: id })
      .select('+accessToken +refreshToken')
      .exec();

    if (!integration) {
      throw new NotFoundException(
        `Integration "${providerId}" is not connected`,
      );
    }

    const provider = this.providers.get(id);
    if (provider?.revokeToken && integration.accessToken) {
      try {
        await provider.revokeToken(this.decrypt(integration.accessToken));
      } catch (err) {
        // Revocation is best effort; the local credentials are removed anyway.
        this.logger.warn(
          `Could not revoke ${provider.name} token: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.clearCredentials(integration);
    integration.status = 'disconnected';
    integration.data = {};
    integration.metadata = {};
    integration.markModified('data');
    integration.markModified('metadata');
    integration.handle = undefined;
    integration.externalId = undefined;
    integration.profileUrl = undefined;
    integration.avatarUrl = undefined;
    integration.syncStatus = 'idle';
    integration.lastSyncError = undefined;
    integration.nextSyncAt = undefined;
    integration.syncLockedUntil = undefined;
    await integration.save();

    await this.changelog.record(
      userId,
      'integration.disconnected',
      `Disconnected ${provider?.name ?? integration.name}`,
      { integrationId: integration.integrationId },
      integration._id.toString(),
    );

    return this.toDto(integration);
  }

  /* ─── Helpers ───────────────────────────────────────────────────────── */

  /** Redirect target after an OAuth connection — always the configured frontend. */
  buildFrontendRedirect(params: {
    connected?: string;
    error?: string;
    provider?: string;
  }): string {
    const url = new URL(
      '/dashboard/integrations',
      this.configService.get<string>('frontendUrl', 'http://localhost:3000'),
    );
    if (params.connected) url.searchParams.set('connected', params.connected);
    if (params.error) url.searchParams.set('error', params.error);
    if (params.provider) url.searchParams.set('provider', params.provider);
    return url.toString();
  }

  /** Maps a provider failure onto an HTTP error without leaking internals. */
  private toHttpError(
    err: unknown,
    provider: IntegrationProvider,
  ): HttpException {
    if (err instanceof HttpException) return err;
    if (err instanceof ProviderAuthError) {
      return new BadRequestException(
        `${provider.name} needs to be reconnected before it can sync`,
      );
    }
    if (err instanceof ProviderRateLimitError) {
      return new HttpException(
        `${provider.name} is rate limiting requests. Try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return new HttpException(
      `Could not reach ${provider.name}. Try again later.`,
      HttpStatus.BAD_GATEWAY,
    );
  }

  async getGitHubContent(userId: string, usernameQuery?: string) {
    // 1. Look for connected integration
    const integration = await this.integrationModel
      .findOne({
        userId: new Types.ObjectId(userId),
        integrationId: 'github',
        status: 'connected',
      })
      .exec();

    if (integration) {
      let data = (integration.data ?? {}) as Record<string, unknown>;
      let repos = (data.repos ?? []) as Array<{
        name: string;
        url: string;
        description?: string;
        stars: number;
        forks: number;
        language?: string;
        pushedAt?: string;
      }>;

      // If repos is empty and we have an access token, run a quick sync
      if (repos.length === 0 && integration.accessToken) {
        try {
          const synced = await this.sync(userId, 'github');
          data = (synced.data ?? {}) as Record<string, unknown>;
          repos = (data.repos ?? []) as typeof repos;
        } catch (e) {
          this.logger.warn(
            `Failed to sync GitHub on demand: ${(e as Error).message}`,
          );
        }
      }

      return {
        connected: true,
        handle: integration.handle,
        profileUrl: integration.profileUrl,
        avatarUrl: integration.avatarUrl,
        repos,
        stats: {
          totalStars: Number(data.totalStars ?? 0),
          followers: Number(data.followers ?? 0),
          publicRepos: Number(data.publicRepos ?? repos.length),
          following: Number(data.following ?? 0),
          topLanguages: (data.topLanguages ?? []) as Array<{
            name: string;
            repos: number;
          }>,
        },
      };
    }

    // 2. If not connected via OAuth, but username is supplied (or found in profile)
    const rawHandle = usernameQuery?.trim();
    if (rawHandle) {
      const clean = rawHandle
        .replace(/^@/, '')
        .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
        .replace(/\/+$/, '')
        .split('/')[0];

      if (clean && /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i.test(clean)) {
        try {
          const headers: Record<string, string> = {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Stackly-Integrations',
          };
          const githubToken = this.configService.get<string>('github.token');
          if (githubToken) {
            headers.Authorization = `Bearer ${githubToken}`;
          }

          const [userRes, reposRes] = await Promise.all([
            resilientFetch(
              `https://api.github.com/users/${encodeURIComponent(clean)}`,
              {
                headers,
                timeoutMs: 4000,
              },
            ),
            resilientFetch(
              `https://api.github.com/users/${encodeURIComponent(clean)}/repos?visibility=public&sort=pushed&per_page=30`,
              { headers, timeoutMs: 5000 },
            ),
          ]);

          if (userRes.ok && reposRes.ok) {
            const userData = (await userRes.json()) as Record<string, any>;
            const reposData = (await reposRes.json()) as Array<any>;

            const publicRepos = (reposData ?? []).filter(
              (r) => !r.private && !r.fork,
            );
            const languages = new Map<string, number>();
            for (const repo of publicRepos) {
              if (repo.language) {
                languages.set(
                  repo.language,
                  (languages.get(repo.language) ?? 0) + 1,
                );
              }
            }

            const repos = publicRepos.slice(0, 12).map((r) => ({
              name: r.name,
              url: r.html_url,
              description: r.description ?? undefined,
              stars: r.stargazers_count ?? 0,
              forks: r.forks_count ?? 0,
              language: r.language ?? undefined,
              pushedAt: r.pushed_at,
            }));

            return {
              connected: false,
              handle: `@${clean}`,
              avatarUrl: userData.avatar_url,
              profileUrl: userData.html_url,
              repos,
              stats: {
                totalStars: publicRepos.reduce(
                  (sum, r) => sum + (r.stargazers_count ?? 0),
                  0,
                ),
                followers: userData.followers ?? 0,
                publicRepos: userData.public_repos ?? repos.length,
                following: userData.following ?? 0,
                topLanguages: [...languages.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([name, count]) => ({ name, repos: count })),
              },
            };
          }
        } catch (err) {
          this.logger.warn(
            `Public GitHub fetch failed for ${clean}: ${(err as Error).message}`,
          );
        }
      }
    }

    return {
      connected: false,
      repos: [],
      stats: {
        totalStars: 0,
        followers: 0,
        publicRepos: 0,
      },
    };
  }
}
