import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './schemas/project.schema';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ChangelogModule } from '../changelog/changelog.module';
import { ProfileModule } from '../profile/profile.module';
import { UsersModule } from '../users/users.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
    ChangelogModule,
    ProfileModule,
    AnalyticsModule,
  ],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
