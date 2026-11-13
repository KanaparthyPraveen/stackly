import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Changelog, ChangelogSchema } from './schemas/changelog.schema';
import { ChangelogService } from './changelog.service';
import { ChangelogController } from './changelog.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Changelog.name, schema: ChangelogSchema },
    ]),
    UsersModule,
  ],
  providers: [ChangelogService],
  controllers: [ChangelogController],
  exports: [ChangelogService],
})
export class ChangelogModule {}
