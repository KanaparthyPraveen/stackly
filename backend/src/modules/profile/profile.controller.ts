import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/guards/session-auth.guard';
import { ProfileService } from './profile.service';
import {
  ClaimUsernameDto,
  CreateProfileDto,
  UpdateAppearanceDto,
  UpdateProfileDto,
} from './dto/profile.dto';

@ApiTags('Profile')
@Controller(['profile', 'profiles'])
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /* ─── Owner endpoints ────────────────────────────────────────────────
   * Declared before the `:username` public route so that "me" is never
   * swallowed by the parameterised public lookup.
   */

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const existing = await this.profileService.findByUserId(user.id);
    if (existing) return existing;
    return this.profileService.ensureProfile(user.id);
  }

  @Post('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary:
      'Create the authenticated user profile, or claim a username for it',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProfileDto,
  ) {
    return this.profileService.getOrCreate(user.id, dto);
  }

  @Post(['me/claim-username', 'claim-username'])
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Claim a custom username for the authenticated user',
  })
  async claimUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClaimUsernameDto,
  ) {
    return this.profileService.claimUsername(
      user.id,
      dto.username,
      dto.displayName,
    );
  }

  @Patch('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.update(user.id, dto);
  }

  @Post('me/publish')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Publish the profile so visitors can see it' })
  async publish(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.update(user.id, { live: true });
  }

  @Post('me/unpublish')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Take the profile offline without deleting anything',
  })
  async unpublish(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.update(user.id, { live: false });
  }

  @Get('me/appearance')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Get the appearance configuration of the current profile',
  })
  @ApiResponse({
    status: 200,
    description: 'Fully resolved appearance configuration',
  })
  async getMyAppearance(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getAppearance(user.id);
  }

  @Patch('me/appearance')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Update the appearance configuration of the current profile',
  })
  @ApiResponse({ status: 200, description: 'Updated appearance configuration' })
  async updateAppearance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAppearanceDto,
  ) {
    return this.profileService.updateAppearance(user.id, dto);
  }

  /**
   * Appearance configuration for a specific profile. The identifier may be the
   * profile id or its username — either way the caller must own the profile.
   */
  @Get(':profileId/appearance')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Get appearance settings for a profile owned by the caller',
  })
  @ApiResponse({
    status: 200,
    description: 'Fully resolved appearance configuration',
  })
  async getAppearance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('profileId') profileId: string,
  ) {
    const profile = await this.resolveOwnedProfile(user.id, profileId);
    return this.profileService.toPublicDto(profile).appearance;
  }

  @Patch(':profileId/appearance')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Update appearance settings for a profile owned by the caller',
  })
  @ApiResponse({ status: 200, description: 'Updated appearance configuration' })
  async updateAppearanceById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateAppearanceDto,
  ) {
    await this.resolveOwnedProfile(user.id, profileId);
    return this.profileService.updateAppearance(user.id, dto);
  }

  /* ─── Public endpoints ─────────────────────────────────────────────── */

  @Get('availability/:username')
  @ApiOperation({ summary: 'Check whether a username is available' })
  async checkAvailability(@Param('username') username: string) {
    return this.profileService.checkAvailability(username);
  }

  @Get('public/:username')
  @ApiOperation({ summary: 'Public profile lookup by username' })
  async getPublicByPath(
    @Param('username') username: string,
    @Req() req: Request,
  ) {
    return this.lookup(username, req);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Public profile lookup by username (shorthand)' })
  async getPublic(@Param('username') username: string, @Req() req: Request) {
    return this.lookup(username, req);
  }

  /**
   * Returns the sanitized profile, or `null` when it is missing, unpublished
   * or ghosted. A signed-in owner still gets their own profile back so they
   * can preview it before publishing; the DTO is the same allow-list either
   * way.
   */
  private async lookup(username: string, req?: Request) {
    const profile = await this.profileService.findViewableByUsername(
      username,
      req?.session?.userId,
    );
    if (!profile) return null;
    return this.profileService.toPublicDto(profile);
  }

  /**
   * Resolves a profile by id or username and asserts the caller owns it.
   * Profiles that do not exist return 404; profiles owned by somebody else
   * return 403 only when the caller has no profile of their own to confuse
   * it with.
   */
  private async resolveOwnedProfile(userId: string, profileId: string) {
    const byUser = await this.profileService.findByUserId(userId);
    if (byUser && byUser._id.toString() === profileId) return byUser;

    const byUsername = await this.profileService.findByUsername(profileId);
    if (byUsername && byUsername.userId.toString() === userId)
      return byUsername;

    if (byUser) {
      // The caller does own a profile, but it is not the one addressed.
      throw new NotFoundException('Profile not found');
    }

    if (byUsername) throw new ForbiddenException('You do not own this profile');

    throw new NotFoundException('Profile not found');
  }
}
