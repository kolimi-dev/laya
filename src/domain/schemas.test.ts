import { describe, expect, it } from 'vitest';
import {
  CreateTaskGroupInputSchema,
  CreateTaskInputSchema,
  EventIdSchema,
  GroupIdSchema,
  MilestoneIdSchema,
  RecordCompletionEventInputSchema,
  TaskIdSchema,
  UserIdSchema,
} from './schemas.js';

describe('Domain Schemas & Prefix Enforcement', () => {
  describe('Type-Prefixed Identifiers', () => {
    it('validates correct entity ID prefixes', () => {
      expect(UserIdSchema.parse('usr_01H7AB12C3D4E5F6G7H8J9K0L1')).toBe('usr_01H7AB12C3D4E5F6G7H8J9K0L1');
      expect(GroupIdSchema.parse('grp_01H7AF12C3D4E5F6G7H8J9K0L6')).toBe('grp_01H7AF12C3D4E5F6G7H8J9K0L6');
      expect(TaskIdSchema.parse('tsk_01H7AC12C3D4E5F6G7H8J9K0L3')).toBe('tsk_01H7AC12C3D4E5F6G7H8J9K0L3');
      expect(MilestoneIdSchema.parse('mls_01H7AD12C3D4E5F6G7H8J9K0L4')).toBe('mls_01H7AD12C3D4E5F6G7H8J9K0L4');
    });

    it('rejects invalid or missing prefixes', () => {
      expect(() => UserIdSchema.parse('tsk_01H7AB12C3D4E5F6G7H8J9K0L1')).toThrow();
      expect(() => GroupIdSchema.parse('usr_01H7AB12C3D4E5F6G7H8J9K0L1')).toThrow();
      expect(() => TaskIdSchema.parse('plain-task-id')).toThrow();
      expect(() => MilestoneIdSchema.parse('12345')).toThrow();
    });

    it('validates EventId as either evt_ prefixed string or valid UUID', () => {
      expect(EventIdSchema.parse('evt_01H7AE12C3D4E5F6G7H8J9K0L5')).toBe('evt_01H7AE12C3D4E5F6G7H8J9K0L5');
      expect(EventIdSchema.parse('c9bf9e57-1685-4c3b-8f1a-b6d8a2f5c4e1')).toBe(
        'c9bf9e57-1685-4c3b-8f1a-b6d8a2f5c4e1'
      );
      expect(() => EventIdSchema.parse('invalid-id-without-prefix-or-uuid')).toThrow();
    });
  });

  describe('CreateTaskInputSchema', () => {
    it('accepts valid checklist task', () => {
      const input = {
        title: 'Morning Meditation',
        taskType: 'checklist' as const,
        recurrence: 'daily' as const,
      };
      const parsed = CreateTaskInputSchema.parse(input);
      expect(parsed.title).toBe('Morning Meditation');
    });

    it('accepts valid milestone task with checkpoints', () => {
      const input = {
        title: 'Daily Water Intake',
        taskType: 'milestone' as const,
        recurrence: 'daily' as const,
        milestones: ['1 Liter', '2 Liters', '3 Liters'],
      };
      const parsed = CreateTaskInputSchema.parse(input);
      expect(parsed.milestones).toHaveLength(3);
    });

    it('rejects milestone task without milestones', () => {
      const input = {
        title: 'Daily Water Intake',
        taskType: 'milestone' as const,
        recurrence: 'daily' as const,
        milestones: [],
      };
      expect(() => CreateTaskInputSchema.parse(input)).toThrow(/At least one milestone/);
    });

    it('accepts custom recurrence with cycleDays', () => {
      const input = {
        title: 'Deep Review',
        taskType: 'checklist' as const,
        recurrence: 'custom' as const,
        cycleDays: 10,
      };
      const parsed = CreateTaskInputSchema.parse(input);
      expect(parsed.cycleDays).toBe(10);
    });

    it('rejects custom recurrence without cycleDays', () => {
      const input = {
        title: 'Deep Review',
        taskType: 'checklist' as const,
        recurrence: 'custom' as const,
      };
      expect(() => CreateTaskInputSchema.parse(input)).toThrow(/cycleDays is required/);
    });
  });

  describe('RecordCompletionEventInputSchema', () => {
    it('validates a successful completion event', () => {
      const input = {
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L5',
        taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K0L3',
        userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
        status: 'done' as const,
        occurredAt: '2026-11-07T08:30:00.000Z',
        notes: 'Great workout',
      };
      const parsed = RecordCompletionEventInputSchema.parse(input);
      expect(parsed.status).toBe('done');
      expect(parsed.notes).toBe('Great workout');
    });

    it('validates an in_progress event with percentage', () => {
      const input = {
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L5',
        taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K0L3',
        userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
        status: 'in_progress' as const,
        progressPercentage: 65.5,
        occurredAt: '2026-11-07T08:30:00.000Z',
      };
      const parsed = RecordCompletionEventInputSchema.parse(input);
      expect(parsed.progressPercentage).toBe(65.5);
    });

    it('rejects in_progress status if progressPercentage is missing', () => {
      const input = {
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L5',
        taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K0L3',
        userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
        status: 'in_progress' as const,
        occurredAt: '2026-11-07T08:30:00.000Z',
      };
      expect(() => RecordCompletionEventInputSchema.parse(input)).toThrow(/progressPercentage is required/);
    });

    it('rejects percentage values outside [0, 100]', () => {
      const input = {
        id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L5',
        taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K0L3',
        userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
        status: 'in_progress' as const,
        progressPercentage: 110.0,
        occurredAt: '2026-11-07T08:30:00.000Z',
      };
      expect(() => RecordCompletionEventInputSchema.parse(input)).toThrow(/cannot exceed 100/);
    });
  });

  describe('CreateTaskGroupInputSchema', () => {
    it('accepts valid group input', () => {
      const input = {
        name: 'Health & Fitness',
        color: '#10B981',
      };
      const parsed = CreateTaskGroupInputSchema.parse(input);
      expect(parsed.name).toBe('Health & Fitness');
    });

    it('rejects invalid hex color', () => {
      const input = {
        name: 'Health',
        color: 'green',
      };
      expect(() => CreateTaskGroupInputSchema.parse(input)).toThrow(/6-digit hex/);
    });
  });
});
