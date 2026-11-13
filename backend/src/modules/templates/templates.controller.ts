import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/guards/session-auth.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { TemplatesService } from './templates.service';
import {
  CreateTemplateDto,
  CreateTemplateFromProfileDto,
  UpdateTemplateDto,
} from './dto/template.dto';

@ApiTags('Templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Discover published templates' })
  async getPublic(@Req() req: Request, @Query('tag') tag?: string) {
    return this.templatesService.findPublic(
      typeof tag === 'string' ? tag : undefined,
      req.session?.userId,
    );
  }

  @Get('mine')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List templates created by the caller' })
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.findMine(user.id);
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Create a template' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templatesService.create(user.id, dto);
  }

  @Post('from-profile')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary:
      "Create a template from the caller's profile (look only, no personal content)",
  })
  async createFromProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTemplateFromProfileDto,
  ) {
    return this.templatesService.createFromProfile(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Template preview data (published templates, or the caller’s own)',
  })
  async getById(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    return this.templatesService.findById(id, req.session?.userId);
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Use template: clone its configuration into the profile',
  })
  async apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.templatesService.applyToProfile(user.id, id);
  }

  @Post(':id/duplicate')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Copy a template into the caller’s own templates' })
  async duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.templatesService.duplicate(user.id, id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Publish a template so others can discover it' })
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.templatesService.setPublished(user.id, id, true);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Hide a template from discovery' })
  async unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.templatesService.setPublished(user.id, id, false);
  }

  @Patch(':id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Edit a template' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Delete a template' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    await this.templatesService.delete(user.id, id);
    return { success: true };
  }
}
