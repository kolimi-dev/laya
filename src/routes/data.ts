import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { TrackerRepository } from '../storage/tracker-repository.js';
import { UserId } from '../domain/types.js';

export interface DataRouteOptions extends FastifyPluginOptions {
  repository: TrackerRepository;
}

const ImportDataSchema = z.object({
  groups: z.array(z.any()).default([]),
  tasks: z.array(z.any()).default([]),
  milestones: z.array(z.any()).default([]),
  events: z.array(z.any()).default([]),
});

export async function dataRoutes(app: FastifyInstance, opts: DataRouteOptions): Promise<void> {
  const { repository } = opts;

  // 1. Export user data (Local-first GDPR Portability)
  app.get('/api/v1/data/export', async (request) => {
    const userId = request.user.userId as UserId;
    const exportData = await repository.exportUserData(userId);
    return { data: exportData };
  });

  // 2. Import / Restore backup
  app.post('/api/v1/data/import', async (request) => {
    const userId = request.user.userId as UserId;
    const body = ImportDataSchema.parse(request.body);

    const result = await repository.importUserData(userId, {
      groups: body.groups,
      tasks: body.tasks,
      milestones: body.milestones,
      events: body.events,
    });

    return {
      success: true,
      result,
    };
  });
}
