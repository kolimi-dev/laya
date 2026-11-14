import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { appVersionRoutes } from './app-version.js';

describe('App Version Manifest Endpoint', () => {
  it('GET /api/v1/app/version returns 200 with valid update manifest', async () => {
    const app = Fastify();
    await app.register(appVersionRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/app/version',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.latestVersion).toBe('1.1.0');
    expect(body.apkUrl).toContain('.apk');
    expect(Array.isArray(body.releaseNotes)).toBe(true);
    expect(body.releaseNotes.length).toBeGreaterThan(0);
  });
});
