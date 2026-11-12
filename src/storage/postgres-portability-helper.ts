/**
 * Laya (లయ) — PostgreSQL Data Portability Helper
 * Batch export and restore routines for Neon PostgreSQL tracker schema.
 */

import postgres from 'postgres';
import { UserId } from '../domain/types.js';
import { UserDataExport, UserDataImportResult } from './tracker-repository.js';
import { PostgresTrackerRepository } from './postgres-tracker-repository.js';

export async function exportUserDataSql(
  repo: PostgresTrackerRepository,
  userId: UserId
): Promise<UserDataExport> {
  const [groups, tasksWithMilestones, events] = await Promise.all([
    repo.getGroupsByUserId(userId),
    repo.getTasksByUserId(userId, true),
    repo.getEventsForUser(userId),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    userId,
    groups,
    tasks: tasksWithMilestones.map((t) => t.task),
    milestones: tasksWithMilestones.flatMap((t) => t.milestones),
    events,
  };
}

export async function importUserDataSql(
  sql: postgres.Sql,
  userId: UserId,
  data: Omit<UserDataExport, 'exportedAt' | 'userId'>
): Promise<UserDataImportResult> {
  let importedGroups = 0, importedTasks = 0, importedMilestones = 0, importedEvents = 0;

  for (const g of data.groups) {
    const [res] = await sql`
      INSERT INTO tracker.groups (id, user_id, name, color, sort_order, schedule, created_by)
      VALUES (${g.id}, ${userId}, ${g.name}, ${g.color ?? '#4F46E5'}, ${g.sortOrder ?? 0}, ${g.schedule ? sql.json(g.schedule) : null}, ${userId})
      ON CONFLICT (id) DO NOTHING RETURNING id
    `;
    if (res) importedGroups++;
  }

  for (const t of data.tasks) {
    const [res] = await sql`
      INSERT INTO tracker.tasks (id, user_id, group_id, title, task_type, recurrence, cycle_days, schedule, target_value, unit, sort_order, created_by)
      VALUES (${t.id}, ${userId}, ${t.groupId ?? null}, ${t.title}, ${t.taskType}, ${t.recurrence}, ${t.cycleDays ?? null}, ${t.schedule ? sql.json(t.schedule) : null}, ${t.targetValue ?? null}, ${t.unit ?? null}, ${t.sortOrder ?? 0}, ${userId})
      ON CONFLICT (id) DO NOTHING RETURNING id
    `;
    if (res) importedTasks++;
  }

  for (const m of data.milestones) {
    const [res] = await sql`
      INSERT INTO tracker.task_milestones (id, task_id, label, step_order, created_by)
      VALUES (${m.id}, ${m.taskId}, ${m.label}, ${m.stepOrder}, ${userId})
      ON CONFLICT (id) DO NOTHING RETURNING id
    `;
    if (res) importedMilestones++;
  }

  for (const e of data.events) {
    const [res] = await sql`
      INSERT INTO tracker.completion_events (id, task_id, milestone_id, user_id, status, progress_percentage, notes, occurred_at, recorded_at, created_by)
      VALUES (${e.id}, ${e.taskId}, ${e.milestoneId ?? null}, ${userId}, ${e.status}, ${e.progressPercentage ?? null}, ${e.notes ?? null}, ${e.occurredAt}, ${e.recordedAt || new Date().toISOString()}, ${userId})
      ON CONFLICT (id) DO NOTHING RETURNING id
    `;
    if (res) importedEvents++;
  }

  return { importedGroups, importedTasks, importedMilestones, importedEvents };
}

