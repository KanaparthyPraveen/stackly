import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Integration, IntegrationSchema } from './schemas/integration.schema';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { ChangelogModule } from '../changelog/changelog.module';
import { UsersModule } from '../users/users.module';
import { ProfileModule } from '../profile/profile.module';
import { GitHubProvider } from './providers/github.provider';
import { DiscordProvider } from './providers/discord.provider';
import { SpotifyProvider } from './providers/spotify.provider';
import { WakaTimeProvider } from './providers/wakatime.provider';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Integration.name, schema: IntegrationSchema },
    ]),
    ChangelogModule,
    UsersModule,
    ProfileModule,
  ],
  providers: [
    IntegrationsService,
    GitHubProvider,
    DiscordProvider,
    SpotifyProvider,
    WakaTimeProvider,
  ],
  controllers: [IntegrationsController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
