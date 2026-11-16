import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { appVersionRoutes, APP_VERSION_MANIFEST } from './app-version.js';

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
    expect(body.latestVersion).toBe(APP_VERSION_MANIFEST.latestVersion);
    expect(body.apkUrl).toContain('.apk');
    expect(Array.isArray(body.releaseNotes)).toBe(true);
    expect(body.releaseNotes.length).toBeGreaterThan(0);
  });

  it('GET /download redirects 302 to the latest APK artifact', async () => {
    const app = Fastify();
    await app.register(appVersionRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/download',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('.apk');
  });
});
