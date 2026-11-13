import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHmac } from 'crypto';
import {
  AnalyticsEvent,
  AnalyticsEventDocument,
  EventType,
} from './schemas/analytics-event.schema';

export type AnalyticsRange = '7d' | '30d' | '90d';

export interface TrackEventDto {
  profileUserId: string;
  eventType: EventType;
  entityId?: string;
  entityLabel?: string;
  ip?: string;
  userAgent?: string;
  /** Full referrer URL as reported by the visitor's browser. */
  referrer?: string;
}

export interface AnalyticsSummary {
  views: number;
  clicks: number;
  projectClicks: number;
  /** (link clicks + project clicks) / views, 0..n. */
  ctr: number;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface TopItem {
  id: string;
  label: string;
  count: number;
}

export interface BreakdownItem {
  label: string;
  count: number;
}

export interface AnalyticsReport {
  range: AnalyticsRange;
  summary: AnalyticsSummary;
  /** The same metrics for the equally long period just before this one. */
  previous: AnalyticsSummary;
  /**
   * Relative change against the previous period (0.12 = +12%).
   * `null` when the previous period had no data to compare against.
   */
  change: {
    views: number | null;
    clicks: number | null;
    projectClicks: number | null;
  };
  viewsSeries: SeriesPoint[];
  clicksSeries: SeriesPoint[];
  topLinks: TopItem[];
  topProjects: TopItem[];
  referrers: BreakdownItem[];
  devices: BreakdownItem[];
  browsers: BreakdownItem[];
}

/** Window in which a repeat of the same event by the same visitor is ignored. */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const BOT_PATTERN =
  /bot|crawler|spider|crawling|headless|preview|slurp|facebookexternalhit|curl\/|wget\/|python-requests|node-fetch|axios\//i;

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(AnalyticsEvent.name)
    private readonly eventModel: Model<AnalyticsEventDocument>,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * A keyed, truncated hash of IP + user agent, used only to de-duplicate
   * repeat events. The raw IP and user agent are never stored, and the key
   * means the value cannot be recomputed by anyone without the server secret.
   */
  private fingerprint(ip?: string, ua?: string): string {
    const secret =
      this.configService?.get<string>('session.secret') ??
      'stackly-analytics-fingerprint';
    return createHmac('sha256', secret)
      .update(`${ip || ''}|${ua || ''}`)
      .digest('hex')
      .slice(0, 16);
  }

  private rangeDays(range: AnalyticsRange): number {
    return range === '7d' ? 7 : range === '30d' ? 30 : 90;
  }

