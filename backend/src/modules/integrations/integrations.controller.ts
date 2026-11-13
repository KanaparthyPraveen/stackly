import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/guards/session-auth.guard';
import { OAuthStateService } from '../../common/oauth/oauth-state.service';
import { IntegrationsService } from './integrations.service';
import { ProfileService } from '../profile/profile.service';
import { ConnectIntegrationDto } from './dto/integration.dto';

function firstString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly profileService: ProfileService,
    private readonly stateService: OAuthStateService,
  ) {}

  @Get('providers')
  @ApiOperation({
    summary: 'Catalogue of supported providers and whether each is configured',
  })
  listProviders() {
    return { providers: this.integrationsService.listProviders() };
  }

  /** Public: integrations shown on a published profile (cached data only). */
  @Get('public/:username')
  async getPublicIntegrations(
    @Param('username') username: string,
    @Req() req: Request,
  ) {
    const profile = await this.profileService.findViewableByUsername(
      username,
      req.session?.userId,
    );
    if (!profile) throw new NotFoundException('Profile not found');
    return this.integrationsService.findPublicForUser(
      profile.userId.toString(),
    );
  }

  @Get('github/content')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Get connected or public GitHub repositories and stats',
  })
  async getGitHubContent(
    @CurrentUser() user: AuthenticatedUser,
    @Query('username') usernameQuery?: string,
  ) {
    let candidate = usernameQuery;
    if (!candidate) {
      const profile = await this.profileService.findByUserId(user.id);
      candidate = profile?.social?.github;
    }
    return this.integrationsService.getGitHubContent(user.id, candidate);
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  async getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.findAllForUser(user.id);
  }

  /**
   * Starts an OAuth connection. The browser navigates here directly; the
   * redirect URI is fixed in server configuration and never taken from the
   * request.
   */
  @Get('oauth/:providerId/start')
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Start connecting an OAuth provider (browser redirect)',
  })
  startOAuth(
    @Param('providerId') providerId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!req.session.userId) {
      return res.redirect(
        this.integrationsService.buildFrontendRedirect({
          error: 'login_required',
        }),
      );
    }

    try {
      return res.redirect(
        this.integrationsService.beginOAuth(req.session, providerId),
      );
    } catch (err) {
      this.logger.warn(
        `Could not start ${providerId} connection: ${(err as Error).message}`,
      );
      return res.redirect(
        this.integrationsService.buildFrontendRedirect({
          error: 'integration_not_available',
          provider: providerId.slice(0, 40),
        }),
      );
    }
  }

  /**
   * OAuth callback for providers with their own redirect URI (Discord,
   * Spotify). GitHub returns to the sign-in callback instead, because a
   * GitHub OAuth app can register only one callback URL.
   */
  @Get('oauth/:providerId/callback')
  @ApiExcludeEndpoint()
  async oauthCallback(
    @Param('providerId') providerId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const provider = providerId.toLowerCase().slice(0, 40);
    const fail = (error: string) =>
      res.redirect(
        this.integrationsService.buildFrontendRedirect({ error, provider }),
      );

    const userId = req.session.userId;
    if (!userId) return fail('login_required');

    if (firstString(req.query.error)) {
      delete req.session.oauthFlow;
      return fail('integration_denied');
    }

    const code = firstString(req.query.code);
    if (!code) {
      delete req.session.oauthFlow;
      return fail('integration_connect_failed');
    }

    let codeVerifier: string;
    try {
      const flow = this.stateService.consume(
        req.session,
        provider,
        firstString(req.query.state) ?? '',
      );
      if (flow.purpose !== 'integration')
        return fail('integration_state_invalid');
      codeVerifier = flow.codeVerifier;
    } catch {
      return fail('integration_state_invalid');
    }

    try {
      await this.integrationsService.completeOAuthConnection(
        userId,
        provider,
        code,
        codeVerifier,
      );
      return res.redirect(
        this.integrationsService.buildFrontendRedirect({ connected: provider }),
      );
    } catch (err) {
      this.logger.warn(
        `${provider} connection failed: ${(err as Error).message}`,
      );
      return fail('integration_connect_failed');
    }
  }

  /** Connect an API-key provider (WakaTime) or link a manual profile. */
  @Post('connect')
  @UseGuards(SessionAuthGuard)
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  async connect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectIntegrationDto,
  ) {
    return this.integrationsService.connect(user.id, dto);
  }

  @Post(':providerId/sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  async sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerId') providerId: string,
  ) {
    return this.integrationsService.sync(user.id, providerId);
  }

  @Delete(':providerId')
  @UseGuards(SessionAuthGuard)
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerId') providerId: string,
  ) {
    return this.integrationsService.disconnect(user.id, providerId);
  }
}
