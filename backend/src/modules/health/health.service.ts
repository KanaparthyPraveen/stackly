import { Injectable, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

export interface HealthCheckResult {
  status: string;
  timestamp: string;
  uptime: number;
  database: 'connected' | 'disconnected' | 'unconfigured';
}

@Injectable()
export class HealthService {
  constructor(
    @Optional()
    @InjectConnection()
    private readonly connection?: Connection,
  ) {}

  check(): HealthCheckResult {
    let database: 'connected' | 'disconnected' | 'unconfigured' =
      'unconfigured';

    if (this.connection) {
      database =
        this.connection.readyState === 1 ? 'connected' : 'disconnected';
    }

    return {
      status: database === 'disconnected' ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database,
    };
  }
}
