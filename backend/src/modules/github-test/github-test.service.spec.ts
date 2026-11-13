import 'reflect-metadata';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GithubTestService } from './github-test.service';
import { NotFoundException, HttpException } from '@nestjs/common';

describe('GithubTestService', () => {
  let service: GithubTestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubTestService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<GithubTestService>(GithubTestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequest when username is empty', async () => {
    await expect(service.getPublicProfile('   ')).rejects.toThrow(
      HttpException,
    );
  });

  it('should correctly format GitHub user response into Stackly profile and projects', async () => {
    const mockGhUser = {
      login: 'octocat',
      id: 583231,
      avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
      html_url: 'https://github.com/octocat',
      name: 'The Octocat',
      company: '@github',
      blog: 'https://github.blog',
      location: 'San Francisco',
      email: null,
      bio: 'Building developer tools',
      twitter_username: 'github',
      public_repos: 8,
      public_gists: 8,
      followers: 12000,
      following: 9,
      created_at: '2011-01-25T18:44:36Z',
      updated_at: '2024-03-22T00:00:00Z',
    };

    const mockRepos = [
      {
        id: 1296269,
        name: 'Hello-World',
        full_name: 'octocat/Hello-World',
        description: 'My first repo',
        html_url: 'https://github.com/octocat/Hello-World',
        homepage: null,
        language: 'TypeScript',
        stargazers_count: 2500,
        forks_count: 1400,
        topics: ['starter', 'tutorial'],
        fork: false,
        archived: false,
      },
    ];

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/repos')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockRepos,
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '59',
          'x-ratelimit-reset': '1700000000',
        }),
        json: async () => mockGhUser,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      const result = await service.getPublicProfile('octocat');
      expect(result.success).toBe(true);
      expect(result.username).toBe('octocat');
      expect(result.profile.displayName).toBe('The Octocat');
      expect(result.profile.avatarUrl).toBe(mockGhUser.avatar_url);
      expect(result.profile.social?.github).toBe(mockGhUser.html_url);
      expect(result.profile.social?.x).toBe('https://x.com/github');
      expect(result.projects.length).toBe(1);
      expect(result.projects[0].name).toBe('Hello-World');
      expect(result.projects[0].tech).toContain('TypeScript');
      expect(result.projects[0].tech).toContain('starter');
      expect(result.stats.publicRepos).toBe(8);
      expect(result.stats.followers).toBe(12000);
      expect(result.meta.rateLimitRemaining).toBe('59');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should handle 404 Not Found appropriately', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({ message: 'Not Found' }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      await expect(
        service.getPublicProfile('non-existent-user-123xyz'),
      ).rejects.toThrow(NotFoundException);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