  private extractBrowser(ua?: string): string | undefined {
    if (!ua) return undefined;
    if (/Edg\//.test(ua)) return 'edge';
    if (ua.includes('Firefox')) return 'firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari';
    if (ua.includes('Chrome') || ua.includes('Chromium')) return 'chrome';
    return 'other';
  }

  private extractDevice(ua?: string): string | undefined {
    if (!ua) return undefined;
    if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  /** Only the hostname is kept — never the path or query of the referrer. */
  private extractReferrerDomain(referrer?: string): string | undefined {
    if (!referrer) return undefined;
    try {
      const url = new URL(referrer);
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        return undefined;
      return url.hostname.replace(/^www\./, '').slice(0, 120) || undefined;
    } catch {
      return undefined;
    }
  }

  /** True for automated clients whose visits should not count. */
  isBot(userAgent?: string): boolean {
    return !userAgent || BOT_PATTERN.test(userAgent);
  }

  /**
   * Records an event unless the same visitor already triggered the same
   * event for the same entity within the de-duplication window.
   * Returns whether a new event was stored.
   */
  async track(dto: TrackEventDto): Promise<boolean> {
    const fp = this.fingerprint(dto.ip, dto.userAgent);
    const profileUserId = new Types.ObjectId(dto.profileUserId);

    const dupe = await this.eventModel
      .findOne({
        profileUserId,
        eventType: dto.eventType,
        fingerprint: fp,
        entityId: dto.entityId,
        createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
      })
      .select('_id')
      .lean()
      .exec();

    if (dupe) return false;

    await this.eventModel.create({
      profileUserId,
      eventType: dto.eventType,
      fingerprint: fp,
      entityId: dto.entityId,
      entityLabel: dto.entityLabel?.slice(0, 160),
      deviceCategory: this.extractDevice(dto.userAgent),
      browserCategory: this.extractBrowser(dto.userAgent),
      referrerDomain: this.extractReferrerDomain(dto.referrer),
    });
    return true;
  }

  async getReport(
    profileUserId: string,
    range: AnalyticsRange,
  ): Promise<AnalyticsReport> {
    const days = this.rangeDays(range);
    const now = Date.now();
    const since = new Date(now - days * DAY_MS);
    const previousSince = new Date(now - 2 * days * DAY_MS);
    const pid = new Types.ObjectId(profileUserId);

    const [
      summary,
      previous,
      viewsSeries,
      clicksSeries,
      topLinks,
      topProjects,
      referrers,
      devices,
      browsers,
    ] = await Promise.all([
      this.summarise(pid, since, new Date(now)),
      this.summarise(pid, previousSince, since),
      this.getDailySeries(pid, 'profile_view', days, since),
      this.getDailySeries(pid, 'link_click', days, since),
      this.getTopEntities(pid, 'link_click', since),
      this.getTopEntities(pid, 'project_click', since),
      this.getBreakdown(pid, 'referrerDomain', since, 'direct'),
      this.getBreakdown(pid, 'deviceCategory', since, 'unknown'),
      this.getBreakdown(pid, 'browserCategory', since, 'unknown'),
    ]);

    const change = (current: number, before: number): number | null =>
      before > 0 ? (current - before) / before : null;

    return {
      range,
      summary,
      previous,
      change: {
        views: change(summary.views, previous.views),
        clicks: change(summary.clicks, previous.clicks),
        projectClicks: change(summary.projectClicks, previous.projectClicks),
      },
      viewsSeries,
      clicksSeries,
      topLinks,
      topProjects,
      referrers,
      devices,
      browsers,
    };
  }

  private async summarise(
    profileUserId: Types.ObjectId,
    from: Date,
    to: Date,
  ): Promise<AnalyticsSummary> {
    const rows = await this.eventModel.aggregate<{
      _id: EventType;
      count: number;
    }>([
      { $match: { profileUserId, createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]);

    const counts = new Map((rows ?? []).map((r) => [r._id, r.count]));
    const views = counts.get('profile_view') ?? 0;
    const clicks = counts.get('link_click') ?? 0;
    const projectClicks = counts.get('project_click') ?? 0;

    return {
      views,
      clicks,
      projectClicks,
      ctr: views > 0 ? (clicks + projectClicks) / views : 0,
    };
  }

  private async getDailySeries(
    profileUserId: Types.ObjectId,
    eventType: EventType,
    days: number,
    since: Date,
  ): Promise<SeriesPoint[]> {
    const agg = await this.eventModel.aggregate<{ _id: string; value: number }>(
      [
        { $match: { profileUserId, eventType, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            value: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ],
    );

    // Days without events still appear in the series, as zero.
    const map = new Map((agg ?? []).map((a) => [a._id, a.value]));
    const series: SeriesPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
      series.push({ date, value: map.get(date) || 0 });
    }
    return series;
  }

  private async getTopEntities(
    profileUserId: Types.ObjectId,
    eventType: EventType,
    since: Date,
  ): Promise<TopItem[]> {
    const rows = await this.eventModel.aggregate<TopItem>([
      {
        $match: {
          profileUserId,
          eventType,
          entityId: { $exists: true, $ne: null },
          createdAt: { $gte: since },
        },
      },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$entityId',
          // The most recent label wins, so a renamed link shows its new name.
          label: { $last: '$entityLabel' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          id: '$_id',
          label: { $ifNull: ['$label', 'Untitled'] },
          count: 1,
          _id: 0,
        },
      },
    ]);
    return rows ?? [];
  }

  private async getBreakdown(
    profileUserId: Types.ObjectId,
    field: 'referrerDomain' | 'deviceCategory' | 'browserCategory',
    since: Date,
    emptyLabel: string,
  ): Promise<BreakdownItem[]> {
    const rows = await this.eventModel.aggregate<BreakdownItem>([
      {
        $match: {
          profileUserId,
          eventType: 'profile_view',
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $ifNull: [`$${field}`, emptyLabel] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { label: '$_id', count: 1, _id: 0 } },
    ]);
    return rows ?? [];
  }
}
