/**
 * Laya (लय) — Domain Types & Contracts
 * Pure TypeScript types adhering to Kolimi Studio ground rules:
 * - Strict type-prefixed identifiers (usr_, grp_, tsk_, mls_, evt_)
 * - Strict UTC timestamps
 * - Multi-flavor task classifications
 * - Custom work schedules and day-rollover anchor
 */

export type UserId = `usr_${string}`;
export type GroupId = `grp_${string}`;
export type TaskId = `tsk_${string}`;
export type MilestoneId = `mls_${string}`;
export type EventId = `evt_${string}` | string; // Client idempotency key: evt_ or UUID

export type TaskType = 'checklist' | 'milestone' | 'percentage';
export type TaskRecurrence = 'daily' | 'weekly' | 'monthly' | 'custom' | 'anytime';
export type EventStatus = 'done' | 'in_progress' | 'ignored';
export type TaskProgressStatus = 'pending' | 'in_progress' | 'done' | 'ignored';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type WorkweekVariant = 'mon_fri' | 'tue_sat' | 'sun_thu';

export type ScheduleCadence =
  | { type: 'daily' }
  | { type: 'workweek'; variant: WorkweekVariant }
  | { type: 'day_mask'; days: DayOfWeek[] }
  | { type: 'custom_cycle'; cycleDays: number; anchorDate: string }
  | { type: 'cycle_pattern'; daysOn: number; daysOff: number; anchorDate: string }
  | { type: 'weekly'; dayOfWeek: DayOfWeek }
  | { type: 'monthly'; dayOfMonth: number };

export interface WorkSchedule {
  cadence: ScheduleCadence;
  timezone?: string; // IANA timezone e.g. 'Asia/Kolkata', default 'UTC'
}

export interface AuditFields {
  createdAt: string; // ISO-8601 UTC
  updatedAt: string; // ISO-8601 UTC
  createdBy?: UserId | 'system' | null;
  updatedBy?: UserId | 'system' | null;
}

export interface TaskGroup extends AuditFields {
  id: GroupId;
  userId: UserId;
  name: string;
  color?: string; // Hex color code e.g. '#4F46E5'
  sortOrder?: number;
  schedule?: WorkSchedule; // Group-level operating schedule
  deletedAt?: string | null;
}

export interface Task extends AuditFields {
  id: TaskId;
  userId: UserId;
  groupId?: GroupId | null;
  title: string;
  taskType: TaskType;
  recurrence: TaskRecurrence;
  cycleDays?: number | null; // Used when recurrence is 'custom' (e.g. 5, 10, 15)
  schedule?: WorkSchedule; // Task-level override schedule (inherits from group if undefined)
  targetValue?: number | null; // e.g. 100.00 for percentage
  unit?: string | null; // e.g. 'L', 'pages', 'minutes', 'reps'
  sortOrder?: number;
  deletedAt?: string | null;
  archivedAt?: string | null;
}

export interface TaskMilestone extends AuditFields {
  id: MilestoneId;
  taskId: TaskId;
  label: string; // e.g. '1L', '2L', '3L'
  stepOrder: number; // 1-indexed ordering
}

export interface CompletionEvent extends AuditFields {
  id: EventId; // Client-generated idempotency key
  taskId: TaskId;
  milestoneId?: MilestoneId | null;
  userId: UserId;
  status: EventStatus;
  progressPercentage?: number | null; // 0.00 to 100.00
  notes?: string | null; // Micro-notes (e.g. 'Fever/Rest day', 'Read chapter 3')
  occurredAt: string; // ISO-8601 UTC (when user performed the action)
  recordedAt: string; // ISO-8601 UTC (when server/store recorded it)
}

/**
 * Evaluated progress for a single task within a specific time window.
 */
export interface TaskEvaluationResult {
  taskId: TaskId;
  taskType: TaskType;
  status: TaskProgressStatus;
  scheduledPoints: number; // Standard: 1.0 scheduled point per active task
  earnedPoints: number; // 0.0 to 1.0 points earned
  progressPercentage: number; // 0.00 to 100.00%
  isIgnored: boolean;
  completedMilestoneIds: MilestoneId[];
  notes?: string[];
}

/**
 * Consistency calculation summary for an aggregate set of tasks.
 * Applies the guilt-free "Ignored" denominator exemption rule:
 * Consistency (%) = (Completed Points / (Total Scheduled Points - Ignored Points)) * 100
 */
export interface ConsistencyScoreSummary {
  totalScheduledTasks: number;
  totalScheduledPoints: number;
  totalCompletedPoints: number;
  totalIgnoredPoints: number;
  effectiveDenominator: number; // totalScheduledPoints - totalIgnoredPoints
  consistencyPercentage: number; // 0.00 to 100.00%
  isExempt: boolean; // True when all tasks were Ignored or zero tasks were scheduled
  breakdown: {
    doneCount: number;
    inProgressCount: number;
    pendingCount: number;
    ignoredCount: number;
  };
}

/**
 * Group-segmented consistency breakdown.
 */
export interface GroupConsistencySummary extends ConsistencyScoreSummary {
  groupId: GroupId | 'unassigned';
  groupName: string;
}

/**
 * Rolling multi-day / cycle consistency trend.
 */
export interface CycleConsistencySummary {
  cycleLengthDays: number;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  overallConsistency: number; // 0.00 to 100.00%
  dailyBreakdown: Array<{
    date: string;
    summary: ConsistencyScoreSummary;
  }>;
}

/**
 * An item on the active "Today's Checklist".
 */
export interface ActiveChecklistItem {
  task: Task;
  group?: TaskGroup | null;
  milestones: TaskMilestone[];
  evaluation: TaskEvaluationResult;
}

/**
 * Full output of the Active Checklist Engine for a given operational day.
 */
export interface ActiveChecklistResult {
  operationalDate: string; // YYYY-MM-DD
  items: ActiveChecklistItem[];
  overallConsistency: ConsistencyScoreSummary;
  groupBreakdowns: GroupConsistencySummary[];
  summary: {
    totalDue: number;
    doneCount: number;
    inProgressCount: number;
    pendingCount: number;
    ignoredCount: number;
  };
}

/**
 * Options for evaluating day rollover and timezone.
 */
export interface DayRolloverOptions {
  dayCutoffHour?: number; // 0 to 12 (default 3, meaning day rolls over at 03:00 AM)
  timezone?: string; // IANA timezone e.g. 'Asia/Kolkata', default 'UTC'
}
