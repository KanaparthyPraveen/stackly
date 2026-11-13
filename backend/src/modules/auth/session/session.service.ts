import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import type { Request } from 'express';
import type { Session, SessionData } from 'express-session';
import type { Connection } from 'mongoose';
import { SESSION_COLLECTION } from '../../../app.setup';

export interface SessionMeta {
  createdAt: string;
  userAgent?: string;
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    meta?: SessionMeta;
  }
}

export interface SessionSummary {
  /** Opaque handle for revoking the session — never the session id itself. */
  id: string;
  current: boolean;
  createdAt?: string;
  expiresAt?: string;
  browser: string;
  os: string;
}

interface StoredSession {
  _id: string;
  expires?: Date;
  session?: { userId?: string; meta?: SessionMeta };
}

type AppSession = Session & Partial<SessionData>;

function describeBrowser(ua = ''): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\/|Chromium\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Unknown browser';
}

function describeOs(ua = ''): string {
  if (/Windows/.test(ua)) return 'Windows';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

/**
 * Owns the lifecycle of server-side sessions: establishing them safely after
 * authentication, listing a user's active sessions and revoking them.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Optional()
    @InjectConnection()
    private readonly connection?: Connection,
  ) {}

  /** Public handle derived from a session id; safe to send to the client. */
  static publicId(sessionId: string): string {
    return createHash('sha256').update(sessionId).digest('hex').slice(0, 24);
  }

  /**
   * Signs a user in. The session id is regenerated first so an id issued
   * before authentication can never be reused afterwards (session fixation).
   */
  async establish(
    req: Pick<Request, 'session' | 'headers'>,
    userId: string,
  ): Promise<void> {
    const userAgent = req.headers?.['user-agent'];
    const meta: SessionMeta = {
      createdAt: new Date().toISOString(),
      userAgent:
        typeof userAgent === 'string' ? userAgent.slice(0, 300) : undefined,
    };

    const before = req.session as AppSession;

    await new Promise<void>((resolve, reject) => {
      if (typeof before.regenerate !== 'function') {
        before.userId = userId;
        before.meta = meta;
        resolve();
        return;
      }

      before.regenerate((err?: unknown) => {
        if (err) {
          reject(err instanceof Error ? err : new Error('Session error'));
          return;
        }
        // `regenerate` swaps in a brand-new session object on the request.
        // Writing to the old object would save under the old id and leave
        // the session id un-rotated, so the fresh one must be used here.
        const fresh = req.session as AppSession;
        fresh.userId = userId;
        fresh.meta = meta;
        if (typeof fresh.save !== 'function') {
          resolve();
          return;
        }
        fresh.save((saveErr?: unknown) => {
          if (saveErr) {
            reject(
              saveErr instanceof Error ? saveErr : new Error('Session error'),
            );
            return;
          }
          resolve();
        });
      });
    });
  }

  async destroy(session?: AppSession): Promise<void> {
    if (!session || typeof session.destroy !== 'function') return;
    await new Promise<void>((resolve, reject) => {
      session.destroy((err?: unknown) => {
        if (err)
          reject(err instanceof Error ? err : new Error('Session error'));
        else resolve();
      });
    });
  }

  private collection() {
    if (!this.connection || typeof this.connection.collection !== 'function') {
      return null;
    }
    return this.connection.collection<StoredSession>(SESSION_COLLECTION);
  }

  async list(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionSummary[]> {
    const collection = this.collection();
    if (!collection) return [];

    const docs = await collection
      .find({ 'session.userId': userId, expires: { $gt: new Date() } })
      .limit(50)
      .toArray();

    return docs
      .map((doc) => {
        const ua = doc.session?.meta?.userAgent;
        return {
          id: SessionService.publicId(doc._id),
          current: doc._id === currentSessionId,
          createdAt: doc.session?.meta?.createdAt,
          expiresAt: doc.expires?.toISOString(),
          browser: describeBrowser(ua),
          os: describeOs(ua),
        };
      })
      .sort((a, b) => Number(b.current) - Number(a.current));
  }

  /** Revokes one of the user's sessions, addressed by its public handle. */
  async revoke(userId: string, publicId: string): Promise<void> {
    const collection = this.collection();
    if (!collection) throw new NotFoundException('Session not found');

    const docs = await collection
      .find({ 'session.userId': userId })
      .project<{ _id: string }>({ _id: 1 })
      .toArray();

    const match = docs.find((d) => SessionService.publicId(d._id) === publicId);
    if (!match) throw new NotFoundException('Session not found');

    await collection.deleteOne({ _id: match._id, 'session.userId': userId });
  }

  /** Revokes every session of a user, optionally keeping the current one. */
  async revokeAll(userId: string, exceptSessionId?: string): Promise<number> {
    const collection = this.collection();
    if (!collection) return 0;

    try {
      const filter: Record<string, unknown> = { 'session.userId': userId };
      if (exceptSessionId) filter._id = { $ne: exceptSessionId };
      const result = await collection.deleteMany(filter);
      return result.deletedCount ?? 0;
    } catch (err) {
      this.logger.warn(
        `Could not revoke sessions: ${err instanceof Error ? err.message : err}`,
      );
      return 0;
    }
  }
}
