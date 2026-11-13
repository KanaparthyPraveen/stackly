import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: any;

  beforeEach(async () => {
    mockUserModel = jest.fn().mockImplementation((dto: any) => ({
      ...dto,
      _id: 'mock_user_id',
      save: jest.fn().mockResolvedValue({
        _id: 'mock_user_id',
        email: dto.email,
        passwordHash: dto.passwordHash,
      }),
    })) as any;

    mockUserModel.findOne = jest.fn();
    mockUserModel.findById = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should hash and compare passwords accurately', async () => {
    const raw = 'superSecret123!';
    const hash = await service.hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(await service.comparePassword(raw, hash)).toBe(true);
    expect(await service.comparePassword('wrongPassword', hash)).toBe(false);
  });

  it('should create a user with a hashed password', async () => {
    mockUserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    const user = await service.create('tech@stackly.dev', 'securePass123');

    expect(user.email).toBe('tech@stackly.dev');
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe('securePass123');
  });

  it('should reject creating duplicate email', async () => {
    mockUserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: 'existing_id',
        email: 'tech@stackly.dev',
      }),
    });

    await expect(
      service.create('tech@stackly.dev', 'securePass123'),
    ).rejects.toThrow(ConflictException);
  });

  it('should find user by email with normalized formatting', async () => {
    mockUserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: 'user_id',
        email: 'user@example.com',
      }),
    });

    const user = await service.findByEmail('  USER@example.com  ');
    expect(mockUserModel.findOne).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
    expect(user?.email).toBe('user@example.com');
  });

  it('should throw NotFoundException if user id not found', async () => {
    mockUserModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.findById('non_existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
