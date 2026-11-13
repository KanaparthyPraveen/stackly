import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  Media,
  MediaDocument,
  MediaType,
  MediaVisibility,
} from './schemas/media.schema';
import {
  LocalStorageProvider,
  type IStorageProvider,
} from './storage/storage.provider';
import { R2StorageProvider } from './storage/r2-storage.provider';
import {
  assertContentMatchesMime,
  canonicalExtension,
  extensionError,
} from './storage/file-validation';
import { ChangelogService } from '../changelog/changelog.service';
import { SignedUploadDto } from './dto/signed-upload.dto';

// SVG is deliberately absent: it can carry script and would be served from
// the application's own origin.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const ALLOWED_MIME_TYPES: Record<MediaType, string[]> = {
  avatar: IMAGE_TYPES,
  cover: IMAGE_TYPES,
  project: IMAGE_TYPES,
  gallery: IMAGE_TYPES,
  resume: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  document: ['application/pdf', 'text/plain', 'text/markdown'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
};

const MB = 1024 * 1024;

const MAX_FILE_SIZES: Record<MediaType, number> = {
  avatar: 5 * MB,
  cover: 8 * MB,
  project: 10 * MB,
  gallery: 10 * MB,
  resume: 15 * MB,
  document: 15 * MB,
  video: 50 * MB,
};

/** Largest file the upload endpoint will buffer, across all categories. */
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(MAX_FILE_SIZES));

const KEY_PREFIX: Record<MediaType, string> = {
  avatar: 'profile-picture',
  cover: 'profile-cover',
  project: 'projects',
  gallery: 'gallery',
  resume: 'resumes',
  document: 'documents',
  video: 'videos',
};

const DEFAULT_VISIBILITY: Record<MediaType, MediaVisibility> = {
  avatar: 'public',
  cover: 'public',
  project: 'public',
  gallery: 'public',
  resume: 'private',
  document: 'private',
  video: 'private',
};

/** Categories where a new upload replaces the previous file. */
const SINGLETON_TYPES: MediaType[] = ['avatar', 'cover'];

const SIGNED_UPLOAD_TTL_SECONDS = 900;
const SIGNED_DOWNLOAD_TTL_SECONDS = 3600;
/** How many leading bytes are inspected to identify a file's real type. */
const SNIFF_BYTES = 4096;

export interface ExpressUploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface MediaDto {
  _id: string;
  key: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  type: MediaType;
  /** Stable, absolute URL of the file (public files only resolve for visitors). */
  url: string;
  visibility: MediaVisibility;
  referenced: boolean;
  createdAt?: Date;
  /** Short-lived direct download URL — only on single-record lookups. */
  downloadUrl?: string;
}

