import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { GoogleOAuthProvider } from './google.provider';

const CLIENT_ID = 'client-123.apps.googleusercontent.com';

function makeProvider(): GoogleOAuthProvider {
  const values: Record<string, string> = {
    'google.clientId': CLIENT_ID,
    'google.clientSecret': 'secret',
    'google.callbackUrl': 'http://localhost:3001/api/v1/auth/google/callback',
  };
  return new GoogleOAuthProvider({
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService);
}

function idToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256' })}.${encode(claims)}.signature`;
}

const validClaims = () => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '1234567890',
  exp: Math.floor(Date.now() / 1000) + 600,
  nonce: 'nonce-abc',
  email: 'ada@example.com',
  email_verified: true,
  name: 'Ada Lovelace',
});

describe('GoogleOAuthProvider', () => {
  const provider = makeProvider();

  it('sends PKCE and a nonce in the authorization request', () => {
    const url = new URL(
      provider.buildAuthorizeUrl({
        state: 'state-1',
        codeChallenge: 'challenge-1',
        nonce: 'nonce-abc',
      }),
    );

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('nonce')).toBe('nonce-abc');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.search).not.toContain('secret');
  });

  it('accepts a valid ID token and uses `sub` as the identity key', async () => {
    const identity = await provider.fetchIdentity(
      { accessToken: 'at', idToken: idToken(validClaims()) },
      'nonce-abc',
    );

    expect(identity.providerId).toBe('1234567890');
    expect(identity.email).toBe('ada@example.com');
    expect(identity.emailVerified).toBe(true);
  });

  it.each([
    ['a foreign issuer', { iss: 'https://evil.example' }],
    [
      'a different audience',
      { aud: 'someone-else.apps.googleusercontent.com' },
    ],
    ['an expired token', { exp: Math.floor(Date.now() / 1000) - 10 }],
    ['a mismatched nonce', { nonce: 'other-nonce' }],
    ['a missing subject', { sub: undefined }],
  ])('rejects %s', async (_label, override) => {
    await expect(
      provider.fetchIdentity(
        {
          accessToken: 'at',
          idToken: idToken({ ...validClaims(), ...override }),
        },
        'nonce-abc',
      ),
    ).rejects.toThrow();
  });

  it('rejects a response without an ID token', async () => {
    await expect(
      provider.fetchIdentity({ accessToken: 'at' }, 'nonce-abc'),
    ).rejects.toThrow();
  });

  it('does not treat an unverified email as verified', async () => {
    const identity = await provider.fetchIdentity(
      {
        accessToken: 'at',
        idToken: idToken({ ...validClaims(), email_verified: false }),
      },
      'nonce-abc',
    );
    expect(identity.emailVerified).toBe(false);
  });
});
