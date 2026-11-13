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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/guards/session-auth.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { MAX_UPLOAD_BYTES, MediaService } from './media.service';
import type { ExpressUploadedFile, MediaDelivery } from './media.service';
import {
  SignedUploadDto,
  UpdateMediaDto,
  UploadQueryDto,
} from './dto/signed-upload.dto';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Sends a stored file to the client: a redirect to a short-lived signed
   * URL when object storage is in use, or the bytes themselves in local
   * development.
   */
  private send(
    res: Response,
    delivery: MediaDelivery,
    cacheControl: string,
  ): void {
    res.setHeader('Cache-Control', cacheControl);

    if (delivery.kind === 'redirect') {
      res.redirect(HttpStatus.FOUND, delivery.url);
      return;
    }

    // Uploaded content is never allowed to execute in the API's origin.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.type(delivery.mimeType);
    res.sendFile(delivery.path);
  }

  /** Upload a file through the backend. */
  @Post('upload')
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4 },
    }),
  )
  @ApiOperation({ summary: 'Direct multipart upload for media files' })
  @ApiResponse({
    status: 201,
    description: 'File uploaded and metadata stored',
  })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: ExpressUploadedFile,
    @Query() query: UploadQueryDto,
  ) {
    return this.mediaService.upload(
      user.id,
      file,
      query.type ?? 'project',
      query.projectId,
    );
  }

  /** Request a pre-signed URL for a direct browser-to-storage upload. */
  @Post('signed-upload')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Request a presigned URL for direct object storage upload',
  })
  @ApiResponse({ status: 201, description: 'Presigned upload URL returned' })
  async getSignedUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SignedUploadDto,
  ) {
    return this.mediaService.getSignedUpload(user.id, dto);
  }

  /** Confirm a direct upload; the stored object is verified before use. */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Verify and confirm a presigned upload' })
  async completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.mediaService.completeSignedUpload(user.id, id);
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List media uploaded by the authenticated user' })
  async getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.findAllForUser(user.id);
  }

  /**
   * Public delivery of a public file. This is the stable URL stored on
   * profiles (`<img src>`); it never expires because the signed storage URL
   * behind it is minted per request.
   */
  @Get('public/:id')
  @ApiOperation({ summary: 'Serve a public media file' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to a short-lived signed URL',
  })
  async getPublicMedia(
    @Param('id', ParseObjectIdPipe) id: string,
    @Res() res: Response,
  ) {
    const delivery = await this.mediaService.resolvePublic(id);
    // Shorter than the signed URL lifetime, so a cached redirect is never stale.
    this.send(res, delivery, 'public, max-age=300');
  }

  /** Owner-only download, for private files such as resumes. */
  @Get(':id/download')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Download a media file owned by the caller' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Res() res: Response,
  ) {
    const delivery = await this.mediaService.resolveForOwner(user.id, id);
    this.send(res, delivery, 'private, no-store');
  }

  @Get(':id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get a media record and a signed download URL' })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.mediaService.findById(user.id, id);
  }

  @Patch(':id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Change who can access a media file' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.mediaService.updateVisibility(user.id, id, dto.visibility);
  }

  @Delete(':id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Delete a media asset from storage and database' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    await this.mediaService.delete(user.id, id);
    return { success: true };
  }
}
