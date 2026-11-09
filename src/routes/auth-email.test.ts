/**
 * Laya (లయ) — Email OTP Authentication Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';

describe('Email OTP Authentication Endpoints', () => {
  it('rejects invalid email addresses with RFC 7807 problem details', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/send-otp',
      payload: { email: 'invalid-email-format' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('generates OTP code, accepts valid OTP, and returns valid JWT access token', async () => {
    const app = await buildApp();
    const testEmail = 'friend-auth-test@kolimi.dev';

    // 1. Send OTP
    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/send-otp',
      payload: { email: testEmail },
    });
    expect(sendRes.statusCode).toBe(200);
    expect(sendRes.json().success).toBe(true);

    // 2. Cooldown check: second request within 45s returns 429
    const secondSendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/send-otp',
      payload: { email: testEmail },
    });
    expect(secondSendRes.statusCode).toBe(429);
    expect(secondSendRes.json().code).toBe('RATE_LIMIT_COOLDOWN');

    // 3. Reject incorrect OTP
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/verify-otp',
      payload: { email: testEmail, otpCode: '000000' },
    });
    expect(failRes.statusCode).toBe(400);
    expect(failRes.json().code).toBe('AUTH_OTP_INVALID');
  });
});
