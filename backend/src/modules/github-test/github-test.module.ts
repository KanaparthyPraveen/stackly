import { Module } from '@nestjs/common';
import { GithubTestController } from './github-test.controller';
import { GithubTestService } from './github-test.service';

@Module({
  controllers: [GithubTestController],
  providers: [GithubTestService],
  exports: [GithubTestService],
})
export class GithubTestModule {}
