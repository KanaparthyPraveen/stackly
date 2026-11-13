import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('App bootstrapping (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const mockConnection = {
      readyState: 1,
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

  it('should bootstrap AppModule and serve health endpoint on /api/v1/health', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(typeof res.body.uptime).toBe('number');
  });

  afterEach(async () => {
    await app.close();
  });
});
