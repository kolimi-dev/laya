import { beforeEach, describe, expect, it } from 'vitest';
import {
  CompletionEvent,
  Task,
  TaskGroup,
  TaskMilestone,
  UserId,
} from '../domain/types.js';
import { InMemoryTrackerRepository } from './in-memory-tracker-repository.js';

describe('Tracker Storage & Append-Only Event Store', () => {
  let repo: InMemoryTrackerRepository;
  const userId: UserId = 'usr_01H7AB12C3D4E5F6G7H8J9K0L1';

  beforeEach(() => {
    repo = new InMemoryTrackerRepository();
  });

  describe('Task Groups CRUD & Soft Deletes', () => {
    it('creates and retrieves groups ordered by sortOrder', async () => {
      const g2: TaskGroup = {
        id: 'grp_01H7AF12C3D4E5F6G7H8J9K002',
        userId,
        name: 'Office & Work',
        sortOrder: 2,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };
      const g1: TaskGroup = {
        id: 'grp_01H7AF12C3D4E5F6G7H8J9K001',
        userId,
        name: 'Health & Fitness',
        sortOrder: 1,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };

      await repo.createGroup(g2);
      await repo.createGroup(g1);

      const groups = await repo.getGroupsByUserId(userId);
      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe('Health & Fitness');
      expect(groups[1].name).toBe('Office & Work');
    });

    it('soft-deletes group without permanent data destruction', async () => {
      const g: TaskGroup = {
        id: 'grp_01H7AF12C3D4E5F6G7H8J9K001',
        userId,
        name: 'Temporary Group',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };
      await repo.createGroup(g);
      await repo.softDeleteGroup(g.id, userId);

      const activeGroups = await repo.getGroupsByUserId(userId);
      expect(activeGroups).toHaveLength(0);
    });
  });

  describe('Tasks & Milestones CRUD', () => {
    it('creates task with discrete milestones and retrieves together', async () => {
      const task: Task = {
        id: 'tsk_01H7AC12C3D4E5F6G7H8J9K001',
        userId,
        title: 'Drink 3L Water',
        taskType: 'milestone',
        recurrence: 'daily',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };
      const milestones: TaskMilestone[] = [
        { id: 'mls_01H7AD12C3D4E5F6G7H8J9K0M1', taskId: task.id, label: '1L', stepOrder: 1, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' },
        { id: 'mls_01H7AD12C3D4E5F6G7H8J9K0M2', taskId: task.id, label: '2L', stepOrder: 2, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' },
        { id: 'mls_01H7AD12C3D4E5F6G7H8J9K0M3', taskId: task.id, label: '3L', stepOrder: 3, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' },
      ];

      await repo.createTask(task, milestones);

      const retrieved = await repo.getTaskById(task.id, userId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.task.title).toBe('Drink 3L Water');
      expect(retrieved?.milestones).toHaveLength(3);
      expect(retrieved?.milestones[0].label).toBe('1L');
    });

    it('archives completed challenge (hides from active list while preserving past context)', async () => {
      const task: Task = {
        id: 'tsk_01H7AC12C3D4E5F6G7H8J9K002',
        userId,
        title: 'Read Clean Architecture in 30 Days',
        taskType: 'percentage',
        recurrence: 'daily',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };
      await repo.createTask(task);

      // Verify active
      const activeBefore = await repo.getTasksByUserId(userId, false);
      expect(activeBefore).toHaveLength(1);

      // Archive task
      await repo.archiveTask(task.id, userId);

      // Verify hidden from default active list
      const activeAfter = await repo.getTasksByUserId(userId, false);
      expect(activeAfter).toHaveLength(0);

      // Verify still preserved when including archived
      const allTasks = await repo.getTasksByUserId(userId, true);
      expect(allTasks).toHaveLength(1);
      expect(allTasks[0].task.archivedAt).toBeDefined();
    });
  });

  describe('Append-Only Event Store & Mobile Idempotency', () => {
    const event: CompletionEvent = {
      id: 'evt_01H7AE12C3D4E5F6G7H8J9K0E1',
      taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K001',
      userId,
      status: 'done',
      notes: 'Morning run completed',
      occurredAt: '2026-11-07T07:00:00.000Z',
      recordedAt: '2026-11-07T07:00:01.000Z',
      createdAt: '2026-11-07T07:00:01.000Z',
      updatedAt: '2026-11-07T07:00:01.000Z',
    };

    it('records an event to the append-only stream', async () => {
      const res = await repo.recordEvent(event);
      expect(res.recorded).toBe(true);
      expect(res.isDuplicate).toBe(false);
      expect(res.event.id).toBe(event.id);

      const events = await repo.getEventsForUser(userId);
      expect(events).toHaveLength(1);
    });

    it('guarantees idempotency on duplicate client event retries (ADR-0003)', async () => {
      // First submission
      const res1 = await repo.recordEvent(event);
      expect(res1.recorded).toBe(true);

      // Mobile network retry with the exact same client event ID
      const res2 = await repo.recordEvent(event);
      expect(res2.recorded).toBe(false);
      expect(res2.isDuplicate).toBe(true);
      expect(res2.event.id).toBe(event.id);

      // Total events count remains exactly 1 (no duplicate points or corrupted consistency ratings)
      const events = await repo.getEventsForUser(userId);
      expect(events).toHaveLength(1);
    });
  });

  describe('Integrated getTodayChecklist & Data Portability', () => {
    it('evaluates today checklist directly through repository adapter', async () => {
      const group: TaskGroup = {
        id: 'grp_01H7AF12C3D4E5F6G7H8J9K001',
        userId,
        name: 'Health',
        schedule: { cadence: { type: 'daily' } },
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };
      const task: Task = {
        id: 'tsk_01H7AC12C3D4E5F6G7H8J9K001',
        userId,
        groupId: group.id,
        title: 'Morning Yoga',
        taskType: 'checklist',
        recurrence: 'daily',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };
      const event: CompletionEvent = {
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0E2',
        taskId: task.id,
        userId,
        status: 'done',
        occurredAt: '2026-11-07T08:00:00.000Z',
        recordedAt: '2026-11-07T08:00:01.000Z',
        createdAt: '2026-11-07T08:00:01.000Z',
        updatedAt: '2026-11-07T08:00:01.000Z',
      };

      await repo.createGroup(group);
      await repo.createTask(task);
      await repo.recordEvent(event);

      const checklist = await repo.getTodayChecklist({
        userId,
        referenceTime: '2026-11-07T12:00:00.000Z',
      });

      expect(checklist.operationalDate).toBe('2026-11-07');
      expect(checklist.items).toHaveLength(1);
      expect(checklist.items[0].evaluation.status).toBe('done');
      expect(checklist.overallConsistency.consistencyPercentage).toBe(100.0);
    });

    it('exports and restores full user dataset (Data Portability)', async () => {
      const group: TaskGroup = {
        id: 'grp_01H7AF12C3D4E5F6G7H8J9K001',
        userId,
        name: 'Fitness',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };
      const task: Task = {
        id: 'tsk_01H7AC12C3D4E5F6G7H8J9K001',
        userId,
        groupId: group.id,
        title: 'Pushups',
        taskType: 'checklist',
        recurrence: 'daily',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };
      await repo.createGroup(group);
      await repo.createTask(task);

      // Export
      const exported = await repo.exportUserData(userId);
      expect(exported.groups).toHaveLength(1);
      expect(exported.tasks).toHaveLength(1);

      // Restore into fresh repository
      const freshRepo = new InMemoryTrackerRepository();
      const importResult = await freshRepo.importUserData('usr_01H7AB12C3D4E5F6G7H8J9K0L2', {
        groups: exported.groups,
        tasks: exported.tasks,
        milestones: exported.milestones,
        events: exported.events,
      });

      expect(importResult.importedGroups).toBe(1);
      expect(importResult.importedTasks).toBe(1);

      const restoredTasks = await freshRepo.getTasksByUserId('usr_01H7AB12C3D4E5F6G7H8J9K0L2');
      expect(restoredTasks).toHaveLength(1);
      expect(restoredTasks[0].task.title).toBe('Pushups');
    });
  });
});
