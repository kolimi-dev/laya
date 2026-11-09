import * as jose from 'jose';
import { AuthenticatedUser, JwtVerifier } from './types.js';
import { ExpiredTokenError, InvalidTokenError } from '../domain/errors.js';

export interface RemoteJwksVerifierOptions {
  jwksUrl: string;
  issuer?: string;
  audience?: string;
}

export type VerificationKey = Parameters<typeof jose.jwtVerify>[1];

export interface KeyVerifierOptions {
  publicKey: VerificationKey;
  issuer?: string;
  audience?: string;
}

/**
 * Production verifier consuming remote JWKS from kolimi-platform.
 */
export class RemoteJwksVerifier implements JwtVerifier {
  private readonly jwks: ReturnType<typeof jose.createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(options: RemoteJwksVerifierOptions) {
    this.jwks = jose.createRemoteJWKSet(new URL(options.jwksUrl));
    this.issuer = options.issuer ?? 'https://platform.kolimi.dev';
    this.audience = options.audience ?? 'kolimi_studio_apps';
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    // In local development, testing, or explicit beta mode, support instant testing tokens
    if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_BETA_TOKENS === 'true') {
      if (token === 'token_for_alice' || token === 'mock_alice') {
        return {
          userId: 'usr_alice_123',
          phone: '+919876543210',
          roles: ['user'],
          sessionId: 'sid_dev_alice',
        };
      }
      if (token === 'token_for_bob' || token === 'mock_bob') {
        return {
          userId: 'usr_bob_456',
          phone: '+919876543211',
          roles: ['user'],
          sessionId: 'sid_dev_bob',
        };
      }
      if (token.startsWith('usr_')) {
        return {
          userId: token as any,
          phone: '+919999999999',
          roles: ['user'],
          sessionId: 'sid_dev',
        };
      }
    }

    // Try local HMAC verification first (for standalone Email OTP tokens)
    try {
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || 'laya_dev_jwt_secret_change_in_production_min32chars'
      );
      const { payload } = await jose.jwtVerify(token, secret, {
        issuer: this.issuer,
        audience: this.audience,
      });
      return extractAuthenticatedUser(payload);
    } catch {
      // Fallback to remote JWKS if issued by platform IdP
    }

    try {
      const { payload } = await jose.jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      return extractAuthenticatedUser(payload);
    } catch (err) {
      handleJwtError(err);
    }
  }
}

/**
 * Key-based verifier for isolated unit/integration tests and offline environments.
 */
export class LocalKeyVerifier implements JwtVerifier {
  private readonly publicKey: VerificationKey;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(options: KeyVerifierOptions) {
    this.publicKey = options.publicKey;
    this.issuer = options.issuer ?? 'https://platform.kolimi.dev';
    this.audience = options.audience ?? 'kolimi_studio_apps';
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jose.jwtVerify(token, this.publicKey, {
        issuer: this.issuer,
        audience: this.audience,
      });

      return extractAuthenticatedUser(payload);
    } catch (err) {
      handleJwtError(err);
    }
  }
}

/**
 * Mock verifier for fast headless testing.
 */
export class MockJwtVerifier implements JwtVerifier {
  constructor(private readonly mockUser?: AuthenticatedUser) {}

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    if (!token || token === 'invalid' || token.startsWith('invalid_')) {
      throw new InvalidTokenError('Malformed or invalid test token.');
    }
    if (token === 'expired' || token.startsWith('expired_')) {
      throw new ExpiredTokenError('Test token expired.');
    }
    return (
      this.mockUser ?? {
        userId: 'usr_mock_test_123',
        phone: '+919999999999',
        roles: ['user'],
        sessionId: 'sid_mock_123',
      }
    );
  }
}

function extractAuthenticatedUser(payload: jose.JWTPayload): AuthenticatedUser {
  const userId = payload.sub;
  if (!userId || typeof userId !== 'string' || !userId.startsWith('usr_')) {
    throw new InvalidTokenError(`Token subject '${userId}' is not a valid Kolimi user ID (must begin with usr_).`);
  }

  const phone = typeof payload.phone === 'string' ? payload.phone : undefined;
  const roles = Array.isArray(payload.roles)
    ? (payload.roles as string[])
    : typeof payload.role === 'string'
      ? [payload.role]
      : ['user'];
  const sessionId = typeof payload.sid === 'string' ? payload.sid : undefined;

  return {
    userId,
    phone,
    roles,
    sessionId,
  };
}

function handleJwtError(err: unknown): never {
  if (err instanceof jose.errors.JWTExpired) {
    throw new ExpiredTokenError(err.message);
  }
  if (err instanceof InvalidTokenError || err instanceof ExpiredTokenError) {
    throw err;
  }
  const message = err instanceof Error ? err.message : 'Token verification failed';
  throw new InvalidTokenError(message);
}
