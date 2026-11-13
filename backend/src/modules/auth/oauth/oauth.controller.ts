import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  INVALID_STATE,
  OAuthStateService,
  type OAuthPurpose,
  type PendingOAuthFlow,
} from '../../../common/oauth/oauth-state.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { SessionService } from '../session/session.service';
import { OAuthService } from './oauth.service';
import {
  OAUTH_ERROR_CODES,
  type OAuthErrorCode,
  type OAuthIdentity,
  type OAuthProviderName,
  type OAuthTokens,
} from './oauth.types';

function firstString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

@ApiTags('Authentication')
@Controller('auth')
@Throttle({ short: { limit: 30, ttl: 60_000 } })
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly stateService: OAuthStateService,
    private readonly sessionService: SessionService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Lists the sign-in providers and whether they are configured. The frontend
   * uses this to decide which buttons to show.
   */
  @Get('oauth/providers')
  @ApiOperation({
    summary: 'List available OAuth providers and their configuration state',
  })
  listProviders() {
    return { providers: this.oauthService.listAvailableProviders() };
  }

  /* ─── GitHub ────────────────────────────────────────────────────────── */

  @Get('github')
  @ApiOperation({
    summary:
      'Start the GitHub authorization-code flow. `?mode=link` attaches GitHub to the signed-in account.',
  })
  async githubStart(
    @Req() req: Request,
    @Res() res: Response,
    @Query('mode') mode?: string,
  ) {
    return this.start('github', req, res, mode);
  }

  @Get('github/callback')
  @ApiExcludeEndpoint()
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    return this.callback('github', req, res);
  }

  /* ─── Google ────────────────────────────────────────────────────────── */

  @Get('google')
  @ApiOperation({
    summary:
      'Start the Google OpenID Connect flow. `?mode=link` attaches Google to the signed-in account.',
  })
  async googleStart(
    @Req() req: Request,
    @Res() res: Response,
    @Query('mode') mode?: string,
  ) {
    return this.start('google', req, res, mode);
  }

  @Get('google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.callback('google', req, res);
  }

  /* ─── Shared flow ───────────────────────────────────────────────────── */

  private start(
    provider: OAuthProviderName,
    req: Request,
    res: Response,
    mode?: string,
  ): void {
    const purpose: OAuthPurpose = mode === 'link' ? 'link' : 'login';
    const client = this.oauthService.getProvider(provider);

    if (purpose === 'link' && !req.session.userId) {
      return res.redirect(
        this.oauthService.buildErrorRedirect(OAUTH_ERROR_CODES.LOGIN_REQUIRED),
      );
    }

    if (!client.isConfigured()) {
      return res.redirect(
        this.oauthService.buildErrorRedirect(
          OAUTH_ERROR_CODES.NOT_CONFIGURED,
          purpose === 'link' ? '/dashboard/settings' : '/login',
        ),
      );
    }

    const { state, codeChallenge, oidcNonce } = this.stateService.begin(
      req.session,
      provider,
      purpose,
    );

    return res.redirect(
      client.buildAuthorizeUrl({ state, codeChallenge, nonce: oidcNonce }),
    );
  }

  private async callback(
    provider: OAuthProviderName,
    req: Request,
    res: Response,
  ): Promise<void> {
    // The purpose decides where errors are reported. It is read before the
    // pending flow is consumed, and only from the server-side session.
    const purpose = this.stateService.peekPurpose(req.session) ?? 'login';
    const errorPath =
      purpose === 'integration'
        ? '/dashboard/integrations'
        : purpose === 'link'
          ? '/dashboard/settings'
          : '/login';
    const fail = (code: OAuthErrorCode) =>
      res.redirect(this.oauthService.buildErrorRedirect(code, errorPath));

    try {
      const code = firstString(req.query.code);
      const state = firstString(req.query.state) ?? '';

      // The user declined the authorization request.
      if (firstString(req.query.error)) {
        delete req.session.oauthFlow;
        return fail(OAUTH_ERROR_CODES.DENIED);
      }
      if (!code) {
        delete req.session.oauthFlow;
        return fail(OAUTH_ERROR_CODES.MISSING_CODE);
      }

      // CSRF protection: the state must be signed, unexpired, issued for this
      // provider and carry the nonce stored in this browser's session. The
      // pending flow is single-use.
      const flow = this.stateService.consume(req.session, provider, state);

      // GitHub OAuth apps allow a single callback URL, so connecting GitHub
      // as a profile integration returns here too.
      if (flow.purpose === 'integration') {
        return await this.completeIntegration(provider, flow, code, req, res);
      }

      const client = this.oauthService.getProvider(provider);
      if (!client.isConfigured()) {
        return fail(OAUTH_ERROR_CODES.NOT_CONFIGURED);
      }

      let identity: OAuthIdentity;
      let tokens: OAuthTokens | undefined;
      try {
        tokens = await client.exchangeCode(code, flow.codeVerifier);
        try {
          identity = await client.fetchIdentity(tokens, flow.oidcNonce);
        } catch (err) {
          this.logger.error(
            `OAuth identity verification failed for ${provider}: ${(err as Error).message}`,
          );
          return fail(OAUTH_ERROR_CODES.API_FAILED);
        }
      } catch (err) {
        this.logger.error(
          `OAuth code exchange failed for ${provider}: ${(err as Error).message}`,
        );
        return fail(OAUTH_ERROR_CODES.EXCHANGE_FAILED);
      }

      if (flow.purpose === 'link') {
        const userId = req.session.userId;
        if (!userId) return fail(OAUTH_ERROR_CODES.LOGIN_REQUIRED);
        await this.oauthService.linkToAccount(userId, provider, identity);
        return res.redirect(this.oauthService.buildLinkedRedirect(provider));
      }

      const user = await this.oauthService.resolveAccount(provider, identity);
      const profile = await this.oauthService.ensureProfile(user);
      await this.sessionService.establish(req, user._id.toString());

      if (provider === 'github' && tokens?.accessToken) {
        await this.integrationsService
          .connectWithToken(user._id.toString(), 'github', tokens)
          .catch((err) => {
            this.logger.warn(
              `Auto-sync GitHub integration failed: ${(err as Error).message}`,
            );
          });
      }

      const isClaimed = Boolean(
        profile?.usernameClaimed && !profile?.username.startsWith('user_'),
      );
      return res.redirect(this.oauthService.buildSuccessRedirect(isClaimed));
    } catch (err) {
      const code = this.toErrorCode(err);
      this.logger.warn(`OAuth callback rejected for ${provider}: ${code}`);
      return fail(code);
    }
  }

  private async completeIntegration(
    provider: OAuthProviderName,
    flow: PendingOAuthFlow,
    code: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect(
        this.oauthService.buildErrorRedirect(OAUTH_ERROR_CODES.LOGIN_REQUIRED),
      );
    }

    try {
      await this.integrationsService.completeOAuthConnection(
        userId,
        provider,
        code,
        flow.codeVerifier,
      );
      return res.redirect(
        this.integrationsService.buildFrontendRedirect({ connected: provider }),
      );
    } catch (err) {
      this.logger.warn(
        `Integration connection failed for ${provider}: ${(err as Error).message}`,
      );
      return res.redirect(
        this.integrationsService.buildFrontendRedirect({
          error: 'integration_connect_failed',
          provider,
        }),
      );
    }
  }

  private toErrorCode(err: unknown): OAuthErrorCode {
    const message = err instanceof Error ? err.message : '';
    const known = Object.values(OAUTH_ERROR_CODES) as string[];
    if (message && known.includes(message)) {
      return message as OAuthErrorCode;
    }
    if (message === INVALID_STATE) return OAUTH_ERROR_CODES.INVALID_STATE;
    return OAUTH_ERROR_CODES.INVALID_STATE;
  }
}
