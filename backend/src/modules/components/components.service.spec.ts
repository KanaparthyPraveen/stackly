import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileComponent } from './schemas/component.schema';
import { ComponentsService } from './components.service';
import { ChangelogService } from '../changelog/changelog.service';

describe('ComponentsService', () => {
  let service: ComponentsService;
  let mockComponentModel: any;
  let mockChangelog: any;

  beforeEach(async () => {
    mockComponentModel = {
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
      create: jest.fn(),
      bulkWrite: jest.fn(),
    };

    mockChangelog = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComponentsService,
        {
          provide: getModelToken(ProfileComponent.name),
          useValue: mockComponentModel,
        },
        {
          provide: ChangelogService,
          useValue: mockChangelog,
        },
      ],
    }).compile();

    service = module.get<ComponentsService>(ComponentsService);
  });

  it('should validate and create a hero component with default title', async () => {
    mockComponentModel.countDocuments.mockResolvedValue(0);
    mockComponentModel.create.mockResolvedValue({
      _id: '507f191e810c19729de860e1',
      userId: '507f191e810c19729de860ea',
      type: 'hero',
      title: 'Hero',
      order: 0,
    });

    const result = await service.create('507f191e810c19729de860ea', {
      type: 'hero',
      config: { headline: 'Senior Full Stack Engineer' },
    });

    expect(result.type).toBe('hero');
    expect(result.title).toBe('Hero');
  });

  it('should reject invalid component types', async () => {
    await expect(
      service.create('507f191e810c19729de860ea', {
        type: 'invalid_type_xyz' as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should enforce user ownership', async () => {
    const mockComponent = {
      _id: '507f191e810c19729de860e1',
      userId: '507f191e810c19729de860ea',
      deleteOne: jest.fn(),
    };

    mockComponentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockComponent),
    });

    await expect(
      service.delete('507f191e810c19729de860eb', '507f191e810c19729de860e1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
