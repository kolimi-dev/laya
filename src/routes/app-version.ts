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
  latestVersion: '1.1.0',
  apkUrl: 'https://expo.dev/artifacts/eas/gRbzkk-L6AT8lPrboZ9k4JzajuWH4sNr273oU6A0nhI.apk',
  releaseNotes: [
    'All Habits Catalog: Complete inventory across daily, monthly, and custom rhythms',
    'Full Group Management: Create, edit, and delete groups with explicit confirmation and task remapping',
    'Universal CRUD: Edit dashboard names, delete dashboards, and clean peaceful chart View Mode',
    'Task-to-Dashboard navigation pills directly on habit cards',
    'Deterministic monotonic retroactive logging for past dates',
    'Upcoming Horizon navigation hygiene and quick-return paths',
  ],
};

export async function appVersionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/app/version', async () => {
    return APP_VERSION_MANIFEST;
  });
}

