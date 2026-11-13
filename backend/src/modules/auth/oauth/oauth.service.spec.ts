import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { GitHubOAuthProvider } from './providers/github.provider';
import { GoogleOAuthProvider } from './providers/google.provider';
import { UsersService } from '../../users/users.service';
import { ProfileService } from '../../profile/profile.service';
import { OAuthStateService } from '../../../common/oauth/oauth-state.service';
import { SessionService } from '../session/session.service';

describe('OAuthService', () => {
  let service: OAuthService;
  let mockUsers: any;
  let mockProfiles: any;
  let mockSessions: any;

  const githubIdentity = {
    providerId: '4242',
    username: 'ada',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    emailVerified: true,
    avatarUrl: 'https://avatars.example/ada.png',
  };

  beforeEach(async () => {
    mockUsers = {
      findByIdentity: jest.fn(async () => null),
      findByEmail: jest.fn(async () => null),
      createOAuthUser: jest.fn(async () => ({
        _id: { toString: () => 'new-user' },
        identities: [],
      })),
      linkIdentity: jest.fn(async (_id: string, identity: unknown) => ({
        _id: { toString: () => 'linked-user' },
        identities: [identity],
      })),
      claimVerifiedEmail: jest.fn(async () => false),
    };

    mockSessions = {
      revokeAll: jest.fn(async () => 0),
      establish: jest.fn(async () => undefined),
    };

    mockProfiles = {
      ensureProfile: jest.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        OAuthStateService,
        { provide: SessionService, useValue: mockSessions },
        { provide: UsersService, useValue: mockUsers },
        { provide: ProfileService, useValue: mockProfiles },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) => {
              const values: Record<string, unknown> = {
                'session.secret': 'test-secret',
                frontendUrl: 'http://localhost:3000',
                backendUrl: 'http://localhost:3001',
              };
              return key in values ? values[key] : fallback;
            },
          },
        },
        {
          provide: GitHubOAuthProvider,
          useValue: {
            name: 'github',
            label: 'GitHub',
            isConfigured: () => true,
            buildAuthorizeUrl: (state: string) =>
              `https://github.test?state=${state}`,
            exchangeCode: async () => 'token',
            fetchIdentity: async () => githubIdentity,
          },
        },
        {
          provide: GoogleOAuthProvider,
          useValue: {
            name: 'google',
            label: 'Google',
            isConfigured: () => false,
            buildAuthorizeUrl: (state: string) =>
              `https://google.test?state=${state}`,
            exchangeCode: async () => 'token',
            fetchIdentity: async () => ({ providerId: 'g1' }),
          },
        },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
  });

  describe('state handling', () => {
    it('round-trips a signed state value', () => {
      const nonce = OAuthService.generateNonce();
      const state = service.createState('github', nonce);

      const payload = service.verifyState(state, 'github', nonce);
      expect(payload.p).toBe('github');
      expect(payload.n).toBe(nonce);
    });

    it('rejects a tampered state value', () => {
      const nonce = OAuthService.generateNonce();
      const state = service.createState('github', nonce);
      const [body, sig] = state.split('.');
      const tampered = `${body}x.${sig}`;

      expect(() => service.verifyState(tampered, 'github', nonce)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a state issued for a different provider', () => {
      const nonce = OAuthService.generateNonce();
      const state = service.createState('github', nonce);

      expect(() => service.verifyState(state, 'google', nonce)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a state whose nonce does not match the session', () => {
      const state = service.createState('github', 'nonce-a');

      expect(() => service.verifyState(state, 'github', 'nonce-b')).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired state', () => {
      const nonce = OAuthService.generateNonce();
      const state = service.createState('github', nonce);

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);

      expect(() => service.verifyState(state, 'github', nonce)).toThrow(
        UnauthorizedException,
      );

      jest.restoreAllMocks();
    });

    it('rejects a malformed state', () => {
      expect(() => service.verifyState('garbage', 'github', 'x')).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('account resolution', () => {
    it('links an identity to the account already linked to it', async () => {
      mockUsers.findByIdentity.mockResolvedValue({
        _id: { toString: () => 'existing' },
      });

      const user = await service.resolveAccount('github', githubIdentity);

      expect(mockUsers.linkIdentity).toHaveBeenCalledWith(
        'existing',
        expect.objectContaining({ provider: 'github', providerId: '4242' }),
      );
      expect(mockUsers.createOAuthUser).not.toHaveBeenCalled();
      expect(user).toBeDefined();
    });

    it('links to an existing account when the verified email matches', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        _id: { toString: () => 'by-email' },
      });

      await service.resolveAccount('github', githubIdentity);

      expect(mockUsers.linkIdentity).toHaveBeenCalledWith(
        'by-email',
        expect.objectContaining({ providerId: '4242' }),
      );
      expect(mockUsers.createOAuthUser).not.toHaveBeenCalled();
    });

    it('revokes sessions when a verified sign-in claims a never-verified account', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        _id: { toString: () => 'squatted' },
      });
      mockUsers.claimVerifiedEmail.mockResolvedValue(true);

      await service.resolveAccount('github', githubIdentity);

      expect(mockUsers.claimVerifiedEmail).toHaveBeenCalledWith('squatted');
      expect(mockSessions.revokeAll).toHaveBeenCalledWith('squatted');
    });

    it('refuses to link an identity that belongs to another account', async () => {
      mockUsers.findByIdentity.mockResolvedValue({
        _id: { toString: () => 'someone-else' },
      });

      await expect(
        service.linkToAccount('me', 'github', githubIdentity),
      ).rejects.toThrow('oauth_identity_in_use');
      expect(mockUsers.linkIdentity).not.toHaveBeenCalled();
    });

    it('does not link by an unverified email address', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);

      await service.resolveAccount('github', {
        ...githubIdentity,
        emailVerified: false,
      });

      expect(mockUsers.findByEmail).not.toHaveBeenCalled();
      expect(mockUsers.createOAuthUser).toHaveBeenCalled();
    });

    it('creates a new account for an unknown identity', async () => {
      await service.resolveAccount('github', githubIdentity);

      expect(mockUsers.createOAuthUser).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'github',
          providerId: '4242',
        }),
      );
      expect(mockUsers.linkIdentity).not.toHaveBeenCalled();
    });
  });

  describe('providers', () => {
    it('reports which providers are configured', () => {
      const providers = service.listAvailableProviders();
      expect(providers).toHaveLength(2);
      expect(providers.find((p) => p.name === 'github')?.configured).toBe(true);
      expect(providers.find((p) => p.name === 'google')?.configured).toBe(
        false,
      );
    });

    it('throws for an unknown provider', () => {
      expect(() => service.getProvider('myspace')).toThrow();
    });
  });

  describe('redirects', () => {
    it('builds a frontend error redirect', () => {
      const url = service.buildErrorRedirect('oauth_denied');
      expect(url).toContain('/login');
      expect(url).toContain('error=oauth_denied');
    });

    it('builds a frontend success redirect', () => {
      expect(service.buildSuccessRedirect()).toContain('/dashboard');
    });
  });
});