/** How to deliver a file to a client. */
export type MediaDelivery =
  | { kind: 'redirect'; url: string }
  | { kind: 'file'; path: string; mimeType: string; filename: string };

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    private readonly localStorageProvider: LocalStorageProvider,
    private readonly r2Provider: R2StorageProvider,
    private readonly changelog: ChangelogService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  private get storage(): IStorageProvider {
    return this.r2Provider.isAvailable()
      ? this.r2Provider
      : this.localStorageProvider;
  }

  /**
   * Builds the object key. Every part comes from the server: the user id
   * from the session, the extension from the validated MIME type and the
   * rest from a random id — nothing the client sends ends up in a key.
   */
  private buildKey(
    userId: string,
    type: MediaType,
    mimeType: string,
    projectId?: string,
  ): string {
    const ext = canonicalExtension(mimeType);
    const fileId = randomBytes(12).toString('hex');
    const prefix = KEY_PREFIX[type];

    if (type === 'project' && projectId && Types.ObjectId.isValid(projectId)) {
      return `${prefix}/${userId}/${projectId}/${fileId}${ext}`;
    }
    return `${prefix}/${userId}/${fileId}${ext}`;
  }

  /**
   * The path stored on the media record. It points at an application route
   * rather than at storage, so it keeps working after a signed URL expires.
   */
  private publicPathFor(mediaId: string): string {
    return `/api/v1/media/public/${mediaId}`;
  }

  private absoluteUrl(pathname: string): string {
    const base =
      this.configService?.get<string>('backendUrl') ?? 'http://localhost:3001';
    return `${base}${pathname}`;
  }

  private visibilityOf(
    media: Pick<Media, 'type' | 'visibility'>,
  ): MediaVisibility {
    return media.visibility ?? DEFAULT_VISIBILITY[media.type];
  }

  private validateMime(type: MediaType, mimeType: string): void {
    const allowed = ALLOWED_MIME_TYPES[type];
    if (!allowed) {
      throw new BadRequestException(`Unknown media category "${String(type)}"`);
    }
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid file type "${mimeType}" for category "${type}". Allowed: ${allowed.join(', ')}`,
      );
    }
  }

  private validateSize(type: MediaType, sizeBytes: number): void {
    const maxSize = MAX_FILE_SIZES[type];
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException('File is empty');
    }
    if (sizeBytes > maxSize) {
      throw new BadRequestException(
        `File size (${Math.round(sizeBytes / 1024)} KB) exceeds the limit of ${Math.round(maxSize / MB)} MB`,
      );
    }
  }

  private validateExtension(filename: string, mimeType: string): void {
    const error = extensionError(filename, mimeType);
    if (error) {
      throw new BadRequestException(error);
    }
  }

  /** Inspects the uploaded bytes to make sure they match the declared type. */
  private validateContent(buffer: Buffer, mimeType: string): void {
    const result = assertContentMatchesMime(buffer, mimeType);
    if (!result.ok) {
      throw new BadRequestException(
        `File content does not match the declared type "${mimeType}"${
          result.detected ? ` (detected "${result.detected}")` : ''
        }`,
      );
    }
  }

  /** Filenames are kept for display only; strip anything path-like. */
  private safeFilename(name: string): string {
    const base = name.split(/[\\/]/).pop() ?? 'file';
    const printable = [...base].filter((ch) => ch.charCodeAt(0) >= 32).join('');
    return printable.slice(0, 200) || 'file';
  }

  toDto(media: MediaDocument, downloadUrl?: string): MediaDto {
    return {
      _id: media._id.toString(),
      key: media.key,
      originalFilename: media.originalFilename,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      type: media.type,
      url: this.absoluteUrl(this.publicPathFor(media._id.toString())),
      visibility: this.visibilityOf(media),
      referenced: media.referenced === true,
      createdAt: (media as MediaDocument & { createdAt?: Date }).createdAt,
      ...(downloadUrl ? { downloadUrl } : {}),
    };
  }

  /**
   * Stores a file uploaded through the backend.
   * For avatars and covers the previous file is removed once the new one is
   * safely stored.
   */
  async upload(
    userId: string,
    file: ExpressUploadedFile,
    type: MediaType = 'project',
    projectId?: string,
  ): Promise<MediaDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    this.validateMime(type, file.mimetype);
    this.validateSize(type, file.buffer.length || file.size);
    this.validateSize(type, file.size);
    this.validateExtension(file.originalname, file.mimetype);
    this.validateContent(file.buffer, file.mimetype);

    const key = this.buildKey(userId, type, file.mimetype, projectId);
    await this.storage.save(key, file.buffer, file.mimetype);

    let created: MediaDocument;
    try {
      created = await this.mediaModel.create({
        userId: new Types.ObjectId(userId),
        key,
        originalFilename: this.safeFilename(file.originalname),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        type,
        url: 'pending',
        visibility: DEFAULT_VISIBILITY[type],
        referenced: true,
      });
      created.url = this.publicPathFor(created._id.toString());
      await created.save();
    } catch (err) {
      // Never leave an object in the bucket that no record points at.
      await this.storage.delete(key);
      throw err;
    }

    if (SINGLETON_TYPES.includes(type)) {
      await this.removePrevious(userId, type, created._id.toString());
    }

    await this.changelog.record(
      userId,
      'media.uploaded',
      `Uploaded ${type} asset: "${created.originalFilename}"`,
      { key: created.key, size: file.size },
      created._id.toString(),
    );

    return this.toDto(created);
  }

  private async removePrevious(
    userId: string,
    type: MediaType,
    keepId: string,
  ): Promise<void> {
    try {
      const previous = await this.mediaModel
        .find({
          userId: new Types.ObjectId(userId),
          type,
          _id: { $ne: new Types.ObjectId(keepId) },
        })
        .exec();

      for (const media of previous ?? []) {
        await this.storage.delete(media.key);
        await media.deleteOne();
      }
    } catch (err) {
      this.logger.warn(
        `Could not remove previous ${type} files: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Authorises a direct browser-to-storage upload.
   *
   * The record starts unconfirmed; it only becomes usable once
   * {@link completeSignedUpload} has checked what actually landed in storage.
   */
  async getSignedUpload(
    userId: string,
    dto: SignedUploadDto,
  ): Promise<{
    mediaId: string;
    key: string;
    uploadUrl: string;
    expiresInSeconds: number;
  }> {
    this.validateMime(dto.type, dto.mimeType);
    this.validateSize(dto.type, dto.sizeBytes);
    this.validateExtension(dto.filename, dto.mimeType);

    if (!this.r2Provider.isAvailable()) {
      throw new BadRequestException(
        'Direct uploads need object storage to be configured. Use POST /media/upload instead.',
      );
    }

    const key = this.buildKey(userId, dto.type, dto.mimeType, dto.projectId);
    const uploadUrl = await this.r2Provider.getSignedUploadUrl(
      key,
      dto.mimeType,
      SIGNED_UPLOAD_TTL_SECONDS,
    );

    const media = await this.mediaModel.create({
      userId: new Types.ObjectId(userId),
      key,
      originalFilename: this.safeFilename(dto.filename),
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      type: dto.type,
      url: 'pending',
      visibility: DEFAULT_VISIBILITY[dto.type],
      referenced: false,
    });

    media.url = this.publicPathFor(media._id.toString());
    await media.save();

    return {
      mediaId: media._id.toString(),
      key,
      uploadUrl,
      expiresInSeconds: SIGNED_UPLOAD_TTL_SECONDS,
    };
  }

  /**
   * Confirms a direct upload. The client's claims about the file are not
   * trusted: the stored object's real size and leading bytes are checked, and
   * anything that fails is deleted.
   */
  async completeSignedUpload(
    userId: string,
    mediaId: string,
  ): Promise<MediaDto> {
    const media = await this.assertOwnership(userId, mediaId);
    if (media.referenced) return this.toDto(media);

    const reject = async (reason: string): Promise<never> => {
      await this.storage.delete(media.key);
      await media.deleteOne();
      throw new BadRequestException(reason);
    };

    const metadata = await this.storage.getMetadata(media.key);
    if (!metadata) {
      throw new BadRequestException(
        'Upload not found in storage — the object was never received.',
      );
    }

    const size = metadata.contentLength ?? 0;
    if (size <= 0) await reject('The uploaded file is empty.');
    if (size > MAX_FILE_SIZES[media.type]) {
      await reject(
        `The uploaded file exceeds the limit of ${Math.round(MAX_FILE_SIZES[media.type] / MB)} MB.`,
      );
    }

    const head = await this.storage.readHead(media.key, SNIFF_BYTES);
    if (!head || !assertContentMatchesMime(head, media.mimeType).ok) {
      await reject(
        `The uploaded file is not a valid "${media.mimeType}" file.`,
      );
    }

    media.sizeBytes = size;
    media.referenced = true;
    await media.save();

    if (SINGLETON_TYPES.includes(media.type)) {
      await this.removePrevious(userId, media.type, mediaId);
    }

    await this.changelog.record(
      userId,
      'media.uploaded',
      `Uploaded ${media.type} asset: "${media.originalFilename}"`,
      { key: media.key, size },
      mediaId,
    );

    return this.toDto(media);
  }

  async findAllForUser(userId: string): Promise<MediaDto[]> {
    const items = await this.mediaModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    return (items ?? []).map((m) => this.toDto(m));
  }

  /** Owner lookup: metadata plus a short-lived direct download URL. */
  async findById(userId: string, mediaId: string): Promise<MediaDto> {
    const media = await this.assertOwnership(userId, mediaId);
    const downloadUrl = this.r2Provider.isAvailable()
      ? await this.r2Provider.getSignedDownloadUrl(
          media.key,
          SIGNED_DOWNLOAD_TTL_SECONDS,
        )
      : this.absoluteUrl(`/api/v1/media/${mediaId}/download`);
    return this.toDto(media, downloadUrl);
  }

  async updateVisibility(
    userId: string,
    mediaId: string,
    visibility: MediaVisibility,
  ): Promise<MediaDto> {
    const media = await this.assertOwnership(userId, mediaId);
    media.visibility = visibility;
    await media.save();

    await this.changelog.record(
      userId,
      'media.updated',
      `Made "${media.originalFilename}" ${visibility}`,
      { visibility },
      mediaId,
    );

    return this.toDto(media);
  }

  /**
   * Resolves a file for an anonymous visitor.
   *
   * Only confirmed, public files are reachable this way; a private or
   * missing file is indistinguishable (404). The signed URL is minted per
   * request, so the stable application URL never expires.
   */
  async resolvePublic(mediaId: string): Promise<MediaDelivery> {
    const media = await this.findMediaById(mediaId);
    if (!media.referenced || this.visibilityOf(media) !== 'public') {
      throw new NotFoundException('Media not found');
    }
    return this.deliver(media);
  }

  /** Resolves a file for its owner, whatever its visibility. */
  async resolveForOwner(
    userId: string,
    mediaId: string,
  ): Promise<MediaDelivery> {
    const media = await this.assertOwnership(userId, mediaId);
    return this.deliver(media);
  }

  private async deliver(media: MediaDocument): Promise<MediaDelivery> {
    if (this.r2Provider.isAvailable()) {
      return {
        kind: 'redirect',
        url: await this.r2Provider.getSignedDownloadUrl(
          media.key,
          SIGNED_DOWNLOAD_TTL_SECONDS,
          { contentType: media.mimeType },
        ),
      };
    }

    const metadata = await this.localStorageProvider.getMetadata(media.key);
    if (!metadata) throw new NotFoundException('Media not found');

    return {
      kind: 'file',
      path: this.localStorageProvider.getFilePath(media.key),
      mimeType: media.mimeType,
      filename: media.originalFilename,
    };
  }

  async delete(userId: string, mediaId: string): Promise<void> {
    const media = await this.assertOwnership(userId, mediaId);
    await this.storage.delete(media.key);
    await media.deleteOne();

    await this.changelog.record(
      userId,
      'media.deleted',
      `Deleted file "${media.originalFilename}"`,
      { key: media.key },
      mediaId,
    );
  }

  /** Removes every stored file of a user. Used when an account is deleted. */
  async deleteAllForUser(userId: string): Promise<number> {
    const items = await this.mediaModel
      .find({ userId: new Types.ObjectId(userId) })
      .exec();

    for (const media of items ?? []) {
      await this.storage.delete(media.key);
    }
    return items?.length ?? 0;
  }

  /**
   * Deletes records (and any stored bytes) for direct uploads that were
   * authorised but never confirmed.
   */
  async cleanupOrphans(olderThanHours = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const orphans = await this.mediaModel
      .find({ referenced: false, createdAt: { $lte: cutoff } })
      .limit(200)
      .exec();

    for (const orphan of orphans ?? []) {
      await this.storage.delete(orphan.key);
      await orphan.deleteOne();
    }

    return orphans?.length ?? 0;
  }

  private async findMediaById(mediaId: string): Promise<MediaDocument> {
    let media: MediaDocument | null = null;
    try {
      media = await this.mediaModel.findById(mediaId).exec();
    } catch {
      throw new NotFoundException('Media not found');
    }
    if (!media) throw new NotFoundException('Media not found');
    return media;
  }

  private async assertOwnership(
    userId: string,
    mediaId: string,
  ): Promise<MediaDocument> {
    const media = await this.findMediaById(mediaId);
    if (media.userId.toString() !== userId) throw new ForbiddenException();
    return media;
  }
}
