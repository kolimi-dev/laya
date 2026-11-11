/**
 * Laya (లయ) — In-Memory Data Portability Helper
 * Implements backup export and restore operations for in-memory tracker storage.
 */

import { Task, TaskGroup, TaskMilestone, CompletionEvent, UserId } from '../domain/types.js';
import { UserDataExport, UserDataImportResult } from './tracker-repository.js';

export function exportFromMaps(
  userId: UserId,
  groups: Map<string, TaskGroup>,
  tasks: Map<string, Task>,
  milestones: Map<string, TaskMilestone>,
  events: Map<string, CompletionEvent>
): UserDataExport {
  const userGroups = Array.from(groups.values()).filter((g) => g.userId === userId && !g.deletedAt);
  const userTasks = Array.from(tasks.values()).filter((t) => t.userId === userId && !t.deletedAt);
  const taskIds = new Set(userTasks.map((t) => t.id));
  const userMilestones = Array.from(milestones.values()).filter((m) => taskIds.has(m.taskId));
  const userEvents = Array.from(events.values()).filter((e) => e.userId === userId);

  return {
    exportedAt: new Date().toISOString(),
    userId,
    groups: userGroups,
    tasks: userTasks,
    milestones: userMilestones,
    events: userEvents,
  };
}

export function importIntoMaps(
  userId: UserId,
  data: Omit<UserDataExport, 'exportedAt' | 'userId'>,
  groups: Map<string, TaskGroup>,
  tasks: Map<string, Task>,
  milestones: Map<string, TaskMilestone>,
  events: Map<string, CompletionEvent>
): UserDataImportResult {
  let importedGroups = 0;
  let importedTasks = 0;
  let importedMilestones = 0;
  let importedEvents = 0;

  for (const g of data.groups) {
    if (!groups.has(g.id)) {
      groups.set(g.id, { ...g, userId });
      importedGroups++;
    }
  }

  for (const t of data.tasks) {
    if (!tasks.has(t.id)) {
      tasks.set(t.id, { ...t, userId });
      importedTasks++;
    }
  }

  for (const m of data.milestones) {
    if (!milestones.has(m.id)) {
      milestones.set(m.id, m);
      importedMilestones++;
    }
  }

  for (const e of data.events) {
    if (!events.has(e.id)) {
      events.set(e.id, { ...e, userId });
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

