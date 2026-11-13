import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  GithubTestService,
  type GitHubTestProfileResult,
} from './github-test.service';

/** GitHub logins: 1–39 alphanumerics or single hyphens, not at either end. */
const GITHUB_LOGIN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

function assertLogin(username: unknown): string {
  const login = typeof username === 'string' ? username.trim() : '';
  if (!GITHUB_LOGIN.test(login)) {
    throw new BadRequestException('A valid GitHub username is required');
  }
  return login;
}

/**
 * GitHub Explorer: previews what GitHub exposes publicly for a username.
 *
 * This proxies the public GitHub API with the server's token, so it is
 * tightly rate limited to stop it being used to burn through that quota.
 */
@ApiTags('GitHub Explorer')
@Controller('github-test')
@Throttle({ short: { limit: 15, ttl: 60_000 } })
export class GithubTestController {
  constructor(private readonly githubTestService: GithubTestService) {}

  @Get('profile/:username')
  async getProfileByParam(
    @Param('username') username: string,
  ): Promise<GitHubTestProfileResult> {
    return this.githubTestService.getPublicProfile(assertLogin(username));
  }

  @Get('profile')
  async getProfileByQuery(
    @Query('username') username?: string,
  ): Promise<GitHubTestProfileResult> {
    return this.githubTestService.getPublicProfile(assertLogin(username));
  }
}
