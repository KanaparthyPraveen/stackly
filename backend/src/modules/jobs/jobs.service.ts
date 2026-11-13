import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationsService } from '../integrations/integrations.service';
import { MediaService } from '../media/media.service';

interface Job {
  name: string;
  everyMs: number;
  run: () => Promise<string | void>;
}

const MINUTE = 60 * 1000;

/**
 * In-process background jobs.
 *
 * The work here is small and idempotent — each job claims what it processes
 * atomically in MongoDB — so plain timers are enough and running several API
 * instances is safe. A queue (and Redis) would only be justified once jobs
 * need durable retries or fan-out beyond what one process can do.
 *
 * Not scheduled here on purpose:
 * - Expired sessions: removed by the session store's TTL index.
 * - Old analytics events and changelog entries: removed by TTL indexes.
 * - Scheduled links/components: evaluated at read time, so they go live at
 *   the exact moment without a job.
 */
@Injectable()
export class JobsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(JobsService.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly integrationsService: IntegrationsService,
    private readonly mediaService: MediaService,
  ) {}

  private jobs(): Job[] {
    return [
      {
        // Also refreshes access tokens: a sync renews a token that is about
        // to expire before using it.
        name: 'integration-sync',
        everyMs: 5 * MINUTE,
        run: async () => {
          const { attempted, failed } =
            await this.integrationsService.syncDue(20);
          return attempted > 0
            ? `${attempted} synced, ${failed} failed`
            : undefined;
        },
      },
      {
        name: 'media-orphan-cleanup',
        everyMs: 60 * MINUTE,
        run: async () => {
          const removed = await this.mediaService.cleanupOrphans(24);
          return removed > 0
            ? `${removed} unconfirmed uploads removed`
            : undefined;
        },
      },
    ];
  }

  onApplicationBootstrap(): void {
    if (!this.configService.get<boolean>('jobs.enabled', true)) {
      this.logger.log('Background jobs are disabled');
      return;
    }

    for (const job of this.jobs()) {
      const timer = setInterval(() => void this.execute(job), job.everyMs);
      // Never keep the process alive just for a timer.
      timer.unref();
      this.timers.push(timer);
    }

    // First pass shortly after boot rather than a full interval later.
    const kickoff = setTimeout(() => {
      for (const job of this.jobs()) void this.execute(job);
    }, 15 * 1000);
    kickoff.unref();
    this.timers.push(kickoff);

    this.logger.log(`Scheduled ${this.jobs().length} background jobs`);
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.length = 0;
  }

  /** Runs a job unless its previous run is still going; never throws. */
  private async execute(job: Job): Promise<void> {
    if (this.running.has(job.name)) return;
    this.running.add(job.name);
    try {
      const summary = await job.run();
      if (summary) this.logger.log(`${job.name}: ${summary}`);
    } catch (err) {
      this.logger.error(
        `${job.name} failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.running.delete(job.name);
    }
  }
}
