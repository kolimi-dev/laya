import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { TrackerRepository } from '../storage/tracker-repository.js';
import { GroupId, UserId } from '../domain/types.js';
import { GroupIdSchema } from '../domain/schemas.js';
import { evaluateTaskProgress } from '../math/task-evaluator.js';
import {
  calculateGroupConsistencyScores,
  GroupEvaluationItem,
} from '../math/consistency-engine.js';

export interface ConsistencyRouteOptions extends FastifyPluginOptions {
  repository: TrackerRepository;
}

const ConsistencySummaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupId: z.union([GroupIdSchema, z.literal('unassigned')]).optional().nullable(),
});

export async function consistencyRoutes(
  app: FastifyInstance,
  opts: ConsistencyRouteOptions
): Promise<void> {
  const { repository } = opts;

  app.get('/api/v1/consistency/summary', async (request) => {
    const userId = request.user.userId as UserId;
    const query = ConsistencySummaryQuerySchema.parse(request.query);

    // 1. Fetch user's tasks, groups, and events
    const [tasksWithMilestones, groups, events] = await Promise.all([
      repository.getTasksByUserId(userId, true),
      repository.getGroupsByUserId(userId),
      repository.getEventsForUser(userId, { from: query.from, to: query.to }),
    ]);

    const groupMap = new Map<string, string>();
    for (const g of groups) {
      groupMap.set(g.id, g.name);
    }

    // Filter tasks if groupId was specified
    let targetTasks = tasksWithMilestones;
    if (query.groupId) {
      targetTasks = targetTasks.filter((t) =>
        query.groupId === 'unassigned' ? !t.task.groupId : t.task.groupId === query.groupId
      );
    }

    // 2. Evaluate each task
    const items: GroupEvaluationItem[] = [];

    for (const tm of targetTasks) {
      const taskEvents = events.filter((e) => e.taskId === tm.task.id);
      const evalResult = evaluateTaskProgress({
        task: tm.task,
        milestones: tm.milestones,
        events: taskEvents,
      });
      const groupName = tm.task.groupId ? groupMap.get(tm.task.groupId) : undefined;

      items.push({
        evaluation: evalResult,
        groupId: tm.task.groupId,
        groupName,
      });
    }

    // 3. Compute consistency scores
    const { overall, groups: groupSummaries } = calculateGroupConsistencyScores(items);

    return {
      overall,
      groups: groupSummaries,
      window: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
    };
  });
}
