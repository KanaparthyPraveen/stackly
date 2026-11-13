import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Project } from './schemas/project.schema';
import { ProjectsService } from './projects.service';
import { ChangelogService } from '../changelog/changelog.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockProjectModel: any;
  let mockChangelog: any;

  beforeEach(async () => {
    mockProjectModel = jest.fn().mockImplementation((dto: any) => ({
      ...dto,
      _id: 'mock_project_id',
      save: jest.fn().mockResolvedValue({
        _id: 'mock_project_id',
        ...dto,
      }),
    })) as any;

    mockProjectModel.find = jest.fn();
    mockProjectModel.findById = jest.fn();
    mockProjectModel.countDocuments = jest.fn();
    mockProjectModel.create = jest.fn();
    mockProjectModel.updateMany = jest.fn();
    mockProjectModel.bulkWrite = jest.fn();

    mockChangelog = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getModelToken(Project.name),
          useValue: mockProjectModel,
        },
        {
          provide: ChangelogService,
          useValue: mockChangelog,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should create a project and set first project as featured', async () => {
    mockProjectModel.countDocuments.mockResolvedValue(0);
    mockProjectModel.create.mockResolvedValue({
      _id: '507f191e810c19729de860e1',
      userId: '507f191e810c19729de860ea',
      name: 'Stackly App',
      featured: true,
      order: 0,
    });

    const result = await service.create('507f191e810c19729de860ea', {
      name: 'Stackly App',
      description: 'Developer identity',
    });

    expect(result.name).toBe('Stackly App');
    expect(result.featured).toBe(true);
    expect(mockChangelog.record).toHaveBeenCalled();
  });

  it('should enforce ownership on delete', async () => {
    const mockDoc = {
      _id: '507f191e810c19729de860e1',
      userId: '507f191e810c19729de860ea',
      name: 'Stackly',
      deleteOne: jest.fn().mockResolvedValue({}),
    };

    mockProjectModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockDoc),
    });

    // Attempt delete by wrong user
    await expect(
      service.delete('507f191e810c19729de860eb', '507f191e810c19729de860e1'),
    ).rejects.toThrow(ForbiddenException);

    // Delete by real owner
    await service.delete(
      '507f191e810c19729de860ea',
      '507f191e810c19729de860e1',
    );
    expect(mockDoc.deleteOne).toHaveBeenCalled();
  });

  it('should throw NotFoundException if project does not exist', async () => {
    mockProjectModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.delete('user_1', 'non_existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
