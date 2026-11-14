/**
 * Laya (లయ) — Storage Ports & Repository Contracts
 * Hexagonal architecture port for task persistence and append-only event stream.
 */

import {
  ActiveChecklistResult,
  CompletionEvent,
  DayRolloverOptions,
  GroupId,
  Task,
  TaskGroup,
  TaskMilestone,
  TaskProgressStatus,
  UserId,
} from '../domain/types.js';

export interface TaskWithMilestones {
  task: Task;
  milestones: TaskMilestone[];
}

export interface RecordEventResult {
  recorded: boolean;
  isDuplicate: boolean;
  event: CompletionEvent;
}

export interface UserDataExport {
  exportedAt: string; // ISO-8601 UTC
  userId: UserId;
  groups: TaskGroup[];
  tasks: Task[];
  milestones: TaskMilestone[];
  events: CompletionEvent[];
}

export interface UserDataImportResult {
  importedGroups: number;
  importedTasks: number;
  importedMilestones: number;
  importedEvents: number;
}

export interface TrackerRepository {
  // 1. Group Operations
  createGroup(group: TaskGroup): Promise<TaskGroup>;
  getGroupById(id: GroupId, userId: UserId): Promise<TaskGroup | null>;
  getGroupsByUserId(userId: UserId): Promise<TaskGroup[]>;
  updateGroup(
    id: GroupId,
    userId: UserId,
    updates: Partial<Pick<TaskGroup, 'name' | 'color' | 'sortOrder' | 'schedule'>>
  ): Promise<TaskGroup>;
  softDeleteGroup(id: GroupId, userId: UserId): Promise<void>;

  // 2. Task & Milestone Operations
  createTask(task: Task, milestones?: TaskMilestone[]): Promise<TaskWithMilestones>;
  getTaskById(id: string, userId: UserId): Promise<TaskWithMilestones | null>;
  getTasksByUserId(userId: UserId, includeArchived?: boolean): Promise<TaskWithMilestones[]>;
  updateTask(
    id: string,
    userId: UserId,
    updates: Partial<Pick<Task, 'title' | 'targetValue' | 'unit' | 'sortOrder' | 'schedule' | 'recurrence' | 'cycleDays' | 'stepAmount' | 'milestoneMode' | 'lifecycleStatus' | 'targetDate'>>
  ): Promise<Task>;
  archiveTask(id: string, userId: UserId): Promise<Task>;
  softDeleteTask(id: string, userId: UserId): Promise<void>;

  // 3. Append-Only Idempotent Event Stream
  recordEvent(event: CompletionEvent): Promise<RecordEventResult>;
  getEventsForTask(taskId: string, options?: { from?: string; to?: string }): Promise<CompletionEvent[]>;
  getEventsForUser(userId: UserId, options?: { from?: string; to?: string }): Promise<CompletionEvent[]>;

  // 4. Dynamic Checklist Evaluation (Aggregating Domain Core)
  getTodayChecklist(params: {
    userId: UserId;
    referenceTime?: Date | string;
    dayRolloverOptions?: DayRolloverOptions;
    filter?: {
      groupId?: GroupId | 'unassigned' | null;
      status?: TaskProgressStatus | null;
    };
  }): Promise<ActiveChecklistResult>;

  // 5. Data Portability (Export & Import)
  exportUserData(userId: UserId): Promise<UserDataExport>;
  importUserData(userId: UserId, data: Omit<UserDataExport, 'exportedAt' | 'userId'>): Promise<UserDataImportResult>;
}
