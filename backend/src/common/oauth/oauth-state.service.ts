import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Session, SessionData } from 'express-session';

/** How long an authorization request stays valid. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** What the authorization request is for. */
export type OAuthPurpose = 'login' | 'link' | 'integration';

export interface OAuthStatePayload {
  /** Random nonce, also stored in the session. */
  n: string;
  /** Provider the state was issued for. */
  p: string;
  /** Issued-at timestamp. */
  t: number;
  /** Purpose of the flow. Absent on legacy states, which are logins. */
  u?: OAuthPurpose;
}

/** The pending authorization request remembered server-side in the session. */
export interface PendingOAuthFlow {
  nonce: string;
  provider: string;
  purpose: OAuthPurpose;
  /** PKCE code verifier — never leaves the backend. */
  codeVerifier: string;
  /** OpenID Connect nonce bound to the ID token. */
  oidcNonce: string;
  createdAt: number;
}

declare module 'express-session' {
  interface SessionData {
    oauthFlow?: PendingOAuthFlow;
  }
}

export const INVALID_STATE = 'oauth_state_invalid';

/**
 * Signed `state` values and PKCE material shared by sign-in and integration
 * OAuth flows.
 *
 * CSRF protection has two independent layers: the state is HMAC-signed so it
 * cannot be forged, and its nonce must match the one stored in the visitor's
 * own session, so a state minted for one browser is useless in another.
 */
@Injectable()
export class OAuthStateService {
  constructor(private readonly configService: ConfigService) {}

  private get secret(): string {
    return (
      this.configService.get<string>('session.secret') ??
      'dev-session-secret-change-in-production'
    );
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }

  static randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /** RFC 7636 S256 challenge for a code verifier. */
  static codeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  createState(
    provider: string,
    nonce: string,
    purpose: OAuthPurpose = 'login',
  ): string {
    const payload: OAuthStatePayload = {
      n: nonce,
      p: provider,
      t: Date.now(),
      u: purpose,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  /**
   * Validates a returned `state`: the signature must match, it must have been
   * issued for this provider, it must not be expired and — when a nonce is
   * expected — it must carry that exact nonce.
   */
  verifyState(
    state: string,
    provider: string,
    expectedNonce?: string,
  ): OAuthStatePayload {
    const fail = () => new UnauthorizedException(INVALID_STATE);

    if (typeof state !== 'string' || !state.includes('.')) throw fail();

    const [encoded, signature, ...rest] = state.split('.');
    if (!encoded || !signature || rest.length > 0) throw fail();

    const given = Buffer.from(signature);
    const expected = Buffer.from(this.sign(encoded));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw fail();
    }

    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
    } catch {
      throw fail();
    }

    if (!payload || payload.p !== provider) throw fail();
    if (
      typeof payload.t !== 'number' ||
      Date.now() - payload.t > OAUTH_STATE_TTL_MS
    ) {
      throw fail();
    }
    if (expectedNonce !== undefined && payload.n !== expectedNonce)
      throw fail();

    return payload;
  }

  /**
   * Starts a flow: stores the nonce and PKCE verifier in the session and
   * returns the values that go into the provider's authorization URL.
   */
  begin(
    session: Session & Partial<SessionData>,
    provider: string,
    purpose: OAuthPurpose,
  ): { state: string; codeChallenge: string; oidcNonce: string } {
    const flow: PendingOAuthFlow = {
      nonce: OAuthStateService.randomToken(24),
      provider,
      purpose,
      codeVerifier: OAuthStateService.randomToken(48),
      oidcNonce: OAuthStateService.randomToken(24),
      createdAt: Date.now(),
    };
    session.oauthFlow = flow;

    return {
      state: this.createState(provider, flow.nonce, purpose),
      codeChallenge: OAuthStateService.codeChallenge(flow.codeVerifier),
      oidcNonce: flow.oidcNonce,
    };
  }

  /**
   * Completes a flow. The pending request is removed from the session before
   * anything else happens, so a state value can only ever be used once.
   */
  consume(
    session: Session & Partial<SessionData>,
    provider: string,
    state: string,
  ): PendingOAuthFlow {
    const flow = session.oauthFlow;
    delete session.oauthFlow;

    if (!flow || flow.provider !== provider) {
      throw new UnauthorizedException(INVALID_STATE);
    }
    if (Date.now() - flow.createdAt > OAUTH_STATE_TTL_MS) {
      throw new UnauthorizedException(INVALID_STATE);
    }

    const payload = this.verifyState(state, provider, flow.nonce);
    if ((payload.u ?? 'login') !== flow.purpose) {
      throw new UnauthorizedException(INVALID_STATE);
    }

    return flow;
  }

  /** Reads the purpose of a pending flow without consuming it. */
  peekPurpose(
    session: Session & Partial<SessionData>,
  ): OAuthPurpose | undefined {
    return session.oauthFlow?.purpose;
  }
}
