import 'reflect-metadata';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';
import {
  Body,
  Controller,
  INestApplication,
  Module,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

class SampleDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  username: string;
}

@Controller('sample')
class SampleController {
  @Post()
  create(@Body() dto: SampleDto) {
    return { success: true, data: dto };
  }

  @Post('error')
  triggerError() {
    throw new Error('Database password was 123456');
  }
}

@Module({
  controllers: [SampleController],
})
class SampleModule {}

describe('Validation & Error Handling (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SampleModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  it('accepts valid payload and returns 201', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/sample').send({
      email: 'user@example.com',
      username: 'techuser',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        email: 'user@example.com',
        username: 'techuser',
      },
    });
  });

  it('rejects payload with invalid email format', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/sample').send({
      email: 'not-an-email',
      username: 'techuser',
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        path: '/api/v1/sample',
      }),
    );
    expect(res.body.message).toContain('email must be an email');
  });

  it('rejects unexpected properties (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/sample').send({
      email: 'user@example.com',
      username: 'techuser',
      maliciousField: 'exploit',
    });

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
    expect(res.body.message).toContain(
      'property maliciousField should not exist',
    );
  });

  it('catches unhandled exceptions and masks stack traces in 500 response', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/sample/error');

    expect(res.status).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
        path: '/api/v1/sample/error',
      }),
    );
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Database password');
  });

  afterEach(async () => {
    await app.close();
  });
});
