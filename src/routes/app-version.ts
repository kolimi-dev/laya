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
  latestVersion: '1.2.3',
  apkUrl: 'https://expo.dev/artifacts/eas/BMTsnXw8bDxRuygY_qhx5Z15Et9RpG_8PnQ_s5F_5pA.apk',
  releaseNotes: [
    'Direct in-app feedback channel with silent delivery to development team',
    'Task creation defaults to Once (Single occurrence) instead of Daily',
    'Rebranded anytime cadence to Whenever with clear intent',
    'Habit rollover engine: uncompleted habits roll forward while keeping recurrence anchors fixed',
    'Simplified walkthrough with real-world habit examples',
    'Temporary sponsor button disabled',
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

