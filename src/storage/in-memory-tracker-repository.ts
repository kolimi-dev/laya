/**
 * Laya (లయ) — In-Memory Tracker Repository Adapter
 * Implements the TrackerRepository port for in-memory testing, local development, and offline caching.
 * Guaranteed idempotency and append-only event stream preservation.
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
import { TaskNotFoundError } from '../domain/errors.js';
import { computeActiveChecklist } from '../recurrence/active-checklist.js';
import {
  RecordEventResult,
  TaskWithMilestones,
  TrackerRepository,
  UserDataExport,
  UserDataImportResult,
} from './tracker-repository.js';

export class InMemoryTrackerRepository implements TrackerRepository {
  private groups: Map<string, TaskGroup> = new Map();
  private tasks: Map<string, Task> = new Map();
  private milestones: Map<string, TaskMilestone> = new Map();
  private events: Map<string, CompletionEvent> = new Map();

  // 1. Group Operations
  async createGroup(group: TaskGroup): Promise<TaskGroup> {
    const record: TaskGroup = {
      ...group,
      createdAt: group.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    this.groups.set(group.id, record);
    return record;
  }

  async getGroupById(id: GroupId, userId: UserId): Promise<TaskGroup | null> {
    const group = this.groups.get(id);
    if (!group || group.userId !== userId || group.deletedAt) {
      return null;
    }
    return group;
  }

  async getGroupsByUserId(userId: UserId): Promise<TaskGroup[]> {
    return Array.from(this.groups.values())
      .filter((g) => g.userId === userId && !g.deletedAt)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async updateGroup(
    id: GroupId,
    userId: UserId,
    updates: Partial<Pick<TaskGroup, 'name' | 'color' | 'sortOrder' | 'schedule'>>
  ): Promise<TaskGroup> {
    const existing = await this.getGroupById(id, userId);
    if (!existing) {
      throw new Error(`Group '${id}' not found for user '${userId}'.`);
    }
    const updated: TaskGroup = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.groups.set(id, updated);
    return updated;
  }

  async softDeleteGroup(id: GroupId, userId: UserId): Promise<void> {
    const existing = await this.getGroupById(id, userId);
    if (existing) {
      existing.deletedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      this.groups.set(id, existing);
    }
  }

  // 2. Task & Milestone Operations
  async createTask(task: Task, milestones: TaskMilestone[] = []): Promise<TaskWithMilestones> {
    const now = new Date().toISOString();
    const taskRecord: Task = {
      ...task,
      createdAt: task.createdAt || now,
      updatedAt: now,
      deletedAt: null,
      archivedAt: null,
    };
    this.tasks.set(task.id, taskRecord);

    const savedMilestones: TaskMilestone[] = [];
    for (const m of milestones) {
      const milestoneRecord: TaskMilestone = {
        ...m,
        taskId: task.id,
        createdAt: m.createdAt || now,
        updatedAt: now,
      };
      this.milestones.set(m.id, milestoneRecord);
      savedMilestones.push(milestoneRecord);
    }

    return { task: taskRecord, milestones: savedMilestones };
  }

  async getTaskById(id: string, userId: UserId): Promise<TaskWithMilestones | null> {
    const task = this.tasks.get(id);
    if (!task || task.userId !== userId || task.deletedAt) {
      return null;
    }
    const taskMilestones = Array.from(this.milestones.values())
      .filter((m) => m.taskId === id)
      .sort((a, b) => a.stepOrder - b.stepOrder);

    return { task, milestones: taskMilestones };
  }

  async getTasksByUserId(userId: UserId, includeArchived = false): Promise<TaskWithMilestones[]> {
    const userTasks = Array.from(this.tasks.values()).filter(
      (t) => t.userId === userId && !t.deletedAt && (includeArchived || !t.archivedAt)
    );

    return userTasks.map((task) => {
      const taskMilestones = Array.from(this.milestones.values())
        .filter((m) => m.taskId === task.id)
        .sort((a, b) => a.stepOrder - b.stepOrder);
      return { task, milestones: taskMilestones };
    });
  }

  async updateTask(
    id: string,
    userId: UserId,
    updates: Partial<Pick<Task, 'title' | 'targetValue' | 'unit' | 'sortOrder' | 'schedule' | 'recurrence' | 'cycleDays'>>
  ): Promise<Task> {
    const existing = await this.getTaskById(id, userId);
    if (!existing) {
      throw new TaskNotFoundError(id);
    }
    const updated: Task = {
      ...existing.task,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async archiveTask(id: string, userId: UserId): Promise<Task> {
    const existing = await this.getTaskById(id, userId);
    if (!existing) {
      throw new TaskNotFoundError(id);
    }
    const now = new Date().toISOString();
    const updated: Task = {
      ...existing.task,
      archivedAt: now,
      updatedAt: now,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async softDeleteTask(id: string, userId: UserId): Promise<void> {
    const existing = await this.getTaskById(id, userId);
    if (existing) {
      const now = new Date().toISOString();
      const updated: Task = {
        ...existing.task,
        deletedAt: now,
        updatedAt: now,
      };
      this.tasks.set(id, updated);
    }
  }

  // 3. Append-Only Idempotent Event Stream
  async recordEvent(event: CompletionEvent): Promise<RecordEventResult> {
    // Idempotency check: if event.id already exists, return existing without duplication
    const existing = this.events.get(event.id);
    if (existing) {
      return {
        recorded: false,
        isDuplicate: true,
        event: existing,
      };
    }

    const now = new Date().toISOString();
    const record: CompletionEvent = {
      ...event,
      recordedAt: event.recordedAt || now,
      createdAt: event.createdAt || now,
      updatedAt: now,
    };
    this.events.set(event.id, record);

    return {
      recorded: true,
      isDuplicate: false,
      event: record,
    };
  }

  async getEventsForTask(taskId: string, options: { from?: string; to?: string } = {}): Promise<CompletionEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => {
        if (e.taskId !== taskId) return false;
        if (options.from && e.occurredAt < options.from) return false;
        if (options.to && e.occurredAt > options.to) return false;
        return true;
      })
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  }

  async getEventsForUser(userId: UserId, options: { from?: string; to?: string } = {}): Promise<CompletionEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => {
        if (e.userId !== userId) return false;
        if (options.from && e.occurredAt < options.from) return false;
        if (options.to && e.occurredAt > options.to) return false;
        return true;
      })
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  }

  // 4. Dynamic Today Checklist
  async getTodayChecklist(params: {
    userId: UserId;
    referenceTime?: Date | string;
    dayRolloverOptions?: DayRolloverOptions;
    filter?: {
      groupId?: GroupId | 'unassigned' | null;
      status?: TaskProgressStatus | null;
    };
  }): Promise<ActiveChecklistResult> {
    const { userId, referenceTime, dayRolloverOptions, filter } = params;

    const userGroups = await this.getGroupsByUserId(userId);
    const userTasksWithMilestones = await this.getTasksByUserId(userId, false); // Exclude archived
    const userEvents = await this.getEventsForUser(userId);

    const allTasks = userTasksWithMilestones.map((t) => t.task);
    const allMilestones = userTasksWithMilestones.flatMap((t) => t.milestones);

    return computeActiveChecklist({
      tasks: allTasks,
      groups: userGroups,
      milestones: allMilestones,
      events: userEvents,
      referenceTime,
      dayRolloverOptions,
      filter,
    });
  }

  // 5. Data Portability (Export & Import)
  async exportUserData(userId: UserId): Promise<UserDataExport> {
    const groups = Array.from(this.groups.values()).filter((g) => g.userId === userId && !g.deletedAt);
    const tasks = Array.from(this.tasks.values()).filter((t) => t.userId === userId && !t.deletedAt);
    const taskIds = new Set(tasks.map((t) => t.id));
    const milestones = Array.from(this.milestones.values()).filter((m) => taskIds.has(m.taskId));
    const events = Array.from(this.events.values()).filter((e) => e.userId === userId);

    return {
      exportedAt: new Date().toISOString(),
      userId,
      groups,
      tasks,
      milestones,
      events,
    };
  }

  async importUserData(
    userId: UserId,
    data: Omit<UserDataExport, 'exportedAt' | 'userId'>
  ): Promise<UserDataImportResult> {
    let importedGroups = 0;
    let importedTasks = 0;
    let importedMilestones = 0;
    let importedEvents = 0;

    for (const g of data.groups) {
      if (!this.groups.has(g.id)) {
        this.groups.set(g.id, { ...g, userId });
        importedGroups++;
      }
    }

    for (const t of data.tasks) {
      if (!this.tasks.has(t.id)) {
        this.tasks.set(t.id, { ...t, userId });
        importedTasks++;
      }
    }

    for (const m of data.milestones) {
      if (!this.milestones.has(m.id)) {
        this.milestones.set(m.id, m);
        importedMilestones++;
      }
    }

    for (const e of data.events) {
      if (!this.events.has(e.id)) {
        this.events.set(e.id, { ...e, userId });
        importedEvents++;
      }
    }

    return {
      importedGroups,
      importedTasks,
      importedMilestones,
      importedEvents,
    };
  }

  /**
   * Helper for tests: clear state
   */
  clear(): void {
    this.groups.clear();
    this.tasks.clear();
    this.milestones.clear();
    this.events.clear();
  }
}
