/**
 * Laya (లయ) — Closed-Beta Telemetry & Diagnostic Ingestion Route
 * Receives anonymized usage patterns, UI flow metrics, and device logs
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserId } from '../domain/types.js';

const TelemetryEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.enum(['action', 'navigation', 'error', 'session']),
  name: z.string(),
  data: z.record(z.string(), z.any()).optional(),
  device: z.record(z.string(), z.any()).optional(),
});

const IngestTelemetrySchema = z.object({
  events: z.array(TelemetryEventSchema),
});

// In-memory telemetry buffer for beta testing
const betaTelemetryStore: Array<z.infer<typeof TelemetryEventSchema> & { userId: UserId; receivedAt: string }> = [];

export async function telemetryRoutes(app: FastifyInstance): Promise<void> {
  // 1. Ingest batch telemetry events from mobile / web client
  app.post('/api/v1/telemetry', async (request, reply) => {
    const userId = request.user.userId as UserId;
    const body = IngestTelemetrySchema.parse(request.body);
    const now = new Date().toISOString();

    for (const ev of body.events) {
      betaTelemetryStore.push({
        ...ev,
        userId,
        receivedAt: now,
      });
    }

    // Keep memory bounded to last 2000 events
    if (betaTelemetryStore.length > 2000) {
      betaTelemetryStore.splice(0, betaTelemetryStore.length - 2000);
    }

    reply.status(201);
    return {
      success: true,
      ingestedCount: body.events.length,
      totalStored: betaTelemetryStore.length,
    };
  });

  // 2. Query aggregated beta telemetry logs
  app.get('/api/v1/telemetry', async (request) => {
    const query = request.query as { limit?: string; type?: string };
    const limit = Math.min(500, parseInt(query.limit || '100', 10));

    let logs = betaTelemetryStore;
    if (query.type) {
      logs = logs.filter((l) => l.type === query.type);
    }

    const slice = logs.slice(-limit).reverse();
    return {
      totalLogs: betaTelemetryStore.length,
      returnedCount: slice.length,
      logs: slice,
    };
  });
}
