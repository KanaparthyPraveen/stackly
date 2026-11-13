import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Template, TemplateSchema } from './schemas/template.schema';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { ProfileModule } from '../profile/profile.module';
import { ComponentsModule } from '../components/components.module';
import { ChangelogModule } from '../changelog/changelog.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Template.name, schema: TemplateSchema },
    ]),
    ProfileModule,
    ComponentsModule,
    ChangelogModule,
  ],
  providers: [TemplatesService],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}
