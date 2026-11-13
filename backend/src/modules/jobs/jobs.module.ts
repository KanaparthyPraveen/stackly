import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MediaModule } from '../media/media.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [IntegrationsModule, MediaModule],
  providers: [JobsService],
})
export class JobsModule {}
