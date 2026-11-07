import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      service: 'laya',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  });
}
