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
  latestVersion: '1.2.0',
  apkUrl: 'https://expo.dev/artifacts/eas/ATi2z7zZMCRsvyUQePf_3n4rp9KIueeXkEUOcK1YSgs.apk',
  releaseNotes: [
    'Honest Reality 60/40 visual scaling for Volume Bars: 100% target baseline with bonus surge (>100%)',
    'Retroactive check-in calculation fix for Continuity Ring with time-horizon context badges',
    'Instant Chart Discovery: Category-first Add Chart flow with live search and smart visualizer auto-pairing',
    'Deep-Press Drag & 60fps Routine Reordering: Arrange daily habits directly on Today’s Rhythm',
    'Life Dimension Studio: Dynamic group management with live card preview, 8-palette color picker, and reordering',
    '1-tap chart pinning from Master Catalog with WCAG touch target compliance',
  ],
};

export async function appVersionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/app/version', async () => {
    return APP_VERSION_MANIFEST;
  });
}

