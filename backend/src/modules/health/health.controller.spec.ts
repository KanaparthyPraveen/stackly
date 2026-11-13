import 'reflect-metadata';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: 'DatabaseConnection',
          useValue: null,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', () => {
    const result = controller.getHealth();
    expect(result.status).toBe('ok');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeDefined();
    expect(result.database).toBe('unconfigured');
  });

  it('should report database as connected when connection readyState is 1', () => {
    const mockConnection = { readyState: 1 } as unknown as Connection;
    const healthServiceWithDb = new HealthService(mockConnection);
    const result = healthServiceWithDb.check();
    expect(result.database).toBe('connected');
  });

  it('should report database as disconnected when connection readyState is not 1', () => {
    const mockConnection = { readyState: 0 } as unknown as Connection;
    const healthServiceWithDb = new HealthService(mockConnection);
    const result = healthServiceWithDb.check();
    expect(result.database).toBe('disconnected');
  });
});
