import 'reflect-metadata';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { OAuthStateService } from './oauth-state.service';

function makeService(secret = 'test-secret'): OAuthStateService {
  const config = { get: () => secret } as unknown as ConfigService;
  return new OAuthStateService(config);
}

describe('OAuthStateService', () => {
  let service: OAuthStateService;
  let session: any;

  beforeEach(() => {
    service = makeService();
    session = {};
  });

  it('issues a PKCE S256 challenge that matches the stored verifier', () => {
    const { codeChallenge } = service.begin(session, 'github', 'login');

    const expected = createHash('sha256')
      .update(session.oauthFlow.codeVerifier)
      .digest('base64url');
    expect(codeChallenge).toBe(expected);
    // RFC 7636: the verifier must be 43–128 characters.
    expect(session.oauthFlow.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(session.oauthFlow.codeVerifier.length).toBeLessThanOrEqual(128);
  });

  it('completes a flow started in the same session', () => {
    const { state } = service.begin(session, 'github', 'login');
    const flow = service.consume(session, 'github', state);

    expect(flow.purpose).toBe('login');
    expect(flow.codeVerifier).toBeTruthy();
  });

  it('makes a state single-use', () => {
    const { state } = service.begin(session, 'github', 'login');
    service.consume(session, 'github', state);

    expect(() => service.consume(session, 'github', state)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a state presented in a different session (CSRF)', () => {
    const { state } = service.begin(session, 'github', 'login');
    const victimSession: any = {};
    service.begin(victimSession, 'github', 'login');

    expect(() => service.consume(victimSession, 'github', state)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a state when no flow was started', () => {
    const { state } = service.begin({} as any, 'github', 'login');
    expect(() => service.consume(session, 'github', state)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a state issued for another provider', () => {
    const { state } = service.begin(session, 'github', 'login');
    expect(() => service.consume(session, 'google', state)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a state signed with a different secret', () => {
    const forged = makeService('attacker-secret').begin(
      {} as any,
      'github',
      'login',
    );
    service.begin(session, 'github', 'login');

    expect(() => service.consume(session, 'github', forged.state)).toThrow(
      UnauthorizedException,
    );
  });

  it('does not let a login state complete an integration flow', () => {
    service.begin(session, 'github', 'integration');
    const loginState = service.createState(
      'github',
      session.oauthFlow.nonce,
      'login',
    );

    expect(() => service.consume(session, 'github', loginState)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a non-string state', () => {
    service.begin(session, 'github', 'login');
    expect(() =>
      service.consume(session, 'github', ['a', 'b'] as unknown as string),
    ).toThrow(UnauthorizedException);
  });
});
