import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

export const API_PREFIX = 'api/v1';

/** MongoDB collection holding server-side sessions. */
export const SESSION_COLLECTION = 'app_sessions';

export interface ConfigureAppOptions {
  /** Session store. Omitted in tests, which fall back to the in-memory store. */
  sessionStore?: session.Store;
}

/**
 * Applies everything that makes a Nest application behave like the Stackly
 * API: prefix, CORS, validation, error format, security headers and sessions.
 *
 * Shared by `main.ts` and the end-to-end tests so they exercise the same
 * pipeline that runs in production.
 */
export function configureApp(
  app: NestExpressApplication,
  options: ConfigureAppOptions = {},
): void {
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('nodeEnv') === 'production';

  app.setGlobalPrefix(API_PREFIX);
  app.disable('x-powered-by');

  // Needed for correct client IPs (rate limiting, analytics de-duplication)
  // and for `secure` cookies when TLS terminates at a proxy.
  const trustProxy = configService.get<number>('trustProxy', 0);
  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  const frontendUrl = configService.get<string>(
    'frontendUrl',
    'http://localhost:3000',
  );
  const allowedOrigins = new Set([
    frontendUrl,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-side calls)
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      if (!isProduction) {
        try {
          const u = new URL(origin);
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
            return callback(null, true);
          }
        } catch {
          // ignore invalid origin
        }
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cookie',
    ],
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Media is embedded by the frontend, which lives on another origin.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=15552000; includeSubDomains',
      );
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Implicit conversion is deliberately off: it would turn the string
      // "false" into `true` for boolean fields. Types that need converting
      // (dates) declare it with @Type.
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const maxAgeMs = configService.get<number>('session.maxAgeMs', 86400000);

  app.use(cookieParser());
  app.use(
    session({
      name: configService.get<string>('session.cookieName', 'stackly.sid'),
      secret:
        configService.get<string>('session.secret') ||
        'dev-session-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      store: options.sessionStore,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: maxAgeMs,
        path: '/',
      },
    }),
  );
}
