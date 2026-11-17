/**
 * Laya (లయ) Backend — In-App Update Manifest Route (ADR-0010, Phase D)
 * Public unauthenticated route serving latest APK version manifest to mobile clients
 */

import { FastifyInstance } from 'fastify';

export interface AppVersionManifest {
  latestVersion: string;
  apkUrl: string;
  releaseNotes: string[];
}

export const APP_VERSION_MANIFEST: AppVersionManifest = {
  latestVersion: '1.2.4',
  apkUrl: 'https://expo.dev/artifacts/eas/BNOI6gCpHG3z9povg2-RwxHwKdd43RY_BYNRUUfMitE.apk',
  releaseNotes: [
    'Dashboard chart deduplication: prevents duplicate charts for the same habit',
    'Mandatory habit name validation with accent asterisk and disabled submit guard',
    'Custom sleeping time profile setting (default: 8:00 PM / 20:00) with quick presets',
    'Evening Rhythm Review: daily offline notification to review habits and wind down without streak guilt',
    'Hardened task reminder notifications with dedicated Android channels',
  ],
};

let cachedManifest: AppVersionManifest = APP_VERSION_MANIFEST;
let lastFetchMs = 0;
const CACHE_TTL_MS = 60000;

export async function getLiveAppManifest(): Promise<AppVersionManifest> {
  const now = Date.now();
  if (now - lastFetchMs < CACHE_TTL_MS) {
    return cachedManifest;
  }
  try {
    const res = await fetch('https://raw.githubusercontent.com/kolimi-dev/laya-mobile/publish/version.json');
    if (res.ok) {
      const data = (await res.json()) as AppVersionManifest;
      if (data && data.latestVersion && data.apkUrl) {
        cachedManifest = data;
        lastFetchMs = now;
      }
    }
  } catch {
    // Graceful offline fallback to last cached / default
  }
  return cachedManifest;
}

export async function appVersionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/app/version', async () => {
    return getLiveAppManifest();
  });

  app.get('/download', async (_req, reply) => {
    const manifest = await getLiveAppManifest();
    return reply.redirect(manifest.apkUrl, 302);
  });

  app.get('/api/v1/app/download', async (_req, reply) => {
    const manifest = await getLiveAppManifest();
    return reply.redirect(manifest.apkUrl, 302);
  });
}

