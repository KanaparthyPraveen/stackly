import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  IStorageProvider,
  StorageResult,
  StoredObjectMetadata,
} from './storage.provider';

/**
 * Cloudflare R2 through its S3-compatible API (AWS SDK v3).
 *
 * The bucket is private: nothing is ever served from a public bucket URL.
 * Reads go through short-lived pre-signed URLs minted by the backend, and the
 * credentials never leave the server.
 */
@Injectable()
export class R2StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('r2.endpoint') ?? '';
    const accessKeyId = this.configService.get<string>('r2.accessKeyId') ?? '';
    const secretAccessKey =
      this.configService.get<string>('r2.secretAccessKey') ?? '';
    const region = this.configService.get<string>('r2.region') || 'auto';
    this.bucketName = this.configService.get<string>('r2.bucket') || 'stackly';

    if (endpoint && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        // R2 does not implement the optional CRC checksums newer SDK versions
        // add by default; without this, pre-signed uploads are rejected.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
      this.logger.log(`Object storage ready (bucket: ${this.bucketName})`);
    } else {
      this.logger.warn(
        'Object storage credentials missing; media is stored on the local disk.',
      );
    }
  }

  isAvailable(): boolean {
    return this.s3Client !== null;
  }

  private client(): S3Client {
    if (!this.s3Client) {
      throw new Error('Object storage is not configured');
    }
    return this.s3Client;
  }

  async save(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageResult> {
    await this.client().send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.length,
      }),
    );
    return { key };
  }

  async delete(key: string): Promise<void> {
    if (!this.s3Client) return;

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to delete object "${key}": ${(err as Error).message}`,
      );
    }
  }

  /** Short-lived URL for reading a private object. */
  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 3600,
    options: { contentType?: string; downloadName?: string } = {},
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentType: options.contentType,
      ResponseContentDisposition: options.downloadName
        ? `attachment; filename="${options.downloadName.replace(/[^\w.\- ]/g, '_')}"`
        : undefined,
    });

    return getSignedUrl(this.client(), command, {
      expiresIn: expiresInSeconds,
    });
  }

  /**
   * Short-lived URL a browser can PUT a file to. The content type is part of
   * the signature, so the URL cannot be used to upload a different type.
   */
  async getSignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType,
    });

    return getSignedUrl(this.client(), command, {
      expiresIn: expiresInSeconds,
      signableHeaders: new Set(['content-type']),
    });
  }

  async getMetadata(key: string): Promise<StoredObjectMetadata | null> {
    if (!this.s3Client) return null;

    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        etag: response.ETag,
      };
    } catch {
      return null;
    }
  }

  async readHead(key: string, bytes: number): Promise<Buffer | null> {
    if (!this.s3Client) return null;

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Range: `bytes=0-${Math.max(0, bytes - 1)}`,
        }),
      );
      if (!response.Body) return null;
      return Buffer.from(await response.Body.transformToByteArray());
    } catch {
      return null;
    }
  }
}
