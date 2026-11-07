import { describe, expect, it } from 'vitest';
import {
  QuietWindow,
  Task,
  TaskEvaluationResult,
} from '../domain/types.js';
import { evaluateStagedTaskReminders } from './staged-notification-engine.js';

describe('Staged Notification & Voice Escalation Engine', () => {
  const baseAudit = {
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    createdBy: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1' as const,
    updatedBy: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1' as const,
  };

  const task: Task = {
    ...baseAudit,
    id: 'tsk_01H7AC12C3D4E5F6G7H8J9K001',
    userId: 'usr_01H7AB12C3D4E5F6G7H8J9K0L1',
    title: 'Drink 2nd Liter of Water',
    taskType: 'milestone',
    recurrence: 'daily',
    reminders: [
      {
        time: '14:00',
        stage2DelayMinutes: 15,
        voicePromptTemplate: 'Gentle reminder: Drink your 2nd liter of water',
        enabled: true,
      },
    ],
  };

  const pendingEval: TaskEvaluationResult = {
    taskId: task.id,
    taskType: 'milestone',
    status: 'pending',
    scheduledPoints: 1.0,
    earnedPoints: 0.0,
    progressPercentage: 0.0,
    isIgnored: false,
    completedMilestoneIds: [],
  };

  describe('Standard Two-Tier Reminders (Visual First -> Voice Escalation)', () => {
    it('generates Stage 1 (Visual) at 14:00 and Stage 2 (Voice) at 14:15 for pending task', () => {
      const notifications = evaluateStagedTaskReminders({
        task,
        taskEvaluation: pendingEval,
        referenceTime: '2026-11-07T12:00:00.000Z',
        timezone: 'UTC',
        operationalDateStr: '2026-11-07',
      });

      expect(notifications).toHaveLength(2);

      // Stage 1 (Visual)
      const stage1 = notifications.find((n) => n.stage === 'stage_1_visual')!;
      expect(stage1.deliveryStatus).toBe('delivered');
      expect(stage1.scheduledTime).toContain('14:00:00');
      expect(stage1.visualMessage).toBe('Time for Drink 2nd Liter of Water');
      expect(stage1.voiceMessage).toBeNull();

      // Stage 2 (Voice Escalation after 15m delay)
      const stage2 = notifications.find((n) => n.stage === 'stage_2_voice')!;
      expect(stage2.deliveryStatus).toBe('delivered');
      expect(stage2.scheduledTime).toContain('14:15:00');
      expect(stage2.voiceMessage).toBe('Gentle reminder: Drink your 2nd liter of water');
    });
  });

  describe('Interim Task Completion & Cancellation', () => {
    it('cancels all staged notifications when task is already done', () => {
      const doneEval: TaskEvaluationResult = {
        ...pendingEval,
        status: 'done',
        earnedPoints: 1.0,
        progressPercentage: 100.0,
      };

      const notifications = evaluateStagedTaskReminders({
        task,
        taskEvaluation: doneEval,
        referenceTime: '2026-11-07T14:10:00.000Z',
        timezone: 'UTC',
        operationalDateStr: '2026-11-07',
      });

      expect(notifications).toHaveLength(2);
      expect(notifications[0].deliveryStatus).toBe('canceled_already_completed');
      expect(notifications[1].deliveryStatus).toBe('canceled_already_completed');
    });

    it('cancels all staged notifications when task was marked Ignored (Guilt-Free Rest)', () => {
      const ignoredEval: TaskEvaluationResult = {
        ...pendingEval,
        status: 'ignored',
        isIgnored: true,
      };

      const notifications = evaluateStagedTaskReminders({
        task,
        taskEvaluation: ignoredEval,
        referenceTime: '2026-11-07T14:10:00.000Z',
        timezone: 'UTC',
        operationalDateStr: '2026-11-07',
      });

      expect(notifications).toHaveLength(2);
      expect(notifications[0].deliveryStatus).toBe('canceled_already_completed');
      expect(notifications[1].deliveryStatus).toBe('canceled_already_completed');
      expect(notifications[1].reason).toContain('Ignored (guilt-free rest)');
    });
  });

  describe('Quiet Window Blackout Downgrades & Deferrals', () => {
    it('automatically downgrades Stage 2 voice prompt to silent notification during quiet hours', () => {
      // Quiet window from 14:00 to 15:00
      const quietWindows: QuietWindow[] = [
        {
          id: 'qw_afternoon_rest',
          name: 'Afternoon Rest',
          startHour: 14,
          startMinute: 0,
          endHour: 15,
          endMinute: 0,
          action: 'downgrade_to_silent',
        },
      ];

      const notifications = evaluateStagedTaskReminders({
        task,
        taskEvaluation: pendingEval,
        referenceTime: '2026-11-07T12:00:00.000Z',
        quietWindows,
        timezone: 'UTC',
        operationalDateStr: '2026-11-07',
      });

      const stage2 = notifications.find((n) => n.stage === 'stage_2_voice')!;
      // Voice prompt fires at 14:15, which is inside the 14:00-15:00 quiet window!
      expect(stage2.deliveryStatus).toBe('downgraded_to_silent');
      expect(stage2.voiceMessage).toBeNull(); // Audible voice suppressed!
      expect(stage2.visualMessage).toContain('[Quiet Hours]');
    });

    it('defers Stage 2 voice prompt when quiet window action is defer', () => {
      const quietWindows: QuietWindow[] = [
        {
          id: 'qw_afternoon_rest',
          name: 'Afternoon Rest',
          startHour: 14,
          startMinute: 0,
          endHour: 15,
          endMinute: 0,
          action: 'defer',
        },
      ];

      const notifications = evaluateStagedTaskReminders({
        task,
        taskEvaluation: pendingEval,
        referenceTime: '2026-11-07T12:00:00.000Z',
        quietWindows,
        timezone: 'UTC',
        operationalDateStr: '2026-11-07',
      });

      const stage2 = notifications.find((n) => n.stage === 'stage_2_voice')!;
      expect(stage2.deliveryStatus).toBe('deferred');
      expect(stage2.voiceMessage).toBeNull();
      expect(stage2.reason).toContain('deferred');
    });
  });
});
