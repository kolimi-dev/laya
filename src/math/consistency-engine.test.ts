import { describe, expect, it } from 'vitest';
import { TaskEvaluationResult } from '../domain/types.js';
import {
  calculateConsistencyScore,
  calculateCycleConsistencyTrend,
  calculateGroupConsistencyScores,
} from './consistency-engine.js';

describe('Consistency Engine (The Guilt-Free "Ignore" Math)', () => {
  const createMockEval = (
    taskId: `tsk_${string}`,
    status: 'pending' | 'in_progress' | 'done' | 'ignored',
    earnedPoints: number,
    progressPercentage: number,
    isIgnored: boolean = false
  ): TaskEvaluationResult => ({
    taskId,
    taskType: 'checklist',
    status,
    scheduledPoints: 1.0,
    earnedPoints,
    progressPercentage,
    isIgnored,
    completedMilestoneIds: [],
  });

  describe('Core Denominator Exemption Rule', () => {
    it('executes roadmap specification: 4 tasks (2 Done, 1 Ignored, 1 Pending)', () => {
      // 4 tasks: 2 Done (1.0 pt each), 1 Ignored, 1 Pending (0.0 pt)
      const evals: TaskEvaluationResult[] = [
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K001', 'done', 1.0, 100.0, false),
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K002', 'done', 1.0, 100.0, false),
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K003', 'ignored', 0.0, 0.0, true),
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K004', 'pending', 0.0, 0.0, false),
      ];

      const score = calculateConsistencyScore(evals);

      expect(score.totalScheduledTasks).toBe(4);
      expect(score.totalScheduledPoints).toBe(4.0);
      expect(score.totalCompletedPoints).toBe(2.0);
      expect(score.totalIgnoredPoints).toBe(1.0);
      expect(score.effectiveDenominator).toBe(3.0); // 4.0 - 1.0 = 3.0
      // 2 / 3 * 100 = 66.67%
      expect(score.consistencyPercentage).toBe(66.67);
      expect(score.isExempt).toBe(false);
      expect(score.breakdown).toEqual({
        doneCount: 2,
        inProgressCount: 0,
        pendingCount: 1,
        ignoredCount: 1,
      });
    });

    it('proves non-punitive advantage over conventional streak/habit math', () => {
      // Conventional apps: (2 / 4) * 100 = 50%
      // Laya guilt-free: (2 / (4 - 1)) * 100 = 66.67%
      const evals: TaskEvaluationResult[] = [
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K001', 'done', 1.0, 100.0, false),
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K002', 'done', 1.0, 100.0, false),
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K003', 'ignored', 0.0, 0.0, true),
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K004', 'pending', 0.0, 0.0, false),
      ];
      const conventionalScore = (2 / 4) * 100;
      const layaScore = calculateConsistencyScore(evals).consistencyPercentage;

      expect(layaScore).toBeGreaterThan(conventionalScore);
      expect(layaScore).toBe(66.67);
    });
  });

  describe('Edge Cases: Zero & All-Ignored Rest Days', () => {
    it('returns 100% exempt rating when 0 tasks are scheduled', () => {
      const score = calculateConsistencyScore([]);
      expect(score.consistencyPercentage).toBe(100.0);
      expect(score.isExempt).toBe(true);
      expect(score.effectiveDenominator).toBe(0);
      expect(score.totalScheduledTasks).toBe(0);
    });

    it('returns 100% exempt rating when ALL tasks are marked Ignored (Guilt-Free Rest Day)', () => {
      const restDayEvals: TaskEvaluationResult[] = [
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K001', 'ignored', 0.0, 0.0, true),
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K002', 'ignored', 0.0, 0.0, true),
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K003', 'ignored', 0.0, 0.0, true),
      ];

      const score = calculateConsistencyScore(restDayEvals);
      expect(score.consistencyPercentage).toBe(100.0);
      expect(score.isExempt).toBe(true);
      expect(score.totalScheduledTasks).toBe(3);
      expect(score.totalIgnoredPoints).toBe(3.0);
      expect(score.effectiveDenominator).toBe(0);
      expect(score.breakdown.ignoredCount).toBe(3);
    });

    it('returns 0% rating when all tasks are missed without being ignored', () => {
      const missedEvals: TaskEvaluationResult[] = [
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K001', 'pending', 0.0, 0.0, false),
        createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K002', 'pending', 0.0, 0.0, false),
      ];

      const score = calculateConsistencyScore(missedEvals);
      expect(score.consistencyPercentage).toBe(0.0);
      expect(score.isExempt).toBe(false);
      expect(score.effectiveDenominator).toBe(2.0);
    });
  });

  describe('Mixed Multi-Flavor Task Sets', () => {
    it('calculates aggregate consistency across checklist, milestone, and percentage tasks', () => {
      const mixedEvals: TaskEvaluationResult[] = [
        // 1. Checklist Done (1.0 pt)
        {
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K001',
          taskType: 'checklist',
          status: 'done',
          scheduledPoints: 1.0,
          earnedPoints: 1.0,
          progressPercentage: 100.0,
          isIgnored: false,
          completedMilestoneIds: [],
        },
        // 2. Milestone: 2/4 completed (0.5 pt)
        {
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K002',
          taskType: 'milestone',
          status: 'in_progress',
          scheduledPoints: 1.0,
          earnedPoints: 0.5,
          progressPercentage: 50.0,
          isIgnored: false,
          completedMilestoneIds: ['mls_01H7AD12C3D4E5F6G7H8J9K0M1', 'mls_01H7AD12C3D4E5F6G7H8J9K0M2'],
        },
        // 3. Percentage: 80% completed (0.8 pt)
        {
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K003',
          taskType: 'percentage',
          status: 'in_progress',
          scheduledPoints: 1.0,
          earnedPoints: 0.8,
          progressPercentage: 80.0,
          isIgnored: false,
          completedMilestoneIds: [],
        },
        // 4. Checklist Ignored (Exempt from denominator)
        {
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K004',
          taskType: 'checklist',
          status: 'ignored',
          scheduledPoints: 1.0,
          earnedPoints: 0.0,
          progressPercentage: 0.0,
          isIgnored: true,
          completedMilestoneIds: [],
        },
        // 5. Checklist Pending (0.0 pt)
        {
          taskId: 'tsk_01H7AC12C3D4E5F6G7H8J9K005',
          taskType: 'checklist',
          status: 'pending',
          scheduledPoints: 1.0,
          earnedPoints: 0.0,
          progressPercentage: 0.0,
          isIgnored: false,
          completedMilestoneIds: [],
        },
      ];

      // Total scheduled: 5.0
      // Ignored: 1.0
      // Effective denominator: 4.0
      // Completed: 1.0 + 0.5 + 0.8 + 0 + 0 = 2.3
      // Score: 2.3 / 4.0 * 100 = 57.5%
      const score = calculateConsistencyScore(mixedEvals);
      expect(score.totalScheduledTasks).toBe(5);
      expect(score.totalCompletedPoints).toBe(2.3);
      expect(score.effectiveDenominator).toBe(4.0);
      expect(score.consistencyPercentage).toBe(57.5);
    });
  });

  describe('Group-Segmented Consistency', () => {
    it('calculates consistency broken down by task group (Health, Office, Personal)', () => {
      const items = [
        // Health Group: 2 tasks (1 Done, 1 Ignored) -> 1 / (2-1) = 100%
        {
          evaluation: createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K001', 'done', 1.0, 100.0, false),
          groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0H1' as const,
          groupName: 'Health',
        },
        {
          evaluation: createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K002', 'ignored', 0.0, 0.0, true),
          groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0H1' as const,
          groupName: 'Health',
        },
        // Office Group: 2 tasks (1 Done, 1 Pending) -> 1 / 2 = 50%
        {
          evaluation: createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K003', 'done', 1.0, 100.0, false),
          groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0O1' as const,
          groupName: 'Office',
        },
        {
          evaluation: createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K004', 'pending', 0.0, 0.0, false),
          groupId: 'grp_01H7AF12C3D4E5F6G7H8J9K0O1' as const,
          groupName: 'Office',
        },
      ];

      const { overall, groups } = calculateGroupConsistencyScores(items);

      // Overall: 4 tasks, 1 ignored, 2 done -> 2 / 3 = 66.67%
      expect(overall.consistencyPercentage).toBe(66.67);

      expect(groups).toHaveLength(2);
      const healthGroup = groups.find((g) => g.groupName === 'Health')!;
      const officeGroup = groups.find((g) => g.groupName === 'Office')!;

      expect(healthGroup.consistencyPercentage).toBe(100.0);
      expect(officeGroup.consistencyPercentage).toBe(50.0);
    });
  });

  describe('Multi-Day / Cycle Trend Analysis', () => {
    it('aggregates daily adherence across a 5-day custom cycle', () => {
      const dailyData = [
        // Day 1: 100%
        {
          date: '2026-11-01',
          evaluations: [
            createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K001', 'done', 1.0, 100.0, false),
            createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K002', 'done', 1.0, 100.0, false),
          ],
        },
        // Day 2: Rest day (Ignored) -> 100% exempt
        {
          date: '2026-11-02',
          evaluations: [
            createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K001', 'ignored', 0.0, 0.0, true),
            createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K002', 'ignored', 0.0, 0.0, true),
          ],
        },
        // Day 3: 50%
        {
          date: '2026-11-03',
          evaluations: [
            createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K001', 'done', 1.0, 100.0, false),
            createMockEval('tsk_01H7AC12C3D4E5F6G7H8J9K002', 'pending', 0.0, 0.0, false),
          ],
        },
      ];

      const cycle = calculateCycleConsistencyTrend(dailyData);

      expect(cycle.cycleLengthDays).toBe(3);
      expect(cycle.startDate).toBe('2026-11-01');
      expect(cycle.endDate).toBe('2026-11-03');
      // Total scheduled: 6
      // Ignored: 2
      // Effective denominator: 4
      // Completed: 2 (day 1) + 0 (day 2) + 1 (day 3) = 3
      // Cycle consistency: 3 / 4 * 100 = 75.0%
      expect(cycle.overallConsistency).toBe(75.0);
      expect(cycle.dailyBreakdown).toHaveLength(3);
    });
  });
});
