import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { User } from '../src/modules/users/schemas/user.schema';
import { UsersService } from '../src/modules/users/users.service';

describe('Auth & Session (e2e)', () => {
  let app: INestApplication;
  const usersStore = new Map<string, any>();

  beforeEach(async () => {
    usersStore.clear();

    const testPasswordHash = await bcrypt.hash('validPassword123!', 10);
    const seedUser = {
      _id: 'user_seed_id_123',
      email: 'alex@stackly.dev',
      passwordHash: testPasswordHash,
    };
    usersStore.set(seedUser.email, seedUser);
    usersStore.set(seedUser._id, seedUser);

    const mockUsersService = {
      findByEmail: async (email: string) =>
        usersStore.get(email.toLowerCase().trim()) || null,
      findById: async (id: string) => {
        const user = usersStore.get(id);
        if (!user) throw new Error('User not found');
        return user;
      },
      comparePassword: async (plain: string, hash: string) =>
        bcrypt.compare(plain, hash),
      hashPassword: async (plain: string) => bcrypt.hash(plain, 10),
      create: async (email: string, plain: string) => {
        const hash = await bcrypt.hash(plain, 10);
        const newUser = {
          _id: 'new_user_id',
          email: email.toLowerCase().trim(),
          passwordHash: hash,
        };
        usersStore.set(newUser.email, newUser);
        usersStore.set(newUser._id, newUser);
        return newUser;
      },
    };

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
      .overrideProvider(getModelToken(User.name))
      .useValue({})
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());

    app.use(cookieParser());
    app.use(
      session({
        name: 'stackly.sid',
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 86400000,
        },
      }),
    );

    await app.init();
  });

  it('rejects login with missing email or password (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: '', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  it('rejects login with invalid email format (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('email must be an email');
  });

  it('rejects login with unknown email (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'unknown@stackly.dev',
        password: 'validPassword123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects login with wrong password (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'alex@stackly.dev',
        password: 'wrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('successful login sets session cookie and returns safe user data (200)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'alex@stackly.dev',
        password: 'validPassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: 'user_seed_id_123',
      email: 'alex@stackly.dev',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('stackly.sid=');
    expect(cookies[0]).toContain('HttpOnly');
  });

  it('full session lifecycle: login -> getMe -> logout -> getMe fails', async () => {
    // 1. Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'alex@stackly.dev',
        password: 'validPassword123!',
      });

    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers['set-cookie'];
    expect(cookie).toBeDefined();

    // 2. /auth/me with session cookie
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user).toEqual({
      id: 'user_seed_id_123',
      email: 'alex@stackly.dev',
    });

    // 3. /auth/me without session cookie
    const unauthRes = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(unauthRes.status).toBe(401);

    // 4. Logout
    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ success: true });

    // 5. Subsequent /auth/me with the same cookie is now rejected
    const afterLogoutRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(afterLogoutRes.status).toBe(401);
  });

  it('logout without an existing session returns 200 without error', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
