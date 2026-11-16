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
  latestVersion: '1.2.1',
  apkUrl: 'https://expo.dev/artifacts/eas/ra4OzaLXosz5S_VBE3VvSCI6dfGQVntiERL9FQQDfmI.apk',
  releaseNotes: [
    'Restored classic Laya brand identity and app icon',
    'Human-friendly flexible baseline descriptions (Alternative Ways to Complete)',
    'Past date quantified editing fix with monotonic retroactive timestamp ordering',
    'Today’s remaining task counts in group selector dropdown',
    'Context-aware task creation alerts with 1-tap navigation to Today’s Rhythm',
    'Deep-Press Drag & 60fps Routine Reordering directly on Today’s Rhythm',
  ],
};

export async function appVersionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/app/version', async () => {
    return APP_VERSION_MANIFEST;
  });
}

