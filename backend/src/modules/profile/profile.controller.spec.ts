import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { Profile } from './schemas/profile.schema';
import { ChangelogService } from '../changelog/changelog.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { UsersService } from '../users/users.service';

const OWNER_ID = '507f191e810c19729de860ea';
const OTHER_ID = '507f191e810c19729de860eb';

function makeProfileDoc(overrides: Record<string, unknown> = {}) {
  const appearance = {
    accent: 'ocean',
    background: 'solid',
    typography: 'compact',
    buttonStyle: 'soft',
    layout: 'centered',
    colors: {},
    surface: { style: 'glass', borderWidth: 1, opacity: 5, radius: 22 },
    typographyScale: { heading: 30, subheading: 18, body: 14, small: 11 },
    button: { style: 'soft', radius: 999, height: 'md' },
    canvas: {
      width: 'standard',
      padding: 24,
      spacing: 40,
      contentWidth: 680,
      align: 'center',
    },
    layoutOrder: [],
    ...(overrides.appearance as Record<string, unknown>),
  };

  return {
    _id: { toString: () => 'profile-1' },
    userId: { toString: () => OWNER_ID },
    username: 'ada',
    displayName: 'Ada Lovelace',
    live: true,
    ghostMode: false,
    social: {},
    appearance,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ProfileController appearance routes', () => {
  let controller: ProfileController;
  let service: ProfileService;
  let mockProfileModel: any;
  let mockChangelog: any;

  beforeEach(async () => {
    mockProfileModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    mockChangelog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        ProfileService,
        { provide: getModelToken(Profile.name), useValue: mockProfileModel },
        { provide: ChangelogService, useValue: mockChangelog },
        { provide: SessionAuthGuard, useValue: { canActivate: () => true } },
        {
          provide: UsersService,
          useValue: { findById: jest.fn(async () => ({ _id: 'u1' })) },
        },
      ],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
    service = module.get<ProfileService>(ProfileService);
  });

  it('returns the full appearance config for a profile the caller owns', async () => {
    const doc = makeProfileDoc();
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    const result = await controller.getAppearance(
      { id: OWNER_ID } as any,
      'ada',
    );

    expect(result.accent).toBe('ocean');
    expect(result.surface).toBeDefined();
    expect(result.typographyScale).toBeDefined();
    expect(result.button).toBeDefined();
    expect(result.canvas).toBeDefined();
    expect(result.layoutOrder).toEqual([]);
  });

  it('rejects an appearance request for another user profile', async () => {
    const foreignDoc = makeProfileDoc({
      userId: { toString: () => OTHER_ID },
    });

    // The caller owns a profile, but it is not the one addressed.
    mockProfileModel.findOne
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(makeProfileDoc()),
      })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(foreignDoc) });

    await expect(
      controller.getAppearance({ id: OWNER_ID } as any, 'someone-else'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an appearance request for a profile that does not exist', async () => {
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      controller.getAppearance({ id: OWNER_ID } as any, 'ghost-user'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws Forbidden when the addressed profile belongs to someone else', async () => {
    mockProfileModel.findOne
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({
        exec: jest
          .fn()
          .mockResolvedValue(
            makeProfileDoc({ userId: { toString: () => OTHER_ID } }),
          ),
      });

    await expect(
      controller.getAppearance({ id: OWNER_ID } as any, 'someone-else'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deep-merges a nested appearance patch instead of replacing the section', async () => {
    const doc = makeProfileDoc();
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    const result = await service.updateAppearance(OWNER_ID, {
      surface: { opacity: 42 },
    } as any);

    expect(result.surface.opacity).toBe(42);
    // Sibling keys inside the same section survive the patch.
    expect(result.surface.style).toBe('glass');
    expect(result.surface.radius).toBe(22);
    // Untouched sections are preserved.
    expect(result.accent).toBe('ocean');
    expect(result.typographyScale.body).toBe(14);
    expect(doc.save).toHaveBeenCalled();
  });

  it('falls back to defaults for a legacy profile with no stored appearance', async () => {
    const doc = makeProfileDoc({ appearance: undefined });
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    const result = await service.getAppearance(OWNER_ID);

    expect(result.accent).toBe('signal');
    expect(result.background).toBe('aurora');
    expect(result.surface.style).toBe('glass');
    expect(result.canvas.contentWidth).toBe(680);
  });

  it('exposes the resolved appearance on the public DTO', async () => {
    const doc = makeProfileDoc({ appearance: undefined });
    const dto = service.toPublicDto(doc as any);

    expect(dto.appearance.accent).toBe('signal');
    expect(dto.appearance.background).toBe('aurora');
    expect(dto.appearance.surface).toBeDefined();
    expect(dto.appearance.typographyScale).toBeDefined();
    expect(dto.ghostMode).toBe(false);
    expect((dto as any).userId).toBeUndefined();
  });

  it('records the appearance change in the changelog', async () => {
    const doc = makeProfileDoc();
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    await service.updateAppearance(OWNER_ID, { accent: 'jade' } as any);

    expect(mockChangelog.record).toHaveBeenCalledWith(
      OWNER_ID,
      'appearance.updated',
      'Updated appearance settings',
      expect.objectContaining({
        before: expect.objectContaining({ accent: 'ocean' }),
        after: expect.objectContaining({ accent: 'jade' }),
      }),
    );
  });
});

describe('Ghost mode', () => {
  let service: ProfileService;
  let mockProfileModel: any;

  beforeEach(async () => {
    mockProfileModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: getModelToken(Profile.name), useValue: mockProfileModel },
        {
          provide: ChangelogService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('hides a ghosted profile from public lookups', async () => {
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeProfileDoc({ ghostMode: true })),
    });

    const publicProfile = await service.findPublicByUsername('ada');
    expect(publicProfile).toBeNull();

    // The owner can still reach it.
    const internal = await service.findByUsername('ada');
    expect(internal).not.toBeNull();
  });

  it('returns a normal profile through public lookups', async () => {
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeProfileDoc()),
    });

    const publicProfile = await service.findPublicByUsername('ada');
    expect(publicProfile).not.toBeNull();
  });

  it('persists the ghostMode flag', async () => {
    const doc = makeProfileDoc();
    mockProfileModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    await service.update(OWNER_ID, { ghostMode: true } as any);

    expect(doc.ghostMode).toBe(true);
    expect(doc.save).toHaveBeenCalled();
  });
});
