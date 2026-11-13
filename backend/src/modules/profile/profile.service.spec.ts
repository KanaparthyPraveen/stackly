import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Profile } from './schemas/profile.schema';
import { ProfileService } from './profile.service';
import { ChangelogService } from '../changelog/changelog.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let mockProfileModel: any;
  let mockChangelog: any;

  beforeEach(async () => {
    mockProfileModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    mockChangelog = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: getModelToken(Profile.name),
          useValue: mockProfileModel,
        },
        {
          provide: ChangelogService,
          useValue: mockChangelog,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should reject reserved usernames on create', async () => {
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.getOrCreate('507f191e810c19729de860ea', { username: 'admin' }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.getOrCreate('507f191e810c19729de860ea', { username: 'api' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject invalid username formats', async () => {
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    // Too short (<3)
    await expect(
      service.getOrCreate('507f191e810c19729de860ea', { username: 'ab' }),
    ).rejects.toThrow(BadRequestException);

    // Invalid characters (spaces, special symbols)
    await expect(
      service.getOrCreate('507f191e810c19729de860ea', {
        username: 'john doe!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should check username availability correctly', async () => {
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    const result = await service.checkAvailability('awesome_dev');
    expect(result.available).toBe(true);

    const reserved = await service.checkAvailability('root');
    expect(reserved.available).toBe(false);
    expect(reserved.reason).toContain('reserved');
  });

  it('toPublicDto should not leak userId or sensitive account data', () => {
    const mockProfileDoc: any = {
      _id: 'mock_profile_id',
      userId: 'sensitive_user_id_123',
      username: 'ada',
      displayName: 'Ada Lovelace',
      bio: 'Mathematician & programmer',
      live: true,
      social: { github: 'https://github.com/ada' },
      appearance: { background: 'aurora', accent: 'signal' },
    };

    const publicDto = service.toPublicDto(mockProfileDoc);
    expect(publicDto.username).toBe('ada');
    expect(publicDto.displayName).toBe('Ada Lovelace');
    expect((publicDto as any).userId).toBeUndefined();
    expect((publicDto as any)._id).toBeUndefined();
  });
});
