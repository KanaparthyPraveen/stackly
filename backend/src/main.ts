import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import MongoStore from 'connect-mongo';
import { AppModule } from './app.module';
import { configureApp, SESSION_COLLECTION } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const isProduction = configService.get<string>('nodeEnv') === 'production';
  const maxAgeMs = configService.get<number>('session.maxAgeMs', 86400000);
  const mongoUri = configService.get<string>('mongodb.uri');

  // Sessions always live in MongoDB so they survive a restart and can be
  // listed and revoked. `stringify: false` keeps the session document
  // queryable by user id.
  const sessionStore = MongoStore.create({
    mongoUrl: mongoUri,
    collectionName: SESSION_COLLECTION,
    ttl: Math.floor(maxAgeMs / 1000),
    stringify: false,
    touchAfter: 300,
  });

  configureApp(app, { sessionStore });
  app.enableShutdownHooks();

  // Interactive API documentation is a development aid, not a public surface.
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Stackly API')
      .setDescription('Stackly — Developer Identity Platform REST API')
      .setVersion('1.0')
      .addCookieAuth(
        configService.get<string>('session.cookieName', 'stackly.sid'),
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('port', 3001);
  await app.listen(port);
  logger.log(`Stackly API listening on port ${port}`);
}

void bootstrap();
