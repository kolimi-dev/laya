/**
 * Laya (లయ) — Database Row to Domain Entity Mappers
 * Maps snake_case PostgreSQL rows to camelCase domain models.
 */

import { CompletionEvent, Task, TaskGroup, TaskMilestone } from '../domain/types.js';

export function mapRowToGroup(row: any): TaskGroup {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color ?? '#4F46E5',
    sortOrder: row.sort_order ?? 0,
    schedule: row.schedule ?? undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

export function mapRowToTask(row: any): Task {
  return {
    id: row.id,
    userId: row.user_id,
    groupId: row.group_id ?? null,
    title: row.title,
    taskType: row.task_type,
    recurrence: row.recurrence,
    cycleDays: row.cycle_days ? Number(row.cycle_days) : null,
    schedule: row.schedule ?? undefined,
    targetValue: row.target_value != null ? Number(row.target_value) : null,
    unit: row.unit ?? null,
    sortOrder: row.sort_order ?? 0,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

export function mapRowToMilestone(row: any): TaskMilestone {
  return {
    id: row.id,
    taskId: row.task_id,
    label: row.label,
    stepOrder: Number(row.step_order),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

export function mapRowToEvent(row: any): CompletionEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    milestoneId: row.milestone_id ?? null,
    userId: row.user_id,
    status: row.status,
    progressPercentage: row.progress_percentage != null ? Number(row.progress_percentage) : null,
    notes: row.notes ?? null,
    occurredAt: new Date(row.occurred_at).toISOString(),
    recordedAt: new Date(row.recorded_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

