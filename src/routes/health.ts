import { FastifyInstance } from 'fastify';
import { getSql, checkDatabaseConnection } from '../storage/db.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      service: 'laya',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/api/v1/ready', async (request, reply) => {
    const sql = getSql();
    if (!sql) {
      return { status: 'ready', database: 'in-memory' };
    }

    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      return reply.status(503).send({ status: 'unready', database: 'unreachable' });
    }

    return { status: 'ready', database: 'connected' };
  });
}
