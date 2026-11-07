import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { TrackerRepository } from '../storage/tracker-repository.js';
import {
  CompletionEvent,
  EventId,
  GroupId,
  MilestoneId,
  Task,
  TaskId,
  TaskMilestone,
  TaskProgressStatus,
  UserId,
} from '../domain/types.js';
import {
  CreateTaskInputSchema,
  EventIdSchema,
  EventStatusSchema,
  GroupIdSchema,
  MilestoneIdSchema,
  TaskIdSchema,
  TaskProgressStatusSchema,
  UpdateTaskInputSchema,
  UtcTimestampSchema,
} from '../domain/schemas.js';
import { TaskNotFoundError } from '../domain/errors.js';

export interface TaskRouteOptions extends FastifyPluginOptions {
  repository: TrackerRepository;
}

const ActiveChecklistQuerySchema = z.object({
  groupId: z.union([GroupIdSchema, z.literal('unassigned')]).optional().nullable(),
  status: TaskProgressStatusSchema.optional().nullable(),
  asOf: z.string().optional(),
  dayCutoffHour: z.coerce.number().int().min(0).max(12).default(3),
});

const RecordEventBodySchema = z
  .object({
    id: EventIdSchema,
    milestoneId: MilestoneIdSchema.optional().nullable(),
    status: EventStatusSchema,
    progressPercentage: z
      .number()
      .min(0.0, 'Progress percentage cannot be less than 0.00')
      .max(100.0, 'Progress percentage cannot exceed 100.00')
      .optional()
      .nullable(),
    notes: z.string().trim().max(280, 'Notes cannot exceed 280 characters').optional().nullable(),
    occurredAt: UtcTimestampSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'in_progress' && data.progressPercentage === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['progressPercentage'],
        message: "progressPercentage is required when status is 'in_progress'",
      });
    }
  });

export async function taskRoutes(app: FastifyInstance, opts: TaskRouteOptions): Promise<void> {
  const { repository } = opts;

  // 1. Dynamic Active / Today's Checklist
  app.get('/api/v1/tasks/active', async (request) => {
    const userId = request.user.userId as UserId;
    const query = ActiveChecklistQuerySchema.parse(request.query);

    const checklist = await repository.getTodayChecklist({
      userId,
      referenceTime: query.asOf,
      dayRolloverOptions: {
        dayCutoffHour: query.dayCutoffHour,
      },
      filter: {
        groupId: query.groupId,
        status: query.status,
      },
    });

    return { checklist };
  });

  // 2. List Tasks
  app.get('/api/v1/tasks', async (request) => {
    const userId = request.user.userId as UserId;
    const query = request.query as { groupId?: string; includeArchived?: string };
    const includeArchived = query.includeArchived === 'true';

    let tasksWithMilestones = await repository.getTasksByUserId(userId, includeArchived);

    if (query.groupId) {
      tasksWithMilestones = tasksWithMilestones.filter(
        (t) => t.task.groupId === query.groupId
      );
    }

    return { tasks: tasksWithMilestones };
  });

  // 3. Create Polymorphic Task
  app.post('/api/v1/tasks', async (request, reply) => {
    const userId = request.user.userId as UserId;
    const body = CreateTaskInputSchema.parse(request.body);

    const now = new Date().toISOString();
    const taskId: TaskId = `tsk_${randomUUID().replace(/-/g, '')}`;

    const task: Task = {
      id: taskId,
      userId,
      groupId: body.groupId as GroupId | undefined | null,
      title: body.title,
      taskType: body.taskType,
      recurrence: body.recurrence,
      cycleDays: body.cycleDays,
      schedule: body.schedule,
      reminders: body.reminders,
      targetValue: body.targetValue,
      unit: body.unit,
      sortOrder: body.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    let milestones: TaskMilestone[] | undefined;
    if (body.taskType === 'milestone' && body.milestones && body.milestones.length > 0) {
      milestones = body.milestones.map((label, index) => ({
        id: `mls_${randomUUID().replace(/-/g, '')}` as MilestoneId,
        taskId,
        label,
        stepOrder: index + 1,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      }));
    }

    const created = await repository.createTask(task, milestones);
    reply.status(201);
    return { task: created.task, milestones: created.milestones };
  });

  // 4. Get Task by ID
  app.get('/api/v1/tasks/:id', async (request) => {
    const userId = request.user.userId as UserId;
    const { id } = request.params as { id: string };
    const validTaskId = TaskIdSchema.parse(id) as TaskId;

    const found = await repository.getTaskById(validTaskId, userId);
    if (!found) {
      throw new TaskNotFoundError(validTaskId);
    }

    return { task: found.task, milestones: found.milestones };
  });

  // 5. Update Task
  app.patch('/api/v1/tasks/:id', async (request) => {
    const userId = request.user.userId as UserId;
    const { id } = request.params as { id: string };
    const validTaskId = TaskIdSchema.parse(id) as TaskId;
    const body = UpdateTaskInputSchema.parse(request.body);

    const updated = await repository.updateTask(validTaskId, userId, body);
    return { task: updated };
  });

  // 6. Archive Task
  app.post('/api/v1/tasks/:id/archive', async (request) => {
    const userId = request.user.userId as UserId;
    const { id } = request.params as { id: string };
    const validTaskId = TaskIdSchema.parse(id) as TaskId;

    const archived = await repository.archiveTask(validTaskId, userId);
    return { task: archived };
  });

  // 7. Soft Delete Task
  app.delete('/api/v1/tasks/:id', async (request, reply) => {
    const userId = request.user.userId as UserId;
    const { id } = request.params as { id: string };
    const validTaskId = TaskIdSchema.parse(id) as TaskId;

    await repository.softDeleteTask(validTaskId, userId);
    reply.status(204);
  });

  // 8. Record Completion Event
  app.post('/api/v1/tasks/:id/events', async (request, reply) => {
    const userId = request.user.userId as UserId;
    const { id } = request.params as { id: string };
    const validTaskId = TaskIdSchema.parse(id) as TaskId;

    // Verify task exists and belongs to user
    const found = await repository.getTaskById(validTaskId, userId);
    if (!found) {
      throw new TaskNotFoundError(validTaskId);
    }

    const body = RecordEventBodySchema.parse(request.body);
    const now = new Date().toISOString();

    const event: CompletionEvent = {
      id: body.id as EventId,
      taskId: validTaskId,
      milestoneId: body.milestoneId as MilestoneId | undefined | null,
      userId,
      status: body.status,
      progressPercentage: body.progressPercentage,
      notes: body.notes,
      occurredAt: body.occurredAt ?? now,
      recordedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    const result = await repository.recordEvent(event);
    reply.status(result.isDuplicate ? 200 : 201);
    return {
      recorded: result.recorded,
      isDuplicate: result.isDuplicate,
      event: result.event,
    };
  });

  // 9. Get Task Events History
  app.get('/api/v1/tasks/:id/events', async (request) => {
    const userId = request.user.userId as UserId;
    const { id } = request.params as { id: string };
    const validTaskId = TaskIdSchema.parse(id) as TaskId;

    // Verify task ownership
    const found = await repository.getTaskById(validTaskId, userId);
    if (!found) {
      throw new TaskNotFoundError(validTaskId);
    }

    const query = request.query as { from?: string; to?: string };
    const events = await repository.getEventsForTask(validTaskId, {
      from: query.from,
      to: query.to,
    });

    return { events };
  });
}
