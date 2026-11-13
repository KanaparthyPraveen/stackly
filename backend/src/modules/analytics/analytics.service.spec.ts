import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsEvent } from './schemas/analytics-event.schema';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockEventModel: any;

  beforeEach(async () => {
    mockEventModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getModelToken(AnalyticsEvent.name),
          useValue: mockEventModel,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should track a new event if no recent duplicate exists', async () => {
    mockEventModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    });

    await service.track({
      profileUserId: '654321654321654321654321',
      eventType: 'profile_view',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    expect(mockEventModel.create).toHaveBeenCalled();
  });

  it('should dedup events from the same IP/UA within 10 minutes', async () => {
    mockEventModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: 'existing_recent_event' }),
        }),
      }),
    });

    await service.track({
      profileUserId: '654321654321654321654321',
      eventType: 'profile_view',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    expect(mockEventModel.create).not.toHaveBeenCalled();
  });

  it('should aggregate report metrics correctly', async () => {
    mockEventModel.aggregate
      // current period, grouped by event type
      .mockResolvedValueOnce([
        { _id: 'profile_view', count: 100 },
        { _id: 'link_click', count: 25 },
        { _id: 'project_click', count: 5 },
      ])
      // previous period
      .mockResolvedValueOnce([{ _id: 'profile_view', count: 50 }])
      .mockResolvedValue([]); // series, top items, breakdowns

    const report = await service.getReport('654321654321654321654321', '30d');
    expect(report.summary.views).toBe(100);
    expect(report.summary.clicks).toBe(25);
    expect(report.summary.projectClicks).toBe(5);
    expect(report.summary.ctr).toBe(0.3); // (25 + 5) / 100
    expect(report.previous.views).toBe(50);
    expect(report.change.views).toBe(1); // doubled
    // Nothing to compare against, so no invented percentage.
    expect(report.change.clicks).toBeNull();
    expect(report.viewsSeries).toHaveLength(30);
  });

  it('should not count automated clients as visitors', () => {
    expect(
      service.isBot('Googlebot/2.1 (+http://www.google.com/bot.html)'),
    ).toBe(true);
    expect(service.isBot(undefined)).toBe(true);
    expect(
      service.isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0'),
    ).toBe(false);
  });
});
