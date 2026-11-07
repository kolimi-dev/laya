import { describe, expect, it } from 'vitest';
import { CompletionEvent, Task, TaskMilestone } from '../domain/types.js';
import { evaluateTaskProgress } from './task-evaluator.js';
import { InvalidPercentageError, InvalidTaskConfigError } from '../domain/errors.js';

describe('Task Evaluator (Multi-Flavor Progress)', () => {
  const baseAudit = {
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
    createdBy: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1' as const,
    updatedBy: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1' as const,
  };

  describe('Flavor 1: Standard Checklist Task', () => {
    const task: Task = {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K0L1',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      title: 'Morning 10m Stretch',
      taskType: 'checklist',
      recurrence: 'daily',
    };

    it('evaluates to pending with 0 points when no events exist', () => {
      const result = evaluateTaskProgress({ task, events: [] });
      expect(result.status).toBe('pending');
      expect(result.earnedPoints).toBe(0.0);
      expect(result.progressPercentage).toBe(0.0);
      expect(result.isIgnored).toBe(false);
    });

    it('evaluates to done with 1.0 point when done event is recorded', () => {
      const event: CompletionEvent = {
        ...baseAudit,
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L1',
        taskId: task.id,
        userId: task.userId,
        status: 'done',
        occurredAt: '2026-11-07T07:15:00.000Z',
        recordedAt: '2026-11-07T07:15:01.000Z',
        notes: 'Felt energized',
      };
      const result = evaluateTaskProgress({ task, events: [event] });
      expect(result.status).toBe('done');
      expect(result.earnedPoints).toBe(1.0);
      expect(result.progressPercentage).toBe(100.0);
      expect(result.isIgnored).toBe(false);
      expect(result.notes).toEqual(['Felt energized']);
    });

    it('evaluates to ignored with 0 points and isIgnored=true', () => {
      const event: CompletionEvent = {
        ...baseAudit,
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L2',
        taskId: task.id,
        userId: task.userId,
        status: 'ignored',
        occurredAt: '2026-11-07T08:00:00.000Z',
        recordedAt: '2026-11-07T08:00:01.000Z',
        notes: 'Sore back, intentional rest',
      };
      const result = evaluateTaskProgress({ task, events: [event] });
      expect(result.status).toBe('ignored');
      expect(result.isIgnored).toBe(true);
      expect(result.earnedPoints).toBe(0.0);
      expect(result.progressPercentage).toBe(0.0);
      expect(result.notes).toEqual(['Sore back, intentional rest']);
    });
  });

  describe('Flavor 2: Discrete Milestone Task', () => {
    const task: Task = {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K0L2',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      title: 'Drink 3L Water',
      taskType: 'milestone',
      recurrence: 'daily',
    };

    const milestones: TaskMilestone[] = [
      { ...baseAudit, id: 'mls_01H7AD12C3D4E5F6G7H8J9K0M1', taskId: task.id, label: '1L', stepOrder: 1 },
      { ...baseAudit, id: 'mls_01H7AD12C3D4E5F6G7H8J9K0M2', taskId: task.id, label: '2L', stepOrder: 2 },
      { ...baseAudit, id: 'mls_01H7AD12C3D4E5F6G7H8J9K0M3', taskId: task.id, label: '3L', stepOrder: 3 },
    ];

    it('fails fast if milestone task has 0 milestones defined', () => {
      expect(() => evaluateTaskProgress({ task, milestones: [], events: [] })).toThrow(
        InvalidTaskConfigError
      );
    });

    it('evaluates to pending with 0 milestones checked', () => {
      const result = evaluateTaskProgress({ task, milestones, events: [] });
      expect(result.status).toBe('pending');
      expect(result.earnedPoints).toBe(0.0);
      expect(result.progressPercentage).toBe(0.0);
      expect(result.completedMilestoneIds).toEqual([]);
    });

    it('evaluates to in_progress when 1 of 3 milestones checked (1/3 = 33.33%)', () => {
      const event: CompletionEvent = {
        ...baseAudit,
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L3',
        taskId: task.id,
        milestoneId: 'mls_01H7AD12C3D4E5F6G7H8J9K0M1',
        userId: task.userId,
        status: 'done',
        occurredAt: '2026-11-07T10:00:00.000Z',
        recordedAt: '2026-11-07T10:00:01.000Z',
      };
      const result = evaluateTaskProgress({ task, milestones, events: [event] });
      expect(result.status).toBe('in_progress');
      expect(result.earnedPoints).toBe(0.3333);
      expect(result.progressPercentage).toBe(33.33);
      expect(result.completedMilestoneIds).toEqual(['mls_01H7AD12C3D4E5F6G7H8J9K0M1']);
    });

    it('evaluates to in_progress when 2 of 3 milestones checked (2/3 = 66.67%)', () => {
      const events: CompletionEvent[] = [
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L3',
          taskId: task.id,
          milestoneId: 'mls_01H7AD12C3D4E5F6G7H8J9K0M1',
          userId: task.userId,
          status: 'done',
          occurredAt: '2026-11-07T10:00:00.000Z',
          recordedAt: '2026-11-07T10:00:01.000Z',
        },
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L4',
          taskId: task.id,
          milestoneId: 'mls_01H7AD12C3D4E5F6G7H8J9K0M2',
          userId: task.userId,
          status: 'done',
          occurredAt: '2026-11-07T14:00:00.000Z',
          recordedAt: '2026-11-07T14:00:01.000Z',
        },
      ];
      const result = evaluateTaskProgress({ task, milestones, events });
      expect(result.status).toBe('in_progress');
      expect(result.earnedPoints).toBe(0.6667);
      expect(result.progressPercentage).toBe(66.67);
    });

    it('deduplicates multiple checks for the same milestone ID', () => {
      const duplicateEvents: CompletionEvent[] = [
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L3',
          taskId: task.id,
          milestoneId: 'mls_01H7AD12C3D4E5F6G7H8J9K0M1',
          userId: task.userId,
          status: 'done',
          occurredAt: '2026-11-07T10:00:00.000Z',
          recordedAt: '2026-11-07T10:00:01.000Z',
        },
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L4',
          taskId: task.id,
          milestoneId: 'mls_01H7AD12C3D4E5F6G7H8J9K0M1', // Duplicate check
          userId: task.userId,
          status: 'done',
          occurredAt: '2026-11-07T10:05:00.000Z',
          recordedAt: '2026-11-07T10:05:01.000Z',
        },
      ];
      const result = evaluateTaskProgress({ task, milestones, events: duplicateEvents });
      expect(result.completedMilestoneIds).toHaveLength(1);
      expect(result.earnedPoints).toBe(0.3333);
    });

    it('evaluates to done when all 3 milestones are checked (3/3 = 100%)', () => {
      const events: CompletionEvent[] = milestones.map((m, idx) => ({
        ...baseAudit,
        id: `evt_01H7AE12C3D4E5F6G7H8J9K0L${idx}` as const,
        taskId: task.id,
        milestoneId: m.id,
        userId: task.userId,
        status: 'done',
        occurredAt: `2026-11-07T${10 + idx}:00:00.000Z`,
        recordedAt: `2026-11-07T${10 + idx}:00:01.000Z`,
      }));
      const result = evaluateTaskProgress({ task, milestones, events });
      expect(result.status).toBe('done');
      expect(result.earnedPoints).toBe(1.0);
      expect(result.progressPercentage).toBe(100.0);
    });
  });

  describe('Flavor 3: Continuous Percentage Task', () => {
    const task: Task = {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K0L3',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      title: 'Read 50 Pages',
      taskType: 'percentage',
      recurrence: 'daily',
      targetValue: 100.0,
      unit: 'pages',
    };

    it('evaluates to in_progress with proportional earned points', () => {
      const event: CompletionEvent = {
        ...baseAudit,
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L5',
        taskId: task.id,
        userId: task.userId,
        status: 'in_progress',
        progressPercentage: 45.0,
        occurredAt: '2026-11-07T15:00:00.000Z',
        recordedAt: '2026-11-07T15:00:01.000Z',
      };
      const result = evaluateTaskProgress({ task, events: [event] });
      expect(result.status).toBe('in_progress');
      expect(result.earnedPoints).toBe(0.45);
      expect(result.progressPercentage).toBe(45.0);
    });

    it('evaluates to done when progress reaches 100%', () => {
      const event: CompletionEvent = {
        ...baseAudit,
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L6',
        taskId: task.id,
        userId: task.userId,
        status: 'done',
        progressPercentage: 100.0,
        occurredAt: '2026-11-07T18:00:00.000Z',
        recordedAt: '2026-11-07T18:00:01.000Z',
      };
      const result = evaluateTaskProgress({ task, events: [event] });
      expect(result.status).toBe('done');
      expect(result.earnedPoints).toBe(1.0);
      expect(result.progressPercentage).toBe(100.0);
    });

    it('fails fast on invalid progress percentage out of bounds', () => {
      const event: CompletionEvent = {
        ...baseAudit,
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L7',
        taskId: task.id,
        userId: task.userId,
        status: 'in_progress',
        progressPercentage: 150.0, // Invalid
        occurredAt: '2026-11-07T18:00:00.000Z',
        recordedAt: '2026-11-07T18:00:01.000Z',
      };
      expect(() => evaluateTaskProgress({ task, events: [event] })).toThrow(InvalidPercentageError);
    });
  });
});
