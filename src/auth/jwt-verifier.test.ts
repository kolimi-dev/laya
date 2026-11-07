import { describe, expect, it } from 'vitest';
import * as jose from 'jose';
import { LocalKeyVerifier, MockJwtVerifier } from './jwt-verifier.js';
import { ExpiredTokenError, InvalidTokenError } from '../domain/errors.js';

describe('JwtVerifier', () => {
  const ISSUER = 'https://platform.kolimi.dev';
  const AUDIENCE = 'kolimi_studio_apps';

  it('verifies valid RS256 token and extracts AuthenticatedUser claims', async () => {
    const { privateKey, publicKey } = await jose.generateKeyPair('RS256');

    const token = await new jose.SignJWT({
      phone: '+919876543210',
      roles: ['user'],
      sid: 'sid_session_123',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_alice_123')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const verifier = new LocalKeyVerifier({ publicKey, issuer: ISSUER, audience: AUDIENCE });
    const user = await verifier.verifyToken(token);

    expect(user.userId).toBe('usr_alice_123');
    expect(user.phone).toBe('+919876543210');
    expect(user.roles).toEqual(['user']);
    expect(user.sessionId).toBe('sid_session_123');
  });

  it('rejects token signed with an untrusted key', async () => {
    const { privateKey } = await jose.generateKeyPair('RS256');
    const { publicKey: wrongPublicKey } = await jose.generateKeyPair('RS256');

    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_bob_456')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const verifier = new LocalKeyVerifier({
      publicKey: wrongPublicKey,
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    await expect(verifier.verifyToken(token)).rejects.toThrow(InvalidTokenError);
  });

  it('rejects expired token with ExpiredTokenError', async () => {
    const { privateKey, publicKey } = await jose.generateKeyPair('RS256');

    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_carol_789')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(privateKey);

    const verifier = new LocalKeyVerifier({ publicKey, issuer: ISSUER, audience: AUDIENCE });

    await expect(verifier.verifyToken(token)).rejects.toThrow(ExpiredTokenError);
  });

  it('rejects token with missing or non-prefixed subject', async () => {
    const { privateKey, publicKey } = await jose.generateKeyPair('RS256');

    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('invalid_user_without_prefix')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const verifier = new LocalKeyVerifier({ publicKey, issuer: ISSUER, audience: AUDIENCE });

    await expect(verifier.verifyToken(token)).rejects.toThrow(InvalidTokenError);
  });

  it('rejects token with incorrect issuer or audience', async () => {
    const { privateKey, publicKey } = await jose.generateKeyPair('RS256');

    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_dave_101')
      .setIssuer('https://malicious.issuer.com')
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const verifier = new LocalKeyVerifier({ publicKey, issuer: ISSUER, audience: AUDIENCE });

    await expect(verifier.verifyToken(token)).rejects.toThrow(InvalidTokenError);
  });

  it('MockJwtVerifier produces deterministic user and rejects invalid/expired tokens', async () => {
    const mock = new MockJwtVerifier();

    const user = await mock.verifyToken('valid_token');
    expect(user.userId).toBe('usr_mock_test_123');

    await expect(mock.verifyToken('invalid')).rejects.toThrow(InvalidTokenError);
    await expect(mock.verifyToken('expired')).rejects.toThrow(ExpiredTokenError);
  });
});
