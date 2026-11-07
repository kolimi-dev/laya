import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { randomUUID } from 'node:crypto';
import { TrackerRepository } from '../storage/tracker-repository.js';
import { GroupId, TaskGroup, UserId } from '../domain/types.js';
import {
  CreateTaskGroupInputSchema,
  GroupIdSchema,
  UpdateTaskGroupInputSchema,
} from '../domain/schemas.js';
import { GroupNotFoundError } from '../domain/errors.js';

export interface GroupRouteOptions extends FastifyPluginOptions {
  repository: TrackerRepository;
}

export async function groupRoutes(app: FastifyInstance, opts: GroupRouteOptions): Promise<void> {
  const { repository } = opts;

  // 1. List user's groups
  app.get('/api/v1/groups', async (request) => {
    const userId = request.user.userId as UserId;
    const groups = await repository.getGroupsByUserId(userId);
    return { groups };
  });

  // 2. Create group
  app.post('/api/v1/groups', async (request, reply) => {
    const userId = request.user.userId as UserId;
    const body = CreateTaskGroupInputSchema.parse(request.body);

    const now = new Date().toISOString();
    const groupId: GroupId = `grp_${randomUUID().replace(/-/g, '')}`;

    const newGroup: TaskGroup = {
      id: groupId,
      userId,
      name: body.name,
      color: body.color,
      sortOrder: body.sortOrder ?? 0,
      schedule: body.schedule,
      quietWindows: body.quietWindows,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    const created = await repository.createGroup(newGroup);
    reply.status(201);
    return { group: created };
  });

  // 3. Get single group by ID
  app.get('/api/v1/groups/:id', async (request) => {
    const userId = request.user.userId as UserId;
    const { id } = request.params as { id: string };
    const validGroupId = GroupIdSchema.parse(id) as GroupId;

    const group = await repository.getGroupById(validGroupId, userId);
    if (!group) {
      throw new GroupNotFoundError(validGroupId);
    }

    return { group };
  });

  // 4. Update group
  app.patch('/api/v1/groups/:id', async (request) => {
    const userId = request.user.userId as UserId;
    const { id } = request.params as { id: string };
    const validGroupId = GroupIdSchema.parse(id) as GroupId;
    const body = UpdateTaskGroupInputSchema.parse(request.body);

    const updated = await repository.updateGroup(validGroupId, userId, body);
    return { group: updated };
  });

  // 5. Soft-delete group
  app.delete('/api/v1/groups/:id', async (request, reply) => {
    const userId = request.user.userId as UserId;
    const { id } = request.params as { id: string };
    const validGroupId = GroupIdSchema.parse(id) as GroupId;

    await repository.softDeleteGroup(validGroupId, userId);
    reply.status(204);
  });
}
