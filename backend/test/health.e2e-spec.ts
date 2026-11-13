import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;
  let mockReadyState = 1;

  beforeEach(async () => {
    const mockConnection = {
      get readyState() {
        return mockReadyState;
      },
      model: () => ({}),
      models: {},
      close: () => Promise.resolve(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue(mockConnection)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('GET /api/v1/health returns 200 and healthy status when DB connected', async () => {
    mockReadyState = 1;
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        database: 'connected',
      }),
    );
    expect(res.body.timestamp).toBeDefined();
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /api/v1/health reflects database disconnected state without crashing', async () => {
    mockReadyState = 0;
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'degraded',
        database: 'disconnected',
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
