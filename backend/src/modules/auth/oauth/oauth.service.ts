import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OAuthStateService,
  type OAuthPurpose,
  type OAuthStatePayload,
} from '../../../common/oauth/oauth-state.service';
import { UsersService, type ExternalIdentity } from '../../users/users.service';
import type { UserDocument } from '../../users/schemas/user.schema';
import { ProfileService } from '../../profile/profile.service';
import type { ProfileDocument } from '../../profile/schemas/profile.schema';
import { SessionService } from '../session/session.service';
import { GitHubOAuthProvider } from './providers/github.provider';
import { GoogleOAuthProvider } from './providers/google.provider';
import {
  OAUTH_ERROR_CODES,
  type OAuthErrorCode,
  type OAuthIdentity,
  type OAuthProviderClient,
  type OAuthProviderName,
} from './oauth.types';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly profileService: ProfileService,
    private readonly configService: ConfigService,
    private readonly stateService: OAuthStateService,
    private readonly sessionService: SessionService,
    private readonly githubProvider: GitHubOAuthProvider,
    private readonly googleProvider: GoogleOAuthProvider,
  ) {}

  private get providers(): Record<OAuthProviderName, OAuthProviderClient> {
    return {
      github: this.githubProvider,
      google: this.googleProvider,
    };
  }

  getProvider(name: string): OAuthProviderClient {
    const provider = Object.prototype.hasOwnProperty.call(this.providers, name)
      ? this.providers[name as OAuthProviderName]
      : undefined;
    if (!provider) {
      throw new BadRequestException(OAUTH_ERROR_CODES.UNKNOWN_PROVIDER);
    }
    return provider;
  }

  /** Lists the sign-in providers and whether each is ready to be used. */
  listAvailableProviders(): Array<{
    name: string;
    label: string;
    configured: boolean;
  }> {
    return Object.values(this.providers).map((p) => ({
      name: p.name,
      label: p.label,
      configured: p.isConfigured(),
    }));
  }

  /* ─── State handling (CSRF protection) ──────────────────────────────── */

  createState(
    provider: OAuthProviderName,
    nonce: string,
    purpose: OAuthPurpose = 'login',
  ): string {
    return this.stateService.createState(provider, nonce, purpose);
  }

  verifyState(
    state: string,
    provider: OAuthProviderName,
    expectedNonce?: string,
  ): OAuthStatePayload {
    return this.stateService.verifyState(state, provider, expectedNonce);
  }

  static generateNonce(): string {
    return OAuthStateService.randomToken(24);
  }

  /* ─── Account resolution ────────────────────────────────────────────── */

  private toExternal(
    provider: OAuthProviderName,
    identity: OAuthIdentity,
  ): ExternalIdentity {
    return {
      provider,
      providerId: identity.providerId,
      username: identity.username,
      displayName: identity.displayName,
      email: identity.email,
      emailVerified: identity.emailVerified,
      avatarUrl: identity.avatarUrl,
    };
  }

  /**
   * Maps an external identity onto a Stackly account for sign-in.
   *
   * 1. An account already linked to this (provider, providerId) wins — this is
   *    what prevents duplicate accounts for one GitHub/Google identity.
   * 2. Otherwise, if the provider vouches for an email address that matches
   *    an existing account, the identity is linked to that account. If that
   *    account's ownership of the address was never proven, its password is
   *    discarded and its sessions revoked first, so whoever registered the
   *    address beforehand cannot keep access.
   * 3. Otherwise a new account is created.
   */
  async resolveAccount(
    provider: OAuthProviderName,
    identity: OAuthIdentity,
  ): Promise<UserDocument> {
    const external = this.toExternal(provider, identity);

    const linked = await this.usersService.findByIdentity(
      provider,
      identity.providerId,
    );
    if (linked) {
      return this.usersService.linkIdentity(linked._id.toString(), external);
    }

    if (identity.email && identity.emailVerified) {
      const byEmail = await this.usersService.findByEmail(identity.email);
      if (byEmail) {
        const userId = byEmail._id.toString();
        const credentialsReset =
          await this.usersService.claimVerifiedEmail(userId);
        if (credentialsReset) {
          await this.sessionService.revokeAll(userId);
          this.logger.warn(
            `Reset unverified credentials on account ${userId} after a verified ${provider} sign-in`,
          );
        }
        return this.usersService.linkIdentity(userId, external);
      }
    }

    return this.usersService.createOAuthUser(external);
  }

  /**
   * Attaches an external identity to the account of the signed-in user.
   * An identity that already belongs to a different account is never moved.
   */
  async linkToAccount(
    userId: string,
    provider: OAuthProviderName,
    identity: OAuthIdentity,
  ): Promise<UserDocument> {
    const owner = await this.usersService.findByIdentity(
      provider,
      identity.providerId,
    );
    if (owner && owner._id.toString() !== userId) {
      throw new ConflictException(OAUTH_ERROR_CODES.IDENTITY_IN_USE);
    }
    return this.usersService.linkIdentity(
      userId,
      this.toExternal(provider, identity),
    );
  }

  /** Makes sure the account has a profile with a usable username. */
  async ensureProfile(user: UserDocument): Promise<ProfileDocument> {
    const preferred =
      user.identities?.find((i) => i.provider === 'github')?.username ??
      user.identities?.find((i) => i.provider === 'google')?.username;

    return this.profileService.ensureProfile(user._id.toString(), preferred, {
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });
  }

  /* ─── Redirects — always to the configured frontend, never user input ── */

  getFrontendUrl(): string {
    return this.configService.get<string>(
      'frontendUrl',
      'http://localhost:3000',
    );
  }

  buildErrorRedirect(code: OAuthErrorCode, path = '/login'): string {
    const url = new URL(path, this.getFrontendUrl());
    url.searchParams.set('error', code);
    return url.toString();
  }

  buildSuccessRedirect(usernameClaimed = true): string {
    const path = usernameClaimed ? '/dashboard' : '/claim-username';
    return new URL(path, this.getFrontendUrl()).toString();
  }

  buildLinkedRedirect(provider: OAuthProviderName): string {
    const url = new URL('/dashboard/settings', this.getFrontendUrl());
    url.searchParams.set('linked', provider);
    return url.toString();
  }
}
