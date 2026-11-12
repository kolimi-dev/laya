/**
 * Laya (లయ) — PostgreSQL Tracker Repository Adapter
 * Implements TrackerRepository port for Neon Serverless PostgreSQL.
 * ACID guarantees, idempotent event stream, and multi-tenant isolation.
 */

import postgres from 'postgres';
import {
  ActiveChecklistResult,
  CompletionEvent,
  DayRolloverOptions,
  GroupId,
  Task,
  TaskGroup,
  TaskMilestone,
  TaskProgressStatus,
  UserId,
} from '../domain/types.js';
import { TaskNotFoundError } from '../domain/errors.js';
import { computeActiveChecklist } from '../recurrence/active-checklist.js';
import {
  RecordEventResult,
  TaskWithMilestones,
  TrackerRepository,
  UserDataExport,
  UserDataImportResult,
} from './tracker-repository.js';
import { mapRowToGroup, mapRowToTask, mapRowToMilestone, mapRowToEvent } from './db-mappers.js';
import { exportUserDataSql, importUserDataSql } from './postgres-portability-helper.js';
import {
  createGroupSql,
  getGroupByIdSql,
  getGroupsByUserIdSql,
  updateGroupSql,
  softDeleteGroupSql,
} from './postgres-group-helper.js';

export class PostgresTrackerRepository implements TrackerRepository {
  constructor(private readonly sql: postgres.Sql) {}

  // 1. Group Operations
  async createGroup(group: TaskGroup): Promise<TaskGroup> {
    return createGroupSql(this.sql, group);
  }

  async getGroupById(id: GroupId, userId: UserId): Promise<TaskGroup | null> {
    return getGroupByIdSql(this.sql, id, userId);
  }

  async getGroupsByUserId(userId: UserId): Promise<TaskGroup[]> {
    return getGroupsByUserIdSql(this.sql, userId);
  }

  async updateGroup(
    id: GroupId,
    userId: UserId,
    updates: Partial<Pick<TaskGroup, 'name' | 'color' | 'sortOrder' | 'schedule'>>
  ): Promise<TaskGroup> {
    return updateGroupSql(this.sql, id, userId, updates);
  }

  async softDeleteGroup(id: GroupId, userId: UserId): Promise<void> {
    return softDeleteGroupSql(this.sql, id, userId);
  }

  // 2. Task & Milestone Operations
  async createTask(task: Task, milestones: TaskMilestone[] = []): Promise<TaskWithMilestones> {
    const [row] = await this.sql`
      INSERT INTO tracker.tasks (
        id, user_id, group_id, title, task_type, recurrence, cycle_days,
        schedule, target_value, unit, sort_order, created_by, updated_by
      ) VALUES (
        ${task.id}, ${task.userId}, ${task.groupId ?? null}, ${task.title},
        ${task.taskType}, ${task.recurrence}, ${task.cycleDays ?? null},
        ${task.schedule ? this.sql.json(task.schedule) : null},
        ${task.targetValue ?? null}, ${task.unit ?? null}, ${task.sortOrder ?? 0},
        ${task.createdBy ?? task.userId}, ${task.updatedBy ?? task.userId}
      )
      RETURNING *
    `;
    const createdTask = mapRowToTask(row);

    const createdMilestones: TaskMilestone[] = [];
    for (const m of milestones) {
      const [mRow] = await this.sql`
        INSERT INTO tracker.task_milestones (
          id, task_id, label, step_order, created_by, updated_by
        ) VALUES (
          ${m.id}, ${task.id}, ${m.label}, ${m.stepOrder},
          ${m.createdBy ?? task.userId}, ${m.updatedBy ?? task.userId}
        )
        RETURNING *
      `;
      createdMilestones.push(mapRowToMilestone(mRow));
    }

    return { task: createdTask, milestones: createdMilestones };
  }

  async getTaskById(id: string, userId: UserId): Promise<TaskWithMilestones | null> {
    const [taskRow] = await this.sql`
      SELECT * FROM tracker.tasks
      WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    `;
    if (!taskRow) return null;

    const mRows = await this.sql`
      SELECT * FROM tracker.task_milestones
      WHERE task_id = ${id}
      ORDER BY step_order ASC
    `;
    return {
      task: mapRowToTask(taskRow),
      milestones: mRows.map(mapRowToMilestone),
    };
  }

  async getTasksByUserId(userId: UserId, includeArchived = false): Promise<TaskWithMilestones[]> {
    const taskRows = await this.sql`
      SELECT * FROM tracker.tasks
      WHERE user_id = ${userId} AND deleted_at IS NULL
        ${includeArchived ? this.sql`` : this.sql`AND archived_at IS NULL`}
      ORDER BY sort_order ASC, created_at ASC
    `;
    if (taskRows.length === 0) return [];

    const taskIds = taskRows.map((r: any) => r.id);
    const mRows = await this.sql`
      SELECT * FROM tracker.task_milestones
      WHERE task_id IN ${this.sql(taskIds)}
      ORDER BY step_order ASC
    `;

    const milestonesByTaskId = new Map<string, TaskMilestone[]>();
    for (const mRow of mRows) {
      const m = mapRowToMilestone(mRow);
      const list = milestonesByTaskId.get(m.taskId) ?? [];
      list.push(m);
      milestonesByTaskId.set(m.taskId, list);
    }

    return taskRows.map((tRow: any) => ({
      task: mapRowToTask(tRow),
      milestones: milestonesByTaskId.get(tRow.id) ?? [],
    }));
  }

