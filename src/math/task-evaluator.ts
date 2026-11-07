/**
 * Laya (लय) — Task Progress Evaluator
 * Evaluates individual task progress and earned points across the 3 multi-flavors:
 * 1. Standard Checklist (Binary: Pending, Done, Ignored)
 * 2. Discrete Milestones (Ratio of completed checkpoints to total checkpoints)
 * 3. Continuous Percentage (0.00% to 100.00% progress)
 */

import {
  CompletionEvent,
  MilestoneId,
  Task,
  TaskEvaluationResult,
  TaskMilestone,
} from '../domain/types.js';
import {
  InvalidPercentageError,
  InvalidTaskConfigError,
} from '../domain/errors.js';

export interface EvaluateTaskParams {
  task: Task;
  milestones?: TaskMilestone[]; // Required if task.taskType === 'milestone'
  events: CompletionEvent[];
}

/**
 * Evaluates a single task's status and earned points from its completion events.
 */
export function evaluateTaskProgress(params: EvaluateTaskParams): TaskEvaluationResult {
  const { task, milestones = [], events } = params;

  // Filter events belonging to this specific task and sort chronologically
  const taskEvents = events
    .filter((e) => e.taskId === task.id)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  // Aggregate any attached notes
  const notes = taskEvents
    .map((e) => e.notes)
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0);

  // Check if the task was marked as 'ignored' in this evaluation window
  // If the latest event is 'ignored', the task is treated as guilt-free Ignored
  const latestEvent = taskEvents[taskEvents.length - 1];
  const isIgnored = latestEvent?.status === 'ignored';

  if (isIgnored) {
    return {
      taskId: task.id,
      taskType: task.taskType,
      status: 'ignored',
      scheduledPoints: 1.0,
      earnedPoints: 0.0,
      progressPercentage: 0.0,
      isIgnored: true,
      completedMilestoneIds: [],
      notes: notes.length > 0 ? notes : undefined,
    };
  }

  switch (task.taskType) {
    case 'checklist': {
      const isDone = taskEvents.some((e) => e.status === 'done');
      return {
        taskId: task.id,
        taskType: 'checklist',
        status: isDone ? 'done' : 'pending',
        scheduledPoints: 1.0,
        earnedPoints: isDone ? 1.0 : 0.0,
        progressPercentage: isDone ? 100.0 : 0.0,
        isIgnored: false,
        completedMilestoneIds: [],
        notes: notes.length > 0 ? notes : undefined,
      };
    }

    case 'milestone': {
      if (!milestones || milestones.length === 0) {
        throw new InvalidTaskConfigError(
          `Milestone task '${task.id}' must have at least one defined milestone.`
        );
      }

      // Collect all distinct completed milestones that belong to this task
      const validMilestoneIds = new Set(milestones.map((m) => m.id));
      const completedMilestoneIds = new Set<MilestoneId>();

      for (const event of taskEvents) {
        if (event.status === 'done' && event.milestoneId && validMilestoneIds.has(event.milestoneId)) {
          completedMilestoneIds.add(event.milestoneId);
        }
      }

      const totalMilestones = milestones.length;
      const completedCount = completedMilestoneIds.size;
      const ratio = completedCount / totalMilestones;
      const progressPercentage = Math.round(ratio * 10000) / 100;

      let status: 'pending' | 'in_progress' | 'done' = 'pending';
      if (completedCount === totalMilestones) {
        status = 'done';
      } else if (completedCount > 0) {
        status = 'in_progress';
      }

      return {
        taskId: task.id,
        taskType: 'milestone',
        status,
        scheduledPoints: 1.0,
        earnedPoints: Math.round(ratio * 10000) / 10000,
        progressPercentage,
        isIgnored: false,
        completedMilestoneIds: Array.from(completedMilestoneIds),
        notes: notes.length > 0 ? notes : undefined,
      };
    }

    case 'percentage': {
      // Find the most recent progress percentage recorded
      let currentProgress = 0.0;
      let hasProgressEvent = false;

      // Scan events from latest to oldest
      for (let i = taskEvents.length - 1; i >= 0; i--) {
        const ev = taskEvents[i];
        if (ev.status === 'done') {
          currentProgress = 100.0;
          hasProgressEvent = true;
          break;
        }
        if (ev.progressPercentage !== undefined && ev.progressPercentage !== null) {
          if (ev.progressPercentage < 0 || ev.progressPercentage > 100) {
            throw new InvalidPercentageError(ev.progressPercentage);
          }
          currentProgress = ev.progressPercentage;
          hasProgressEvent = true;
          break;
        }
      }

      let status: 'pending' | 'in_progress' | 'done' = 'pending';
      if (currentProgress >= 100.0) {
        status = 'done';
      } else if (currentProgress > 0.0) {
        status = 'in_progress';
      }

      return {
        taskId: task.id,
        taskType: 'percentage',
        status,
        scheduledPoints: 1.0,
        earnedPoints: Math.round((currentProgress / 100.0) * 10000) / 10000,
        progressPercentage: currentProgress,
        isIgnored: false,
        completedMilestoneIds: [],
        notes: notes.length > 0 ? notes : undefined,
      };
    }

    default: {
      const exhaustiveCheck: never = task.taskType;
      throw new Error(`Unhandled task type: ${exhaustiveCheck}`);
    }
  }
}
