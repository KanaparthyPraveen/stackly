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
import { ProjectsService } from './projects.service';
import { ProfileService } from '../profile/profile.service';
import {
  CreateProjectDto,
  ReorderProjectsDto,
  SetFeaturedDto,
  UpdateProjectDto,
} from './dto/project.dto';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly profileService: ProfileService,
  ) {}

  /** Public: the visible projects of a published profile. */
  @Get('public/:username')
  async getPublicProjects(
    @Param('username') username: string,
    @Req() req: Request,
  ) {
    const profile = await this.profileService.findViewableByUsername(
      username,
      req.session?.userId,
    );
    if (!profile) throw new NotFoundException('Profile not found');
    return this.projectsService.findPublicForUser(profile.userId.toString());
  }

  /** Public: record a click on a project shown on a published profile. */
  @Post(':id/click')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  async recordClick(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    const referer = req.headers.referer;
    return this.projectsService.recordClick(id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: typeof referer === 'string' ? referer : undefined,
      viewerUserId: req.session?.userId,
    });
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  async getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findAllForUser(user.id);
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, dto);
  }

  @Put('reorder')
  @UseGuards(SessionAuthGuard)
  async reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderProjectsDto,
  ) {
    await this.projectsService.reorder(user.id, dto.ids);
    return { success: true };
  }

  @Patch(':id/feature')
  @UseGuards(SessionAuthGuard)
  async toggleFeatured(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetFeaturedDto,
  ) {
    return this.projectsService.setFeatured(user.id, id, dto.featured);
  }

  @Patch(':id')
  @UseGuards(SessionAuthGuard)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(SessionAuthGuard)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    await this.projectsService.delete(user.id, id);
    return { success: true };
  }
}