  async updateTask(
    id: string,
    userId: UserId,
    updates: Partial<Pick<Task, 'title' | 'targetValue' | 'unit' | 'sortOrder' | 'schedule' | 'recurrence' | 'cycleDays'>>
  ): Promise<Task> {
    const existing = await this.getTaskById(id, userId);
    if (!existing) throw new TaskNotFoundError(id);

    const title = updates.title ?? existing.task.title;
    const targetValue = updates.targetValue !== undefined ? updates.targetValue : existing.task.targetValue;
    const unit = updates.unit !== undefined ? updates.unit : existing.task.unit;
    const sortOrder = updates.sortOrder ?? existing.task.sortOrder ?? 0;
    const schedule = updates.schedule !== undefined ? updates.schedule : existing.task.schedule;
    const recurrence = updates.recurrence ?? existing.task.recurrence;
    const cycleDays = updates.cycleDays !== undefined ? updates.cycleDays : existing.task.cycleDays;

    const [row] = await this.sql`
      UPDATE tracker.tasks
      SET title = ${title}, target_value = ${targetValue ?? null}, unit = ${unit ?? null},
          sort_order = ${sortOrder}, recurrence = ${recurrence}, cycle_days = ${cycleDays ?? null},
          schedule = ${schedule ? this.sql.json(schedule) : null},
          updated_at = NOW(), updated_by = ${userId}
      WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
      RETURNING *
    `;
    return mapRowToTask(row);
  }

  async archiveTask(id: string, userId: UserId): Promise<Task> {
    const existing = await this.getTaskById(id, userId);
    if (!existing) throw new TaskNotFoundError(id);

    const [row] = await this.sql`
      UPDATE tracker.tasks
      SET archived_at = NOW(), updated_at = NOW(), updated_by = ${userId}
      WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
      RETURNING *
    `;
    return mapRowToTask(row);
  }

  async softDeleteTask(id: string, userId: UserId): Promise<void> {
    await this.sql`
      UPDATE tracker.tasks
      SET deleted_at = NOW(), updated_at = NOW(), updated_by = ${userId}
      WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    `;
  }

  // 3. Append-Only Idempotent Event Stream
  async recordEvent(event: CompletionEvent): Promise<RecordEventResult> {
    const [inserted] = await this.sql`
      INSERT INTO tracker.completion_events (
        id, task_id, milestone_id, user_id, status, progress_percentage,
        notes, occurred_at, recorded_at, created_by, updated_by
      ) VALUES (
        ${event.id}, ${event.taskId}, ${event.milestoneId ?? null}, ${event.userId},
        ${event.status}, ${event.progressPercentage ?? null}, ${event.notes ?? null},
        ${event.occurredAt}, ${event.recordedAt || new Date().toISOString()},
        ${event.createdBy ?? event.userId}, ${event.updatedBy ?? event.userId}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `;

    if (inserted) {
      return { recorded: true, isDuplicate: false, event: mapRowToEvent(inserted) };
    }

    const [existing] = await this.sql`
      SELECT * FROM tracker.completion_events WHERE id = ${event.id}
    `;
    return { recorded: true, isDuplicate: true, event: mapRowToEvent(existing) };
  }

  async getEventsForTask(taskId: string, options?: { from?: string; to?: string }): Promise<CompletionEvent[]> {
    const rows = await this.sql`
      SELECT * FROM tracker.completion_events
      WHERE task_id = ${taskId}
        ${options?.from ? this.sql`AND occurred_at >= ${options.from}` : this.sql``}
        ${options?.to ? this.sql`AND occurred_at <= ${options.to}` : this.sql``}
      ORDER BY occurred_at DESC
    `;
    return rows.map(mapRowToEvent);
  }

  async getEventsForUser(userId: UserId, options?: { from?: string; to?: string }): Promise<CompletionEvent[]> {
    const rows = await this.sql`
      SELECT * FROM tracker.completion_events
      WHERE user_id = ${userId}
        ${options?.from ? this.sql`AND occurred_at >= ${options.from}` : this.sql``}
        ${options?.to ? this.sql`AND occurred_at <= ${options.to}` : this.sql``}
      ORDER BY occurred_at DESC
    `;
    return rows.map(mapRowToEvent);
  }

  // 4. Dynamic Checklist Evaluation
  async getTodayChecklist(params: {
    userId: UserId;
    referenceTime?: Date | string;
    dayRolloverOptions?: DayRolloverOptions;
    filter?: {
      groupId?: GroupId | 'unassigned' | null;
      status?: TaskProgressStatus | null;
    };
  }): Promise<ActiveChecklistResult> {
    const [groups, tasksWithMilestones, events] = await Promise.all([
      this.getGroupsByUserId(params.userId),
      this.getTasksByUserId(params.userId, false),
      this.getEventsForUser(params.userId),
    ]);

    return computeActiveChecklist({
      tasks: tasksWithMilestones.map((t) => t.task),
      groups,
      milestones: tasksWithMilestones.flatMap((t) => t.milestones),
      events,
      referenceTime: params.referenceTime,
      dayRolloverOptions: params.dayRolloverOptions,
      filter: params.filter,
    });
  }

  // 5. Data Portability
  async exportUserData(userId: UserId): Promise<UserDataExport> {
    return exportUserDataSql(this, userId);
  }

  async importUserData(
    userId: UserId,
    data: Omit<UserDataExport, 'exportedAt' | 'userId'>
  ): Promise<UserDataImportResult> {
    return importUserDataSql(this.sql, userId, data);
  }
}
