import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/guards/session-auth.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ComponentsService } from './components.service';
import { ProfileService } from '../profile/profile.service';
import {
  CreateComponentDto,
  ReorderComponentsDto,
  UpdateComponentDto,
} from './dto/component.dto';
import { COMPONENT_REGISTRY } from './components.registry';

@ApiTags('Components')
@Controller('components')
export class ComponentsController {
  constructor(
    private readonly componentsService: ComponentsService,
    private readonly profileService: ProfileService,
  ) {}

  /** Public: the component types the platform supports, with their defaults. */
  @Get('types')
  getTypes() {
    return Object.values(COMPONENT_REGISTRY).map((c) => ({
      type: c.type,
      defaultTitle: c.defaultTitle,
      defaultConfig: c.defaultConfig,
    }));
  }

  /** Public: the visible components of a published profile. */
  @Get('public/:username')
  async getPublicComponents(
    @Param('username') username: string,
    @Req() req: Request,
  ) {
    const profile = await this.profileService.findViewableByUsername(
      username,
      req.session?.userId,
    );
    if (!profile) throw new NotFoundException('Profile not found');
    return this.componentsService.findPublicForUser(profile.userId.toString());
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  async getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.componentsService.findAllForUser(user.id);
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateComponentDto,
  ) {
    return this.componentsService.create(user.id, dto);
  }

  // Declared before `:id` so "reorder" is never read as a component id.
  @Put('reorder')
  @UseGuards(SessionAuthGuard)
  async reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderComponentsDto,
  ) {
    await this.componentsService.reorder(user.id, dto.ids);
    return { success: true };
  }

  @Patch(':id')
  @UseGuards(SessionAuthGuard)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateComponentDto,
  ) {
    return this.componentsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(SessionAuthGuard)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    await this.componentsService.delete(user.id, id);
    return { success: true };
  }
}
