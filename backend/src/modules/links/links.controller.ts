import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/guards/session-auth.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { LinksService } from './links.service';
import { ProfileService } from '../profile/profile.service';
import { CreateLinkDto, ReorderLinksDto, UpdateLinkDto } from './dto/link.dto';

@ApiTags('Links')
@Controller('links')
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly profileService: ProfileService,
  ) {}

  /** Public: the visible links of a published profile. */
  @Get('public/:username')
  async getPublicLinks(
    @Param('username') username: string,
    @Req() req: Request,
  ) {
    const profile = await this.profileService.findViewableByUsername(
      username,
      req.session?.userId,
    );
    if (!profile) throw new NotFoundException('Profile not found');
    return this.linksService.findPublicForUser(profile.userId.toString());
  }

  /** Public: record a click on a link shown on a published profile. */
  @Post(':id/click')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  async recordClick(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    const referer = req.headers.referer;
    return this.linksService.recordClick(id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: typeof referer === 'string' ? referer : undefined,
      viewerUserId: req.session?.userId,
    });
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  async getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.linksService.findAllForUser(user.id);
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLinkDto,
  ) {
    return this.linksService.create(user.id, dto);
  }

  @Put('reorder')
  @UseGuards(SessionAuthGuard)
  async reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderLinksDto,
  ) {
    await this.linksService.reorder(user.id, dto.ids);
    return { success: true };
  }

  @Patch(':id')
  @UseGuards(SessionAuthGuard)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateLinkDto,
  ) {
    return this.linksService.update(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(SessionAuthGuard)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    await this.linksService.delete(user.id, id);
    return { success: true };
  }
}
