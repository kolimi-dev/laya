/**
 * Laya (లయ) — Staged Notification & Voice Escalation Engine
 * Implements the staged reminder escalation model:
 * 1. Stage 1 (Silent / Visual banner at scheduled time T)
 * 2. Stage 2 (Audible voice prompt escalation at T + gracePeriod if still pending)
 * 3. Quiet window blackout awareness (auto-downgrade to silent during quiet hours)
 * 4. Automatic cancellation if task was completed or marked ignored in the interim.
 */

import {
  EvaluatedNotification,
  QuietWindow,
  Task,
  TaskEvaluationResult,
} from '../domain/types.js';
import { evaluateQuietWindow } from './blackout-evaluator.js';

export interface EvaluateStagedRemindersParams {
  task: Task;
  taskEvaluation: TaskEvaluationResult;
  referenceTime?: Date | string;
  quietWindows?: QuietWindow[];
  timezone?: string;
  operationalDateStr?: string; // YYYY-MM-DD
}

/**
 * Evaluates staged notifications for a single task given its reminder schedule and current progress.
 */
export function evaluateStagedTaskReminders(
  params: EvaluateStagedRemindersParams
): EvaluatedNotification[] {
  const {
    task,
    taskEvaluation,
    referenceTime = new Date(),
    quietWindows = [],
    timezone = 'UTC',
    operationalDateStr,
  } = params;

  if (!task.reminders || task.reminders.length === 0) {
    return [];
  }

  const enabledReminders = task.reminders.filter((r) => r.enabled);
  if (enabledReminders.length === 0) {
    return [];
  }

  const refDate = typeof referenceTime === 'string' ? new Date(referenceTime) : referenceTime;

  // Determine target date string (YYYY-MM-DD)
  const targetDateStr = operationalDateStr || getIsoDateStringInTimezone(refDate, timezone);
  const [year, month, day] = targetDateStr.split('-').map(Number);

  const notifications: EvaluatedNotification[] = [];

  for (const reminder of enabledReminders) {
    const [remHour, remMin] = reminder.time.split(':').map(Number);

    // Compute Stage 1 scheduled timestamp in target timezone
    const stage1UtcDate = createUtcFromTimezone(year, month, day, remHour, remMin, timezone);
    const stage1Iso = stage1UtcDate.toISOString();

    // Compute Stage 2 scheduled timestamp (Stage 1 + stage2DelayMinutes)
    const stage2UtcDate = new Date(
      stage1UtcDate.getTime() + reminder.stage2DelayMinutes * 60 * 1000
    );
    const stage2Iso = stage2UtcDate.toISOString();

    // Case A: Task is already completed or ignored
    if (taskEvaluation.status === 'done' || taskEvaluation.status === 'ignored') {
      const reason =
        taskEvaluation.status === 'done'
          ? 'Task already completed.'
          : 'Task marked as Ignored (guilt-free rest).';

      notifications.push({
        taskId: task.id,
        userId: task.userId,
        taskTitle: task.title,
        stage: 'stage_1_visual',
        scheduledTime: stage1Iso,
        deliveryStatus: 'canceled_already_completed',
        visualMessage: `Time for ${task.title}`,
        reason,
      });

      notifications.push({
        taskId: task.id,
        userId: task.userId,
        taskTitle: task.title,
        stage: 'stage_2_voice',
        scheduledTime: stage2Iso,
        deliveryStatus: 'canceled_already_completed',
        visualMessage: `Voice Reminder: ${task.title}`,
        voiceMessage: null,
        reason,
      });

      continue;
    }

    // Case B: Task is pending or in_progress -> Generate Stage 1 (Visual)
    notifications.push({
      taskId: task.id,
      userId: task.userId,
      taskTitle: task.title,
      stage: 'stage_1_visual',
      scheduledTime: stage1Iso,
      deliveryStatus: 'delivered',
      visualMessage: `Time for ${task.title}`,
      voiceMessage: null,
    });

    // Case C: Evaluate Stage 2 (Voice Escalation) with Quiet Window Blackouts
    const blackoutCheck = evaluateQuietWindow({
      referenceTime: stage2UtcDate,
      quietWindows,
      groupId: task.groupId,
      timezone,
    });

    if (blackoutCheck.isBlackout && blackoutCheck.activeWindow) {
      const window = blackoutCheck.activeWindow;

      if (window.action === 'downgrade_to_silent') {
        notifications.push({
          taskId: task.id,
          userId: task.userId,
          taskTitle: task.title,
          stage: 'stage_2_voice',
          scheduledTime: stage2Iso,
          deliveryStatus: 'downgraded_to_silent',
          visualMessage: `[Quiet Hours] Reminder: ${task.title}`,
          voiceMessage: null, // Voice suppressed!
          reason: `Quiet blackout active (${window.name || 'Quiet Hours'}), voice escalated downgraded to silent.`,
        });
      } else {
        // action === 'defer'
        notifications.push({
          taskId: task.id,
          userId: task.userId,
          taskTitle: task.title,
          stage: 'stage_2_voice',
          scheduledTime: stage2Iso,
          deliveryStatus: 'deferred',
          visualMessage: `Reminder: ${task.title}`,
          voiceMessage: null,
          reason: `Quiet blackout active, voice reminder deferred.`,
        });
      }
    } else {
      // Normal Voice Escalation
      const defaultVoicePrompt = `Gentle reminder: ${task.title}`;
      notifications.push({
        taskId: task.id,
        userId: task.userId,
        taskTitle: task.title,
        stage: 'stage_2_voice',
        scheduledTime: stage2Iso,
        deliveryStatus: 'delivered',
        visualMessage: `Voice Reminder: ${task.title}`,
        voiceMessage: reminder.voicePromptTemplate || defaultVoicePrompt,
      });
    }
  }

  return notifications;
}

/**
 * Helpers for localized timezone ISO resolution
 */
function getIsoDateStringInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  let y = '', m = '', d = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') d = p.value;
  }
  return `${y}-${m}-${d}`;
}

function createUtcFromTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date {
  // Approximate UTC guess
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Determine timezone offset difference
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(guess);
  let localHour = 0;
  let localMin = 0;
  for (const p of parts) {
    if (p.type === 'hour') localHour = parseInt(p.value, 10);
    if (p.type === 'minute') localMin = parseInt(p.value, 10);
  }
  if (localHour === 24) localHour = 0;

  const targetMinutes = hour * 60 + minute;
  const guessLocalMinutes = localHour * 60 + localMin;
  const diffMinutes = targetMinutes - guessLocalMinutes;

  return new Date(guess.getTime() + diffMinutes * 60 * 1000);
}
