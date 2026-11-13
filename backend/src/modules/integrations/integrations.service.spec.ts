import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { TokenEncryption } from '../../common/crypto/crypto.util';
import { OAuthStateService } from '../../common/oauth/oauth-state.service';
import { IntegrationsService } from './integrations.service';
import { ProviderAuthError } from './providers/integration-provider.interface';

const USER_ID = '507f191e810c19729de860ea';

/** A minimal in-memory stand-in for an Integration document. */
function makeDoc(fields: Record<string, unknown>) {
  const doc: any = {
    _id: { toString: () => 'integration-1' },
    data: {},
    metadata: {},
    syncFailures: 0,
    ...fields,
    markModified: jest.fn(),
    save: jest.fn(async () => doc),
  };
  return doc;
}

function chain(result: unknown) {
  const query: any = {
    select: () => query,
    sort: () => query,
    limit: () => query,
    lean: () => query,
    exec: async () => result,
  };
  return query;
}

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let model: any;
  let github: any;
  let wakatime: any;
  let changelog: any;

  beforeEach(() => {
    model = jest.fn((fields: Record<string, unknown>) => makeDoc(fields));
    model.find = jest.fn(() => chain([]));
    model.findOne = jest.fn(() => chain(null));
    model.findById = jest.fn(() => chain(null));
    model.findOneAndUpdate = jest.fn(() => chain(null));

    github = {
      id: 'github',
      name: 'GitHub',
      kind: 'oauth',
      description: '',
      isConfigured: () => true,
      buildAuthorizeUrl: ({ state, codeChallenge }: any) =>
        `https://github.test/authorize?state=${state}&code_challenge=${codeChallenge}`,
      exchangeCode: jest.fn(async () => ({
        accessToken: 'gho_plain_access',
        refreshToken: 'ghr_plain_refresh',
        expiresAt: new Date(Date.now() + 3600_000),
      })),
      fetchAccount: jest.fn(async () => ({
        externalId: '42',
        handle: '@ada',
        profileUrl: 'https://github.com/ada',
      })),
      fetchData: jest.fn(async () => ({ followers: 7 })),
      refreshTokens: jest.fn(),
      revokeToken: jest.fn(async () => undefined),
    };

    wakatime = {
      id: 'wakatime',
      name: 'WakaTime',
      kind: 'api_key',
      description: '',
      isConfigured: () => true,
      fetchAccount: jest.fn(async () => ({ externalId: 'w1', handle: '@ada' })),
      fetchData: jest.fn(async () => ({ totalCodingTime: '10 hrs' })),
    };

    const placeholder = (id: string) => ({
      id,
      name: id,
      kind: 'oauth',
      description: '',
      isConfigured: () => false,
    });

    changelog = { record: jest.fn(async () => undefined) };

    const config = {
      get: (key: string, fallback?: unknown) =>
        ({
          'encryption.key': 'unit-test-encryption-key',
          'session.secret': 'unit-test-session-secret',
          frontendUrl: 'http://localhost:3000',
        })[key] ?? fallback,
    } as unknown as ConfigService;

    service = new IntegrationsService(
      model,
      changelog,
      config,
      new OAuthStateService(config),
      github,
      placeholder('discord') as any,
      placeholder('spotify') as any,
      wakatime,
    );
  });

  it('lists every supported provider with its configuration state', () => {
    const ids = service.listProviders().map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'github',
        'discord',
        'spotify',
        'wakatime',
        'leetcode',
        'codechef',
        'hackerrank',
      ]),
    );
    expect(
      service.listProviders().find((p) => p.id === 'discord')?.configured,
    ).toBe(false);
  });

  it('stores tokens encrypted and never returns them', async () => {
    let saved: any;
    model.mockImplementation((fields: Record<string, unknown>) => {
      saved = makeDoc(fields);
      return saved;
    });

    const dto = await service.completeOAuthConnection(
      USER_ID,
      'github',
      'code',
      'verifier',
    );

    expect(github.exchangeCode).toHaveBeenCalledWith('code', 'verifier');

    // At rest: ciphertext, not the provider's token.
    expect(saved.accessToken).not.toContain('gho_plain_access');
    expect(TokenEncryption.isEncrypted(saved.accessToken)).toBe(true);
    expect(TokenEncryption.isEncrypted(saved.refreshToken)).toBe(true);
    expect(
      TokenEncryption.decrypt(saved.accessToken, 'unit-test-encryption-key'),
    ).toBe('gho_plain_access');

    // In the response: no credential in any form.
    const serialised = JSON.stringify(dto);
    expect(serialised).not.toContain('gho_plain_access');
    expect(serialised).not.toContain('ghr_plain_refresh');
    expect(serialised).not.toContain(saved.accessToken);
    expect(dto).not.toHaveProperty('accessToken');
    expect(dto).not.toHaveProperty('refreshToken');
    expect(dto.status).toBe('connected');
    expect(dto.verified).toBe(true);
    expect(dto.handle).toBe('@ada');
  });

  it('refuses to "connect" an OAuth provider with a typed-in handle', async () => {
    await expect(
      service.connect(USER_ID, {
        integrationId: 'github',
        handle: '@someone-famous',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(model).not.toHaveBeenCalled();
  });

  it('validates an API key with the provider before storing it', async () => {
    wakatime.fetchAccount.mockRejectedValue(new ProviderAuthError());

    await expect(
      service.connect(USER_ID, {
        integrationId: 'wakatime',
        apiKey: 'bad-key',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(model).not.toHaveBeenCalled();
  });

  it('links a manual profile as unverified and fetches nothing', async () => {
    const dto = await service.connect(USER_ID, {
      integrationId: 'leetcode',
      handle: 'https://leetcode.com/u/ada_l/',
    });

    expect(dto.handle).toBe('@ada_l');
    expect(dto.profileUrl).toBe('https://leetcode.com/u/ada_l/');
    expect(dto.verified).toBe(false);
    expect(dto.data).toEqual({});
  });

  it('rejects an invalid manual username', async () => {
    await expect(
      service.connect(USER_ID, {
        integrationId: 'codechef',
        handle: 'bad name!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown provider', async () => {
    await expect(
      service.connect(USER_ID, { integrationId: 'myspace', handle: 'ada' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('marks an integration for re-authorisation when the provider revokes access', async () => {
    const doc = makeDoc({
      integrationId: 'github',
      kind: 'oauth',
      status: 'connected',
      accessToken: TokenEncryption.encrypt(
        'gho_revoked',
        'unit-test-encryption-key',
      ),
      data: { followers: 7 },
    });
    model.findOne = jest.fn(() => chain(doc));
    model.findOneAndUpdate = jest.fn(() => chain(doc));
    model.findById = jest.fn(() => chain(doc));
    github.fetchData.mockRejectedValue(new ProviderAuthError());

    await expect(service.sync(USER_ID, 'github')).rejects.toThrow(
      BadRequestException,
    );

    expect(doc.status).toBe('reauth_required');
    expect(doc.accessToken).toBeUndefined();
    // The last good data stays cached so the public profile does not go blank.
    expect(doc.data).toEqual({ followers: 7 });
  });

  it('refreshes an expiring token and persists the rotated refresh token', async () => {
    const doc = makeDoc({
      integrationId: 'github',
      kind: 'oauth',
      status: 'connected',
      accessToken: TokenEncryption.encrypt(
        'old-access',
        'unit-test-encryption-key',
      ),
      refreshToken: TokenEncryption.encrypt(
        'old-refresh',
        'unit-test-encryption-key',
      ),
      tokenExpiresAt: new Date(Date.now() - 1000),
    });
    model.findOne = jest.fn(() => chain(doc));
    model.findOneAndUpdate = jest.fn(() => chain(doc));
    model.findById = jest.fn(() => chain(doc));
    github.refreshTokens.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    await service.sync(USER_ID, 'github');

    expect(github.refreshTokens).toHaveBeenCalledWith('old-refresh');
    expect(github.fetchData).toHaveBeenCalledWith('new-access');
    expect(
      TokenEncryption.decrypt(doc.refreshToken, 'unit-test-encryption-key'),
    ).toBe('new-refresh');
    expect(doc.syncStatus).toBe('ok');
    expect(doc.data).toEqual({ followers: 7 });
  });

  it('skips a sync that another worker already holds', async () => {
    const doc = makeDoc({
      integrationId: 'github',
      kind: 'oauth',
      status: 'connected',
    });
    model.findOne = jest.fn(() => chain(doc));
    model.findOneAndUpdate = jest.fn(() => chain(null)); // lease not acquired
    model.findById = jest.fn(() => chain(doc));

    await service.sync(USER_ID, 'github');

    expect(github.fetchData).not.toHaveBeenCalled();
  });

  it('revokes at the provider and wipes credentials and data on disconnect', async () => {
    const doc = makeDoc({
      integrationId: 'github',
      kind: 'oauth',
      status: 'connected',
      handle: '@ada',
      accessToken: TokenEncryption.encrypt(
        'gho_live',
        'unit-test-encryption-key',
      ),
      refreshToken: TokenEncryption.encrypt(
        'ghr_live',
        'unit-test-encryption-key',
      ),
      data: { followers: 7 },
    });
    model.findOne = jest.fn(() => chain(doc));

    const dto = await service.disconnect(USER_ID, 'github');

    expect(github.revokeToken).toHaveBeenCalledWith('gho_live');
    expect(doc.accessToken).toBeUndefined();
    expect(doc.refreshToken).toBeUndefined();
    expect(doc.data).toEqual({});
    expect(dto.status).toBe('disconnected');
    expect(dto.handle).toBeUndefined();
  });

  it('only ever redirects to the configured frontend', () => {
    const url = service.buildFrontendRedirect({ connected: 'github' });
    expect(url).toBe(
      'http://localhost:3000/dashboard/integrations?connected=github',
    );
  });
});
