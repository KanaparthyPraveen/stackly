import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Link, LinkSchema } from './schemas/link.schema';
import { LinksService } from './links.service';
import { LinksController } from './links.controller';
import { ChangelogModule } from '../changelog/changelog.module';
import { UsersModule } from '../users/users.module';
import { ProfileModule } from '../profile/profile.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Link.name, schema: LinkSchema }]),
    ChangelogModule,
    UsersModule,
    ProfileModule,
    AnalyticsModule,
  ],
  providers: [LinksService],
  controllers: [LinksController],
  exports: [LinksService],
})
export class LinksModule {}
