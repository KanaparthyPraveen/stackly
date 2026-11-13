import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../users/users.service';
import { SessionAuthGuard } from './session-auth.guard';

describe('SessionAuthGuard', () => {
  let guard: SessionAuthGuard;
  let mockUsersService: any;

  beforeEach(async () => {
    mockUsersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionAuthGuard,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    guard = module.get<SessionAuthGuard>(SessionAuthGuard);
  });

  function createMockContext(request: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('should throw UnauthorizedException if session has no userId', async () => {
    const context = createMockContext({ session: {} });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if user no longer exists in database', async () => {
    mockUsersService.findById.mockRejectedValue(new Error('User not found'));

    const destroyMock = jest.fn();
    const context = createMockContext({
      session: {
        userId: 'deleted_user',
        destroy: destroyMock,
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(destroyMock).toHaveBeenCalled();
  });

  it('should attach user to request and return true for valid session', async () => {
    mockUsersService.findById.mockResolvedValue({
      _id: 'user_123',
      email: 'alex@stackly.dev',
    });

    const req: any = { session: { userId: 'user_123' } };
    const context = createMockContext(req);

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);
    expect(req.user).toEqual({
      id: 'user_123',
      email: 'alex@stackly.dev',
    });
  });
});
