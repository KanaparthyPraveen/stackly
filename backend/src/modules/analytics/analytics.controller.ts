import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/guards/session-auth.guard';
import { AnalyticsService, AnalyticsRange } from './analytics.service';
import { ProfileService } from '../profile/profile.service';

class TrackViewDto {
  @IsString()
  @MaxLength(40)
  profileUsername: string;

  /** `document.referrer` as seen by the visitor's browser. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string;
}

const RANGES: AnalyticsRange[] = ['7d', '30d', '90d'];

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly profileService: ProfileService,
  ) {}

  /**
   * Public — records a profile view. Link and project clicks are recorded by
   * `POST /links/:id/click` and `POST /projects/:id/click`, which verify the
   * clicked item on the server instead of trusting the client.
   *
   * Always answers 204 so the endpoint reveals nothing about which usernames
   * exist or are published.
   */
  @Post('track')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  async track(@Body() dto: TrackViewDto, @Req() req: Request): Promise<void> {
    const profile = await this.profileService.findPublicByUsername(
      dto.profileUsername,
    );
    if (!profile) return;

    const userAgent = req.headers['user-agent'];
    if (this.analyticsService.isBot(userAgent)) return;

    // Owners looking at their own page are not visitors.
    if (req.session?.userId === profile.userId.toString()) return;

    await this.analyticsService.track({
      profileUserId: profile.userId.toString(),
      eventType: 'profile_view',
      ip: req.ip,
      userAgent,
      referrer: dto.referrer,
    });
  }

  /** Owner only — the report is always for the caller's own profile. */
  @Get()
  @UseGuards(SessionAuthGuard)
  async getReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('range') range?: string,
  ) {
    const validRange = RANGES.includes(range as AnalyticsRange)
      ? (range as AnalyticsRange)
      : '30d';
    return this.analyticsService.getReport(user.id, validRange);
  }
}
