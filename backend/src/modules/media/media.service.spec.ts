import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MediaService } from './media.service';
import { Media } from './schemas/media.schema';
import { LocalStorageProvider } from './storage/storage.provider';
import { R2StorageProvider } from './storage/r2-storage.provider';
import { ChangelogService } from '../changelog/changelog.service';

describe('MediaService', () => {
  let service: MediaService;
  let mockMediaModel: any;
  let mockLocalStorage: any;
  let mockR2Storage: any;
  let mockChangelog: any;

  const userId = '507f191e810c19729de860ea';
  const otherUserId = '507f191e810c19729de860eb';
  const mediaId = '507f191e810c19729de860ec';

  /** A minimal but genuine PNG byte stream (signature + IHDR). */
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);

  beforeEach(async () => {
    mockMediaModel = {
      create: jest.fn().mockImplementation((doc: any) => ({
        _id: mediaId,
        ...doc,
        save: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ _id: mediaId, ...doc }),
      })),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findById: jest.fn(),
    };

    mockLocalStorage = {
      save: jest
        .fn()
        .mockResolvedValue({ key: 'test.webp', url: '/local/test.webp' }),
      delete: jest.fn().mockResolvedValue(undefined),
      getUrl: jest.fn().mockReturnValue('/local/test.webp'),
      getFilePath: jest.fn().mockReturnValue('/uploads/test.webp'),
    };

    mockR2Storage = {
      isAvailable: jest.fn().mockReturnValue(true),
      save: jest
        .fn()
        .mockResolvedValue({
          key: 'test.webp',
          url: 'https://r2.signed/test.webp',
        }),
      delete: jest.fn().mockResolvedValue(undefined),
      getSignedUploadUrl: jest
        .fn()
        .mockResolvedValue('https://r2.signed-put/test.webp'),
      getSignedDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://r2.signed-get/test.webp'),
      getUrl: jest.fn().mockReturnValue('/api/v1/media/file/test.webp'),
    };

    mockChangelog = {
      record: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: getModelToken(Media.name), useValue: mockMediaModel },
        { provide: LocalStorageProvider, useValue: mockLocalStorage },
        { provide: R2StorageProvider, useValue: mockR2Storage },
        { provide: ChangelogService, useValue: mockChangelog },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  it('should upload a valid file and use R2 storage when available', async () => {
    const file = {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: pngBytes.length,
      buffer: pngBytes,
    };

    const result = await service.upload(userId, file, 'avatar');

    expect(mockR2Storage.save).toHaveBeenCalled();
    expect(mockMediaModel.create).toHaveBeenCalled();
    expect(mockChangelog.record).toHaveBeenCalled();
    expect(result.key).toContain('profile-picture');
  });

  it('should reject a file whose bytes do not match the declared MIME type', async () => {
    const file = {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 26,
      // A ZIP archive masquerading as a PNG.
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
    };

    await expect(service.upload(userId, file, 'avatar')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockR2Storage.save).not.toHaveBeenCalled();
  });

  it('should reject a file whose extension does not match the declared MIME type', async () => {
    const file = {
      originalname: 'payload.exe',
      mimetype: 'image/png',
      size: pngBytes.length,
      buffer: pngBytes,
    };

    await expect(service.upload(userId, file, 'avatar')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject file exceeding category size limit', async () => {
    const file = {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 10 * 1024 * 1024, // 10MB exceeds 5MB avatar limit
      buffer: Buffer.from('large'),
    };

    await expect(service.upload(userId, file, 'avatar')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject file with unsupported MIME type', async () => {
    const file = {
      originalname: 'malicious.exe',
      mimetype: 'application/x-msdownload',
      size: 1024,
      buffer: Buffer.from('bytes'),
    };

    await expect(service.upload(userId, file, 'avatar')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should generate presigned upload URL via getSignedUpload', async () => {
    const res = await service.getSignedUpload(userId, {
      type: 'project',
      filename: 'screenshot.webp',
      mimeType: 'image/webp',
      sizeBytes: 200 * 1024,
      projectId: 'proj_123',
    });

    expect(mockR2Storage.getSignedUploadUrl).toHaveBeenCalled();
    expect(res.uploadUrl).toBe('https://r2.signed-put/test.webp');
    expect(res.key).toContain('projects/');
    expect(res.expiresInSeconds).toBe(900);
  });

  it('should assert ownership and delete media', async () => {
    const mockDoc = {
      _id: mediaId,
      userId: { toString: () => userId },
      key: 'projects/1/image.webp',
      originalFilename: 'shot.webp',
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    mockMediaModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockDoc),
    });

    await service.delete(userId, mediaId);

    expect(mockR2Storage.delete).toHaveBeenCalledWith('projects/1/image.webp');
    expect(mockDoc.deleteOne).toHaveBeenCalled();
  });

  it('should throw ForbiddenException when deleting another user media', async () => {
    const mockDoc = {
      _id: mediaId,
      userId: { toString: () => otherUserId },
      key: 'projects/1/image.webp',
    };
    mockMediaModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockDoc),
    });

    await expect(service.delete(userId, mediaId)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
