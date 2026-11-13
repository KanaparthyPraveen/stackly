import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/guards/session-auth.guard';
import { ChangelogService } from './changelog.service';

function clampInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed =
    typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

@ApiTags('Changelog')
@Controller('changelog')
@UseGuards(SessionAuthGuard)
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  @Get()
  async getMyChangelog(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.changelogService.findByUser(
      user.id,
      clampInt(limit, 50, 1, 100),
      clampInt(skip, 0, 0, 10_000),
    );
  }
}
