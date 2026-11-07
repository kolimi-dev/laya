import { describe, expect, it } from 'vitest';
import {
  CompletionEvent,
  Task,
  TaskGroup,
  TaskMilestone,
} from '../domain/types.js';
import { computeActiveChecklist } from './active-checklist.js';

describe('Active Checklist Engine ("Today\'s Checklist")', () => {
  const baseAudit = {
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    createdBy: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1' as const,
    updatedBy: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1' as const,
  };

  const groups: TaskGroup[] = [
    {
      ...baseAudit,
      id: 'grp_01H7AF12C3D4E5F6G7H8J9K0H1',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      name: 'Health & Fitness',
      sortOrder: 1,
      color: '#10B981',
      schedule: { cadence: { type: 'daily' } },
    },
    {
      ...baseAudit,
      id: 'grp_01H7AF12C3D4E5F6G7H8J9K0O1',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      name: 'Office & Deep Work',
      sortOrder: 2,
      color: '#3B82F6',
      schedule: { cadence: { type: 'workweek', variant: 'mon_fri' } }, // Weekdays only
    },
    {
      ...baseAudit,
      id: 'grp_01H7AF12C3D4E5F6G7H8J9K0P1',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      name: 'Personal Life',
      sortOrder: 3,
      color: '#8B5CF6',
      schedule: { cadence: { type: 'daily' } },
    },
  ];

  const tasks: Task[] = [
    // Health Tasks
    {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K001',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0H1',
      title: 'Drink 3L Water',
      taskType: 'milestone',
      recurrence: 'daily',
      sortOrder: 1,
    },
    {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K002',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0H1',
      title: 'Morning 10m Stretch',
      taskType: 'checklist',
      recurrence: 'daily',
      sortOrder: 2,
    },
    // Office Tasks
    {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K003',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0O1',
      title: 'Deep Work Sprint 90m',
      taskType: 'percentage',
      recurrence: 'daily',
      sortOrder: 1,
    },
    {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K004',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0O1',
      title: 'Weekly Monday Team Sync',
      taskType: 'checklist',
      recurrence: 'weekly',
      schedule: { cadence: { type: 'weekly', dayOfWeek: 'mon' } }, // Task-level override
      sortOrder: 2,
    },
    // Personal Tasks
    {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K005',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0P1',
      title: 'Read 20 Pages',
      taskType: 'checklist',
      recurrence: 'daily',
      sortOrder: 1,
    },
    // Excluded tasks
    {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K006',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0P1',
      title: 'Old Q1 Marathon Goal',
      taskType: 'checklist',
      recurrence: 'daily',
      archivedAt: '2026-11-01T00:00:00.000Z', // Archived!
    },
    {
      ...baseAudit,
      id: 'tsk_01H7AC12C3D4E5F6G7H8J9K007',
      userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
      groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0P1',
      title: 'Deleted Task',
      taskType: 'checklist',
      recurrence: 'daily',
      deletedAt: '2026-11-01T00:00:00.000Z', // Soft-deleted!
    },
  ];

  const milestones: TaskMilestone[] = [
    { ...baseAudit, id: 'mls_01H7AD12C3D4E5F6G7H8J9K0M1', taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K001', label: '1L', stepOrder: 1 },
    { ...baseAudit, id: 'mls_01H7AD12C3D4E5F6G7H8J9K0M2', taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K001', label: '2L', stepOrder: 2 },
    { ...baseAudit, id: 'mls_01H7AD12C3D4E5F6G7H8J9K0M3', taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K001', label: '3L', stepOrder: 3 },
  ];

  describe('Friday Checklist (Workday)', () => {
    // 2026-11-06 10:00 AM UTC (Friday)
    const fridayTime = '2026-11-06T10:00:00.000Z';

    it('includes weekday office tasks and excludes archived/deleted tasks', () => {
      const result = computeActiveChecklist({
        tasks,
        groups,
        milestones,
        referenceTime: fridayTime,
      });

      expect(result.operationalDate).toBe('2026-11-06');
      // Due: Water, Stretch, Deep Work, Read 20 pages (Weekly Monday Sync is excluded)
      expect(result.items).toHaveLength(4);

      const titles = result.items.map((i) => i.task.title);
      expect(titles).toContain('Drink 3L Water');
      expect(titles).toContain('Morning 10m Stretch');
      expect(titles).toContain('Deep Work Sprint 90m');
      expect(titles).toContain('Read 20 Pages');

      expect(titles).not.toContain('Weekly Monday Team Sync');
      expect(titles).not.toContain('Old Q1 Marathon Goal');
      expect(titles).not.toContain('Deleted Task');
    });

    it('correctly calculates progress and applies the guilt-free Ignore formula', () => {
      // Events for today:
      const events: CompletionEvent[] = [
        // Water: 2 of 3 milestones checked (0.6667 pt)
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L1',
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K001',
          milestoneId: 'mls_01H7AD12C3D4E5F6G7H8J9K0M1',
          userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
          status: 'done',
          occurredAt: '2026-11-06T09:00:00.000Z',
          recordedAt: '2026-11-06T09:00:01.000Z',
        },
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L2',
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K001',
          milestoneId: 'mls_01H7AD12C3D4E5F6G7H8J9K0M2',
          userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
          status: 'done',
          occurredAt: '2026-11-06T13:00:00.000Z',
          recordedAt: '2026-11-06T13:00:01.000Z',
        },
        // Stretch: Done (1.0 pt)
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L3',
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K002',
          userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
          status: 'done',
          occurredAt: '2026-11-06T07:30:00.000Z',
          recordedAt: '2026-11-06T07:30:01.000Z',
        },
        // Deep Work: 50% (0.5 pt)
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L4',
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K003',
          userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
          status: 'in_progress',
          progressPercentage: 50.0,
          occurredAt: '2026-11-06T11:00:00.000Z',
          recordedAt: '2026-11-06T11:00:01.000Z',
        },
        // Read 20 Pages: Marked Ignored (Guilt-free exemption)
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L5',
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K005',
          userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
          status: 'ignored',
          occurredAt: '2026-11-06T18:00:00.000Z',
          recordedAt: '2026-11-06T18:00:01.000Z',
          notes: 'Headache tonight',
        },
      ];

      const result = computeActiveChecklist({
        tasks,
        groups,
        milestones,
        events,
        referenceTime: fridayTime,
      });

      // Total due: 4
      // Scheduled points: 4.0
      // Ignored: 1.0 (Read 20 pages is excluded from denominator)
      // Effective denominator: 3.0
      // Completed points: 0.6667 (Water) + 1.0 (Stretch) + 0.5 (Deep Work) = 2.1667
      // Consistency: (2.1667 / 3.0) * 100 = 72.22%
      expect(result.overallConsistency.totalScheduledPoints).toBe(4.0);
      expect(result.overallConsistency.totalIgnoredPoints).toBe(1.0);
      expect(result.overallConsistency.effectiveDenominator).toBe(3.0);
      expect(result.overallConsistency.totalCompletedPoints).toBe(2.17);
      expect(result.overallConsistency.consistencyPercentage).toBe(72.22);

      // Group breakdowns
      const healthGroup = result.groupBreakdowns.find((g) => g.groupName === 'Health & Fitness')!;
      const officeGroup = result.groupBreakdowns.find((g) => g.groupName === 'Office & Deep Work')!;
      const personalGroup = result.groupBreakdowns.find((g) => g.groupName === 'Personal Life')!;

      // Health: 1.6667 / 2 = 83.335 -> 83.34%
      expect(healthGroup.consistencyPercentage).toBe(83.34);
      // Office: 0.5 / 1 = 50.00%
      expect(officeGroup.consistencyPercentage).toBe(50.0);
      // Personal: 1 task Ignored -> 100% exempt!
      expect(personalGroup.isExempt).toBe(true);
      expect(personalGroup.consistencyPercentage).toBe(100.0);
    });

    it('enforces natural routine sort order: Health first, Office second, Personal third', () => {
      const result = computeActiveChecklist({
        tasks,
        groups,
        milestones,
        referenceTime: fridayTime,
      });

      const order = result.items.map((i) => `${i.group?.name} -> ${i.task.title}`);
      expect(order).toEqual([
        'Health & Fitness -> Drink 3L Water',
        'Health & Fitness -> Morning 10m Stretch',
        'Office & Deep Work -> Deep Work Sprint 90m',
        'Personal Life -> Read 20 Pages',
      ]);
    });
  });

  describe('Saturday Checklist (Weekend Operating Rules)', () => {
    // 2026-11-07 10:00 AM UTC (Saturday)
    const saturdayTime = '2026-11-07T10:00:00.000Z';

    it('automatically hides office weekday tasks from the weekend active checklist', () => {
      const result = computeActiveChecklist({
        tasks,
        groups,
        milestones,
        referenceTime: saturdayTime,
      });

      expect(result.operationalDate).toBe('2026-11-07');
      // Office group (mon_fri) is inactive on Saturday!
      // Only Health & Personal tasks are due today:
      expect(result.items).toHaveLength(3);

      const titles = result.items.map((i) => i.task.title);
      expect(titles).toContain('Drink 3L Water');
      expect(titles).toContain('Morning 10m Stretch');
      expect(titles).toContain('Read 20 Pages');
      expect(titles).not.toContain('Deep Work Sprint 90m');
    });
  });

  describe('Query Filters (Domain Agent Queries)', () => {
    const fridayTime = '2026-11-06T10:00:00.000Z';

    it('filters today checklist by groupId ("Show me today\'s office tasks")', () => {
      const result = computeActiveChecklist({
        tasks,
        groups,
        milestones,
        referenceTime: fridayTime,
        filter: { groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0O1' },
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].task.title).toBe('Deep Work Sprint 90m');
      expect(result.items[0].group?.name).toBe('Office & Deep Work');
    });

    it('filters today checklist by status ("Show all pending tasks")', () => {
      const events: CompletionEvent[] = [
        {
          ...baseAudit,
          id: 'evt_01H7AE12C3D4E5F6G7H8J9K0L3',
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K002', // Stretch is done
          userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
          status: 'done',
          occurredAt: '2026-11-06T07:30:00.000Z',
          recordedAt: '2026-11-06T07:30:01.000Z',
        },
      ];

      const result = computeActiveChecklist({
        tasks,
        groups,
        milestones,
        events,
        referenceTime: fridayTime,
        filter: { status: 'pending' },
      });

      const titles = result.items.map((i) => i.task.title);
      expect(titles).toContain('Drink 3L Water');
      expect(titles).toContain('Deep Work Sprint 90m');
      expect(titles).toContain('Read 20 Pages');
      expect(titles).not.toContain('Morning 10m Stretch'); // Done, so excluded!
    });
  });
});
