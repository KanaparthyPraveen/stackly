import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { ProfileModule } from '../profile/profile.module';
import { MediaModule } from '../media/media.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { OAuthModule } from './oauth/oauth.module';
import { Profile, ProfileSchema } from '../profile/schemas/profile.schema';
import { Link, LinkSchema } from '../links/schemas/link.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import {
  ProfileComponent,
  ProfileComponentSchema,
} from '../components/schemas/component.schema';
import {
  Integration,
  IntegrationSchema,
} from '../integrations/schemas/integration.schema';
import { Media, MediaSchema } from '../media/schemas/media.schema';
import {
  Changelog,
  ChangelogSchema,
} from '../changelog/schemas/changelog.schema';
import { Template, TemplateSchema } from '../templates/schemas/template.schema';
import {
  AnalyticsEvent,
  AnalyticsEventSchema,
} from '../analytics/schemas/analytics-event.schema';

@Module({
  imports: [
    UsersModule,
    ProfileModule,
    MediaModule,
    OAuthModule,
    MongooseModule.forFeature([
      { name: Profile.name, schema: ProfileSchema },
      { name: Link.name, schema: LinkSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: ProfileComponent.name, schema: ProfileComponentSchema },
      { name: Integration.name, schema: IntegrationSchema },
      { name: Media.name, schema: MediaSchema },
      { name: Changelog.name, schema: ChangelogSchema },
      { name: Template.name, schema: TemplateSchema },
      { name: AnalyticsEvent.name, schema: AnalyticsEventSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
