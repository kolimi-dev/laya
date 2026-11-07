/**
 * Laya (लय) — Consistency Calculation Engine
 * Implements the core mathematical philosophy:
 * Pressure-free, guilt-free consistency scoring with the "Ignore" denominator exemption:
 *
 * Consistency Rating (%) = (Completed Points / (Total Scheduled Points - Ignored Points)) * 100
 */

import {
  ConsistencyScoreSummary,
  CycleConsistencySummary,
  GroupConsistencySummary,
  GroupId,
  TaskEvaluationResult,
} from '../domain/types.js';

export interface GroupEvaluationItem {
  evaluation: TaskEvaluationResult;
  groupId?: GroupId | null;
  groupName?: string;
}

export interface DayEvaluationItem {
  date: string; // ISO date string e.g. '2026-11-07'
  evaluations: TaskEvaluationResult[];
}

/**
 * Calculates aggregate consistency for an arbitrary list of evaluated tasks.
 * Applies the guilt-free "Ignore" rule where ignored tasks are excluded from the denominator.
 */
export function calculateConsistencyScore(
  evaluations: TaskEvaluationResult[]
): ConsistencyScoreSummary {
  if (evaluations.length === 0) {
    return {
      totalScheduledTasks: 0,
      totalScheduledPoints: 0,
      totalCompletedPoints: 0,
      totalIgnoredPoints: 0,
      effectiveDenominator: 0,
      consistencyPercentage: 100.0,
      isExempt: true,
      breakdown: {
        doneCount: 0,
        inProgressCount: 0,
        pendingCount: 0,
        ignoredCount: 0,
      },
    };
  }

  let totalScheduledPoints = 0;
  let totalCompletedPoints = 0;
  let totalIgnoredPoints = 0;
  let doneCount = 0;
  let inProgressCount = 0;
  let pendingCount = 0;
  let ignoredCount = 0;

  for (const item of evaluations) {
    totalScheduledPoints += item.scheduledPoints;

    if (item.isIgnored) {
      totalIgnoredPoints += item.scheduledPoints;
      ignoredCount++;
    } else {
      totalCompletedPoints += item.earnedPoints;
      if (item.status === 'done') {
        doneCount++;
      } else if (item.status === 'in_progress') {
        inProgressCount++;
      } else {
        pendingCount++;
      }
    }
  }

  const effectiveDenominator = totalScheduledPoints - totalIgnoredPoints;

  // If all tasks were marked as Ignored (e.g. sick day, intentional pause),
  // the user adhered 100% to their intention without receiving a punitive zero.
  if (effectiveDenominator <= 0) {
    return {
      totalScheduledTasks: evaluations.length,
      totalScheduledPoints: roundTwoDecimals(totalScheduledPoints),
      totalCompletedPoints: 0,
      totalIgnoredPoints: roundTwoDecimals(totalIgnoredPoints),
      effectiveDenominator: 0,
      consistencyPercentage: 100.0,
      isExempt: true,
      breakdown: {
        doneCount,
        inProgressCount,
        pendingCount,
        ignoredCount,
      },
    };
  }

  const rawPercentage = (totalCompletedPoints / effectiveDenominator) * 100.0;
  const consistencyPercentage = roundTwoDecimals(Math.min(100.0, Math.max(0.0, rawPercentage)));

  return {
    totalScheduledTasks: evaluations.length,
    totalScheduledPoints: roundTwoDecimals(totalScheduledPoints),
    totalCompletedPoints: roundTwoDecimals(totalCompletedPoints),
    totalIgnoredPoints: roundTwoDecimals(totalIgnoredPoints),
    effectiveDenominator: roundTwoDecimals(effectiveDenominator),
    consistencyPercentage,
    isExempt: false,
    breakdown: {
      doneCount,
      inProgressCount,
      pendingCount,
      ignoredCount,
    },
  };
}

/**
 * Calculates consistency scores broken down by user task groups (e.g. Health, Office, Personal)
 * as well as an overall ecosystem consistency score.
 */
export function calculateGroupConsistencyScores(items: GroupEvaluationItem[]): {
  overall: ConsistencyScoreSummary;
  groups: GroupConsistencySummary[];
} {
  const allEvaluations = items.map((i) => i.evaluation);
  const overall = calculateConsistencyScore(allEvaluations);

  // Group items by groupId
  const groupMap = new Map<string, { groupName: string; evals: TaskEvaluationResult[] }>();

  for (const item of items) {
    const key = item.groupId ?? 'unassigned';
    const name = item.groupName ?? (item.groupId ? String(item.groupId) : 'Unassigned');

    if (!groupMap.has(key)) {
      groupMap.set(key, { groupName: name, evals: [] });
    }
    groupMap.get(key)!.evals.push(item.evaluation);
  }

  const groups: GroupConsistencySummary[] = [];

  for (const [groupIdKey, val] of groupMap.entries()) {
    const groupScore = calculateConsistencyScore(val.evals);
    groups.push({
      ...groupScore,
      groupId: groupIdKey as GroupId | 'unassigned',
      groupName: val.groupName,
    });
  }

  // Sort groups alphabetically by name
  groups.sort((a, b) => a.groupName.localeCompare(b.groupName));

  return { overall, groups };
}

/**
 * Calculates consistency across a custom cycle (e.g., 5, 10, 15, or 30 days).
 * Evaluates total cycle adherence over the multi-day window.
 */
export function calculateCycleConsistencyTrend(
  dailyEvaluations: DayEvaluationItem[]
): CycleConsistencySummary {
  if (dailyEvaluations.length === 0) {
    return {
      cycleLengthDays: 0,
      startDate: '',
      endDate: '',
      overallConsistency: 100.0,
      dailyBreakdown: [],
    };
  }

  const sortedDays = [...dailyEvaluations].sort((a, b) => a.date.localeCompare(b.date));
  const dailyBreakdown: Array<{ date: string; summary: ConsistencyScoreSummary }> = [];

  let grandScheduledPoints = 0;
  let grandCompletedPoints = 0;
  let grandIgnoredPoints = 0;

  for (const day of sortedDays) {
    const daySummary = calculateConsistencyScore(day.evaluations);
    dailyBreakdown.push({
      date: day.date,
      summary: daySummary,
    });

    grandScheduledPoints += daySummary.totalScheduledPoints;
    grandCompletedPoints += daySummary.totalCompletedPoints;
    grandIgnoredPoints += daySummary.totalIgnoredPoints;
  }

  const grandEffectiveDenominator = grandScheduledPoints - grandIgnoredPoints;
  let overallConsistency = 100.0;

  if (grandEffectiveDenominator > 0) {
    const raw = (grandCompletedPoints / grandEffectiveDenominator) * 100.0;
    overallConsistency = roundTwoDecimals(Math.min(100.0, Math.max(0.0, raw)));
  }

  return {
    cycleLengthDays: sortedDays.length,
    startDate: sortedDays[0].date,
    endDate: sortedDays[sortedDays.length - 1].date,
    overallConsistency,
    dailyBreakdown,
  };
}

function roundTwoDecimals(val: number): number {
  return Math.round(val * 100) / 100;
}
