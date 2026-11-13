import { Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import type { Connection } from 'mongoose';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { OAuthStateModule } from './common/oauth/oauth-state.module';
import { AuthModule } from './modules/auth/auth.module';
import { SessionModule } from './modules/auth/session/session.module';
import { ChangelogModule } from './modules/changelog/changelog.module';
import { GithubTestModule } from './modules/github-test/github-test.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LinksModule } from './modules/links/links.module';
import { ProfileModule } from './modules/profile/profile.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ComponentsModule } from './modules/components/components.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MediaModule } from './modules/media/media.module';
import { TemplatesModule } from './modules/templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    // Baseline budget for every endpoint; credential, click-tracking and
    // provider endpoints tighten it with @Throttle.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'short',
          ttl: 60000,
          limit: configService.get<number>('throttle.limit', 120),
        },
      ],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
        serverSelectionTimeoutMS: 5000,
        // Fail fast with a clear error when the database is unreachable at
        // boot, instead of starting an API that cannot serve anything.
        retryAttempts: 3,
        retryDelay: 2000,
        connectionFactory: (connection: Connection) => {
          connection.on('error', (error: Error) => {
            Logger.error(
              `MongoDB connection error: ${error.message}`,
              'Database',
            );
          });
          connection.on('disconnected', () => {
            Logger.warn('MongoDB disconnected', 'Database');
          });
          return connection;
        },
      }),
    }),
    OAuthStateModule,
    SessionModule,
    HealthModule,
    UsersModule,
    AuthModule,
    GithubTestModule,
    LinksModule,
    ProfileModule,
    IntegrationsModule,
    ChangelogModule,
    ProjectsModule,
    ComponentsModule,
    AnalyticsModule,
    MediaModule,
    TemplatesModule,
    JobsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
