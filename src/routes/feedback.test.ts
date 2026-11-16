import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';

describe('Universal Feedback Route', () => {
  it('accepts guest feedback without authorization header', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        category: 'compliment',
        message: 'The guilt-free Rest Day is awesome!',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.feedbackId).toMatch(/^fbk_/);
    expect(body.userId).toBe('guest');
    expect(body.category).toBe('compliment');
  });

  it('accepts detailed feedback with sender name, email, and diagnostics', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        category: 'bug',
        message: 'Habit did not roll over past midnight.',
        senderName: 'Hemanth Tester',
        email: 'tester@kolimi.dev',
        diagnostics: '• Laya v1.2.2\n• OS: android\n• Date: 2026-11-16',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.category).toBe('bug');
  });

  it('rejects message shorter than 3 characters with 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: {
        category: 'bug',
        message: 'hi',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
