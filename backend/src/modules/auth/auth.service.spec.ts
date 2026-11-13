import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { Profile } from '../profile/schemas/profile.schema';
import { Link } from '../links/schemas/link.schema';
import { Project } from '../projects/schemas/project.schema';
import { ProfileComponent } from '../components/schemas/component.schema';
import { Integration } from '../integrations/schemas/integration.schema';
import { Media } from '../media/schemas/media.schema';
import { Changelog } from '../changelog/schemas/changelog.schema';
import { Template } from '../templates/schemas/template.schema';
import { AnalyticsEvent } from '../analytics/schemas/analytics-event.schema';
import { SessionService } from './session/session.service';
import { ProfileService } from '../profile/profile.service';
import { MediaService } from '../media/media.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: any;
  let mockModel: any;

  beforeEach(async () => {
    mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      comparePassword: jest.fn(),
      create: jest.fn(),
      updatePassword: jest.fn(),
      deleteById: jest.fn(),
    };

    mockModel = {
      findOne: jest
        .fn()
        .mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
          limit: jest.fn().mockReturnValue({
            lean: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
          }),
        }),
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      }),
      deleteOne: jest
        .fn()
        .mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
        }),
      deleteMany: jest
        .fn()
        .mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        { provide: getModelToken(Profile.name), useValue: mockModel },
        { provide: getModelToken(Link.name), useValue: mockModel },
        { provide: getModelToken(Project.name), useValue: mockModel },
        { provide: getModelToken(ProfileComponent.name), useValue: mockModel },
        { provide: getModelToken(Integration.name), useValue: mockModel },
        { provide: getModelToken(Media.name), useValue: mockModel },
        { provide: getModelToken(Changelog.name), useValue: mockModel },
        { provide: getModelToken(Template.name), useValue: mockModel },
        { provide: getModelToken(AnalyticsEvent.name), useValue: mockModel },
        SessionService,
        {
          provide: ProfileService,
          useValue: { ensureProfile: jest.fn(async () => undefined) },
        },
        {
          provide: MediaService,
          useValue: { deleteAllForUser: jest.fn(async () => 0) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should validate user with correct credentials', async () => {
    mockUsersService.findByEmail.mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      email: 'alex@stackly.dev',
      passwordHash: 'hashed_pw',
    });
    mockUsersService.comparePassword.mockResolvedValue(true);

    const user = await service.validateUser('alex@stackly.dev', 'correct_pw');

    expect(user).toEqual({
      id: '507f191e810c19729de860ea',
      email: 'alex@stackly.dev',
    });
  });

  it('should throw UnauthorizedException for unknown email', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.validateUser('unknown@stackly.dev', 'password123'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for wrong password', async () => {
    mockUsersService.findByEmail.mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      email: 'alex@stackly.dev',
      passwordHash: 'hashed_pw',
    });
    mockUsersService.comparePassword.mockResolvedValue(false);

    await expect(
      service.validateUser('alex@stackly.dev', 'wrong_pw'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should set session.userId and return safe user on login', async () => {
    mockUsersService.findByEmail.mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      email: 'alex@stackly.dev',
      passwordHash: 'hashed_pw',
    });
    mockUsersService.comparePassword.mockResolvedValue(true);

    const session: any = {};
    const result = await service.login(
      { email: 'alex@stackly.dev', password: 'correct_pw' },
      { session, headers: {} } as any,
    );

    expect(session.userId).toBe('507f191e810c19729de860ea');
    expect(result.user).toEqual({
      id: '507f191e810c19729de860ea',
      email: 'alex@stackly.dev',
    });
    expect((result.user as any).passwordHash).toBeUndefined();
  });

  it('should destroy session on logout', async () => {
    const destroyMock = jest.fn((cb: any) => cb(null));
    const session: any = { destroy: destroyMock };

    const result = await service.logout({ session } as any);
    expect(destroyMock).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('should safely succeed logout if session does not exist', async () => {
    const result = await service.logout(undefined);
    expect(result).toEqual({ success: true });
  });

  it('should register a new user and set session.userId', async () => {
    mockUsersService.create = jest.fn().mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      email: 'newuser@stackly.dev',
    });

    const session: any = {};
    const result = await service.register(
      { email: 'newuser@stackly.dev', password: 'securePassword123' },
      { session, headers: {} } as any,
    );

    expect(mockUsersService.create).toHaveBeenCalledWith(
      'newuser@stackly.dev',
      'securePassword123',
    );
    expect(session.userId).toBe('507f191e810c19729de860ea');
    expect(result.user).toEqual({
      id: '507f191e810c19729de860ea',
      email: 'newuser@stackly.dev',
    });
  });

  it('should return safe user in getMe', async () => {
    mockUsersService.findById.mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      email: 'alex@stackly.dev',
    });

    const result = await service.getMe('507f191e810c19729de860ea');
    expect(result.user).toEqual({
      id: '507f191e810c19729de860ea',
      email: 'alex@stackly.dev',
    });
  });

  it('should change password successfully', async () => {
    mockUsersService.updatePassword.mockResolvedValue(undefined);

    const res = await service.changePassword('507f191e810c19729de860ea', {
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123',
    });

    expect(mockUsersService.updatePassword).toHaveBeenCalledWith(
      '507f191e810c19729de860ea',
      'oldPassword123',
      'newPassword123',
    );
    expect(res.success).toBe(true);
  });

  it('should cascade delete user data and session on deleteAccount', async () => {
    mockUsersService.deleteById.mockResolvedValue(undefined);
    const destroyMock = jest.fn((cb: any) => cb(null));
    const session: any = { destroy: destroyMock };

    const res = await service.deleteAccount('507f191e810c19729de860ea', {
      session,
    } as any);

    expect(mockUsersService.deleteById).toHaveBeenCalledWith(
      '507f191e810c19729de860ea',
    );
    expect(destroyMock).toHaveBeenCalled();
    expect(res.success).toBe(true);
  });

  it('should export all user data in exportUserData', async () => {
    mockUsersService.findById.mockResolvedValue({
      _id: '507f191e810c19729de860ea',
      email: 'alex@stackly.dev',
      createdAt: new Date(),
    });

    const res = await service.exportUserData('507f191e810c19729de860ea');

    expect(res.exportedAt).toBeDefined();
    expect(res.account).toEqual({
      id: '507f191e810c19729de860ea',
      email: 'alex@stackly.dev',
    });
    expect(res.links).toEqual([]);
    expect(res.projects).toEqual([]);
    expect(res.components).toEqual([]);
  });
});
