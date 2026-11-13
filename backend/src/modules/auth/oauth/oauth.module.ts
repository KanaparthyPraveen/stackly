import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { ProfileModule } from '../../profile/profile.module';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { GitHubOAuthProvider } from './providers/github.provider';
import { GoogleOAuthProvider } from './providers/google.provider';

@Module({
  imports: [UsersModule, ProfileModule, IntegrationsModule],
  controllers: [OAuthController],
  providers: [OAuthService, GitHubOAuthProvider, GoogleOAuthProvider],
  exports: [OAuthService],
})
export class OAuthModule {}
