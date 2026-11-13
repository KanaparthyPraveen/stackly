import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProfileComponent,
  ProfileComponentSchema,
} from './schemas/component.schema';
import { ComponentsService } from './components.service';
import { ComponentsController } from './components.controller';
import { ChangelogModule } from '../changelog/changelog.module';
import { ProfileModule } from '../profile/profile.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: ProfileComponent.name, schema: ProfileComponentSchema },
    ]),
    ChangelogModule,
    ProfileModule,
  ],
  providers: [ComponentsService],
  controllers: [ComponentsController],
  exports: [ComponentsService],
})
export class ComponentsModule {}
