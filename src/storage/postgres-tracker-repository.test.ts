/**
 * Laya (లయ) — PostgreSQL Tracker Repository Integration Tests
 * Validates CRUD, milestone cascades, and append-only event stream against live database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSql, closeDatabaseConnection } from './db.js';
import { PostgresTrackerRepository } from './postgres-tracker-repository.js';
import { Task, TaskGroup, TaskMilestone, UserId } from '../domain/types.js';

describe('PostgresTrackerRepository Live Neon DB Suite', () => {
  const sql = getSql();
  const testUserId: UserId = `usr_test_${Date.now()}`;
  let repo: PostgresTrackerRepository;

  beforeAll(() => {
    if (sql) {
      repo = new PostgresTrackerRepository(sql);
    }
  });

  afterAll(async () => {
    if (sql) {
      // Clean up test data
      await sql`DELETE FROM tracker.completion_events WHERE user_id = ${testUserId}`.catch(() => {});
      await sql`DELETE FROM tracker.tasks WHERE user_id = ${testUserId}`.catch(() => {});
      await sql`DELETE FROM tracker.groups WHERE user_id = ${testUserId}`.catch(() => {});
      await closeDatabaseConnection();
    }
  });

  it('persists and retrieves groups with sortOrder', async () => {
    if (!sql) return;

    const group: TaskGroup = {
      id: `grp_test_${Date.now()}` as any,
      userId: testUserId,
      name: 'Hydration & Health',
      color: '#06B6D4',
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await repo.createGroup(group);
    expect(created.name).toBe('Hydration & Health');
    expect(created.color).toBe('#06B6D4');

    const fetched = await repo.getGroupById(group.id, testUserId);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Hydration & Health');

    const allGroups = await repo.getGroupsByUserId(testUserId);
    expect(allGroups.length).toBeGreaterThanOrEqual(1);
  });

  it('creates task with discrete milestones and retrieves together', async () => {
    if (!sql) return;

    const taskId = `tsk_test_${Date.now()}` as any;
    const task: Task = {
      id: taskId,
      userId: testUserId,
      title: 'Drink 4 L Water',
      taskType: 'percentage',
      recurrence: 'daily',
      targetValue: 4,
      unit: 'L',
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const milestones: TaskMilestone[] = [
      { id: `mls_1_${Date.now()}` as any, taskId, label: '1L', stepOrder: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `mls_2_${Date.now()}` as any, taskId, label: '2L', stepOrder: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];

    const result = await repo.createTask(task, milestones);
    expect(result.task.title).toBe('Drink 4 L Water');
    expect(result.milestones).toHaveLength(2);

    const fetched = await repo.getTaskById(taskId, testUserId);
    expect(fetched).not.toBeNull();
    expect(fetched?.task.title).toBe('Drink 4 L Water');
    expect(fetched?.milestones).toHaveLength(2);
  });

  it('records idempotent completion events and computes checklist', async () => {
    if (!sql) return;

    const taskId = `tsk_event_${Date.now()}` as any;
    await repo.createTask({
      id: taskId,
      userId: testUserId,
      title: 'Evening Stretching',
      taskType: 'checklist',
      recurrence: 'daily',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const eventId = `evt_test_${Date.now()}`;
    const firstResult = await repo.recordEvent({
      id: eventId,
      taskId,
      userId: testUserId,
      status: 'done',
      occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(firstResult.recorded).toBe(true);
    expect(firstResult.isDuplicate).toBe(false);

    // Idempotent duplicate check
    const duplicateResult = await repo.recordEvent({
      id: eventId,
      taskId,
      userId: testUserId,
      status: 'done',
      occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(duplicateResult.recorded).toBe(true);
    expect(duplicateResult.isDuplicate).toBe(true);

    const checklist = await repo.getTodayChecklist({ userId: testUserId });
    expect(checklist).toBeDefined();
    expect(checklist.tasks.length).toBeGreaterThanOrEqual(1);
  });
});
