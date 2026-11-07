/**
 * Laya (లయ) — Active Checklist Engine ("Today's Checklist")
 * Dynamically computes actionable tasks due today, evaluating:
 * - Group schedules and task-level overrides
 * - Night Owl Day-Rollover Anchor (03:00 AM cutoff)
 * - Multi-flavor progress and points
 * - Guilt-free Ignore consistency scoring
 */

import {
  ActiveChecklistItem,
  ActiveChecklistResult,
  CompletionEvent,
  DayRolloverOptions,
  GroupId,
  Task,
  TaskGroup,
  TaskMilestone,
  TaskProgressStatus,
} from '../domain/types.js';
import { evaluateTaskProgress } from '../math/task-evaluator.js';
import {
  calculateConsistencyScore,
  calculateGroupConsistencyScores,
} from '../math/consistency-engine.js';
import {
  getOperationalDate,
  isScheduleActiveOnDate,
} from './schedule-evaluator.js';

export interface ComputeActiveChecklistParams {
  tasks: Task[];
  groups?: TaskGroup[];
  milestones?: TaskMilestone[];
  events?: CompletionEvent[];
  referenceTime?: Date | string;
  dayRolloverOptions?: DayRolloverOptions;
  filter?: {
    groupId?: GroupId | 'unassigned' | null;
    status?: TaskProgressStatus | null;
  };
}

/**
 * Computes the dynamic "Today's Active Checklist" for a user.
 */
export function computeActiveChecklist(
  params: ComputeActiveChecklistParams
): ActiveChecklistResult {
  const {
    tasks,
    groups = [],
    milestones = [],
    events = [],
    referenceTime = new Date(),
    dayRolloverOptions = {},
    filter = {},
  } = params;

  // 1. Determine the effective operational date
  const operationalInfo = getOperationalDate(referenceTime, dayRolloverOptions);
  const groupMap = new Map<string, TaskGroup>(groups.map((g) => [g.id, g]));

  const checklistItems: ActiveChecklistItem[] = [];

  // 2. Filter tasks due on this operational day
  for (const task of tasks) {
    // Exclude deleted or archived tasks
    if (task.deletedAt || task.archivedAt) {
      continue;
    }

    const parentGroup = task.groupId ? groupMap.get(task.groupId) : undefined;

    // Resolve schedule: task-level schedule overrides group-level schedule
    const effectiveSchedule = task.schedule ?? parentGroup?.schedule;

    const isDue = isScheduleActiveOnDate({
      schedule: effectiveSchedule,
      recurrence: task.recurrence,
      cycleDays: task.cycleDays,
      operationalInfo,
    });

    if (!isDue) {
      continue;
    }

    // Match task milestones
    const taskMilestones = milestones
      .filter((m) => m.taskId === task.id)
      .sort((a, b) => a.stepOrder - b.stepOrder);

    // Evaluate progress with events recorded for this operational day
    const evaluation = evaluateTaskProgress({
      task,
      milestones: taskMilestones,
      events,
    });

    checklistItems.push({
      task,
      group: parentGroup ?? null,
      milestones: taskMilestones,
      evaluation,
    });
  }

  // 3. Apply optional filters
  let filteredItems = checklistItems;
  if (filter.groupId) {
    filteredItems = filteredItems.filter((item) => {
      if (filter.groupId === 'unassigned') {
        return !item.task.groupId;
      }
      return item.task.groupId === filter.groupId;
    });
  }
  if (filter.status) {
    filteredItems = filteredItems.filter(
      (item) => item.evaluation.status === filter.status
    );
  }

  // 4. Sort items by routine sortOrder, then name
  filteredItems.sort((a, b) => {
    // Group sort order
    const groupOrderA = a.group?.sortOrder ?? 9999;
    const groupOrderB = b.group?.sortOrder ?? 9999;
    if (groupOrderA !== groupOrderB) {
      return groupOrderA - groupOrderB;
    }

    // Group name
    const groupNameA = a.group?.name ?? 'zzz';
    const groupNameB = b.group?.name ?? 'zzz';
    const groupCmp = groupNameA.localeCompare(groupNameB);
    if (groupCmp !== 0) {
      return groupCmp;
    }

    // Task sort order within group
    const taskOrderA = a.task.sortOrder ?? 0;
    const taskOrderB = b.task.sortOrder ?? 0;
    if (taskOrderA !== taskOrderB) {
      return taskOrderA - taskOrderB;
    }

    // Task title
    return a.task.title.localeCompare(b.task.title);
  });

  // 5. Calculate consistency score across all active items due today
  const allEvaluations = filteredItems.map((item) => item.evaluation);
  const overallConsistency = calculateConsistencyScore(allEvaluations);

  // 6. Calculate group-segmented consistency summaries
  const groupEvalItems = filteredItems.map((item) => ({
    evaluation: item.evaluation,
    groupId: item.group?.id,
    groupName: item.group?.name,
  }));
  const { groups: groupBreakdowns } = calculateGroupConsistencyScores(groupEvalItems);

  // 7. Summary counts
  let doneCount = 0;
  let inProgressCount = 0;
  let pendingCount = 0;
  let ignoredCount = 0;

  for (const item of filteredItems) {
    if (item.evaluation.isIgnored) {
      ignoredCount++;
    } else if (item.evaluation.status === 'done') {
      doneCount++;
    } else if (item.evaluation.status === 'in_progress') {
      inProgressCount++;
    } else {
      pendingCount++;
    }
  }

  return {
    operationalDate: operationalInfo.dateString,
    items: filteredItems,
    overallConsistency,
    groupBreakdowns,
    summary: {
      totalDue: filteredItems.length,
      doneCount,
      inProgressCount,
      pendingCount,
      ignoredCount,
    },
  };
}
