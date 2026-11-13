import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from './schemas/media.schema';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { LocalStorageProvider } from './storage/storage.provider';
import { R2StorageProvider } from './storage/r2-storage.provider';
import { ChangelogModule } from '../changelog/changelog.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
    ChangelogModule,
  ],
  providers: [MediaService, LocalStorageProvider, R2StorageProvider],
  controllers: [MediaController],
  exports: [MediaService, R2StorageProvider, LocalStorageProvider],
})
export class MediaModule {}
