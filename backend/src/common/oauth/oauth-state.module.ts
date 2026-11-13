import { Global, Module } from '@nestjs/common';
import { OAuthStateService } from './oauth-state.service';

@Global()
@Module({
  providers: [OAuthStateService],
  exports: [OAuthStateService],
})
export class OAuthStateModule {}
