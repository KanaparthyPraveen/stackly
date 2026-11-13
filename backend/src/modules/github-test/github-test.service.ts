import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadGatewayException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GitHubUserProfileResponse {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  fork: boolean;
  archived: boolean;
  [key: string]: unknown;
}

export interface StacklyProfile {
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  social?: {
    github?: string;
    x?: string;
    website?: string;
  };
  live?: boolean;
}

export interface StacklyProject {
  id: string;
  name: string;
  description: string;
  tech: string[];
  repoUrl: string;
  liveUrl?: string;
  status: 'live' | 'beta' | 'wip' | 'archived';
  featured: boolean;
  stars: number;
  forks: number;
  isFork: boolean;
}

export interface GitHubTestProfileResult {
  success: boolean;
  username: string;
  meta: {
    authenticated: boolean;
    rateLimitLimit: string | null;
    rateLimitRemaining: string | null;
    rateLimitReset: string | null;
    fetchedAt: string;
  };
  /** Mapped to match Stackly's ProfilePreview component */
  profile: StacklyProfile;
  /** Mapped to match Stackly's ProjectCard component */
  projects: StacklyProject[];
  /** Summary of public GitHub visibility stats */
  stats: {
    publicRepos: number;
    publicGists: number;
    followers: number;
    following: number;
    company: string | null;
    location: string | null;
    hasPublicEmail: boolean;
    publicEmail: string | null;
    accountAgeYears: number;
  };
  /** Raw unmanipulated response from GitHub for testing verification */
  raw: {
    user: GitHubUserProfileResponse;
    repos: GitHubRepoResponse[];
  };
}

@Injectable()
export class GithubTestService {
  private readonly logger = new Logger(GithubTestService.name);

  constructor(private readonly configService: ConfigService) {}

  async getPublicProfile(username: string): Promise<GitHubTestProfileResult> {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      throw new HttpException('Username is required', HttpStatus.BAD_REQUEST);
    }

    const githubToken =
      this.configService.get<string>('GITHUB_TOKEN') ||
      process.env.GITHUB_TOKEN;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Stackly-Public-Profile-Test/1.0',
    };

    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    try {
      // 1. Fetch User Profile from GitHub Public API
      const userRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(cleanUsername)}`,
        { headers },
      );

      const rateLimitLimit = userRes.headers.get('x-ratelimit-limit');
      const rateLimitRemaining = userRes.headers.get('x-ratelimit-remaining');
      const rateLimitReset = userRes.headers.get('x-ratelimit-reset');

      if (userRes.status === 404) {
        throw new NotFoundException(
          `GitHub user "${cleanUsername}" was not found.`,
        );
      }

      if (userRes.status === 403) {
        const errorData = (await userRes.json().catch(() => ({}))) as {
          message?: string;
        };
        const isRateLimit =
          errorData.message?.toLowerCase().includes('rate limit') ||
          rateLimitRemaining === '0';

        if (isRateLimit) {
          throw new HttpException(
            'GitHub API rate limit exceeded (60 requests/hr for unauthenticated calls). Provide a GITHUB_TOKEN in your environment or wait until reset.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        throw new HttpException(
          `GitHub API Forbidden: ${errorData.message || 'Access denied'}`,
          HttpStatus.FORBIDDEN,
        );
      }

      if (!userRes.ok) {
        throw new BadGatewayException(
          `GitHub API error (${userRes.status}): ${userRes.statusText}`,
        );
      }

      const ghUser = (await userRes.json()) as GitHubUserProfileResponse;

      // 2. Fetch User's Public Repositories (sorted by recently pushed, max 6)
      let ghRepos: GitHubRepoResponse[] = [];
      try {
        const reposRes = await fetch(
          `https://api.github.com/users/${encodeURIComponent(
            cleanUsername,
          )}/repos?sort=pushed&per_page=6`,
          { headers },
        );
        if (reposRes.ok) {
          ghRepos = (await reposRes.json()) as GitHubRepoResponse[];
        }
      } catch (repoErr) {
        this.logger.warn(
          `Could not fetch repos for ${cleanUsername}: ${
            repoErr instanceof Error ? repoErr.message : String(repoErr)
          }`,
        );
      }

      // 3. Format Website URL
      let formattedWebsite: string | undefined;
      if (ghUser.blog) {
        const trimmedBlog = ghUser.blog.trim();
        if (trimmedBlog) {
          formattedWebsite =
            trimmedBlog.startsWith('http://') ||
            trimmedBlog.startsWith('https://')
              ? trimmedBlog
              : `https://${trimmedBlog}`;
        }
      }

      // 4. Map into Stackly Profile Component Shape
      const profile: StacklyProfile = {
        username: ghUser.login,
        displayName: ghUser.name || ghUser.login,
        bio: ghUser.bio || undefined,
        avatarUrl: ghUser.avatar_url,
        location: ghUser.location || undefined,
        website: formattedWebsite,
        social: {
          github: ghUser.html_url,
          x: ghUser.twitter_username
            ? `https://x.com/${ghUser.twitter_username}`
            : undefined,
          website: formattedWebsite,
        },
        live: true,
      };

      // 5. Map Repositories to Stackly Project Shape
      const projects: StacklyProject[] = ghRepos.map((repo) => {
        const techList: string[] = [];
        if (repo.language) techList.push(repo.language);
        if (Array.isArray(repo.topics)) {
          repo.topics.forEach((t) => {
            if (t && !techList.includes(t)) techList.push(t);
          });
        }

        return {
          id: String(repo.id),
          name: repo.name,
          description: repo.description || 'Public repository on GitHub',
          tech: techList,
          repoUrl: repo.html_url,
          liveUrl: repo.homepage || undefined,
          status: repo.archived ? 'archived' : 'live',
          featured: repo.stargazers_count >= 5,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          isFork: repo.fork,
        };
      });

      // 6. Compute Account Age
      const createdDate = new Date(ghUser.created_at);
      const now = new Date();
      const accountAgeYears = Math.max(
        0,
        Math.floor(
          (now.getTime() - createdDate.getTime()) /
            (1000 * 60 * 60 * 24 * 365.25),
        ),
      );

      return {
        success: true,
        username: ghUser.login,
        meta: {
          authenticated: Boolean(githubToken),
          rateLimitLimit,
          rateLimitRemaining,
          rateLimitReset: rateLimitReset
            ? new Date(parseInt(rateLimitReset, 10) * 1000).toISOString()
            : null,
          fetchedAt: new Date().toISOString(),
        },
        profile,
        projects,
        stats: {
          publicRepos: ghUser.public_repos,
          publicGists: ghUser.public_gists,
          followers: ghUser.followers,
          following: ghUser.following,
          company: ghUser.company || null,
          location: ghUser.location || null,
          hasPublicEmail: Boolean(ghUser.email),
          publicEmail: ghUser.email || null,
          accountAgeYears,
        },
        raw: {
          user: ghUser,
          repos: ghRepos,
        },
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Error querying GitHub API for ${cleanUsername}`, err);
      throw new BadGatewayException(
        `Failed to reach GitHub API: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
