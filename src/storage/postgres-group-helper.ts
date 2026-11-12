/**
 * Laya (లయ) — PostgreSQL Group Operations Helper
 * Queries and updates tracker.groups table with multi-tenant user isolation.
 */

import postgres from 'postgres';
import { GroupId, TaskGroup, UserId } from '../domain/types.js';
import { mapRowToGroup } from './db-mappers.js';

export async function createGroupSql(sql: postgres.Sql, group: TaskGroup): Promise<TaskGroup> {
  const [row] = await sql`
    INSERT INTO tracker.groups (
      id, user_id, name, color, sort_order, schedule, created_by, updated_by
    ) VALUES (
      ${group.id}, ${group.userId}, ${group.name}, ${group.color ?? '#4F46E5'},
      ${group.sortOrder ?? 0}, ${group.schedule ? sql.json(group.schedule) : null},
      ${group.createdBy ?? group.userId}, ${group.updatedBy ?? group.userId}
    )
    RETURNING *
  `;
  return mapRowToGroup(row);
}

export async function getGroupByIdSql(sql: postgres.Sql, id: GroupId, userId: UserId): Promise<TaskGroup | null> {
  const [row] = await sql`
    SELECT * FROM tracker.groups
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
  `;
  return row ? mapRowToGroup(row) : null;
}

export async function getGroupsByUserIdSql(sql: postgres.Sql, userId: UserId): Promise<TaskGroup[]> {
  const rows = await sql`
    SELECT * FROM tracker.groups
    WHERE user_id = ${userId} AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
  `;
  return rows.map(mapRowToGroup);
}

export async function updateGroupSql(
  sql: postgres.Sql,
  id: GroupId,
  userId: UserId,
  updates: Partial<Pick<TaskGroup, 'name' | 'color' | 'sortOrder' | 'schedule'>>
): Promise<TaskGroup> {
  const existing = await getGroupByIdSql(sql, id, userId);
  if (!existing) throw new Error(`Group '${id}' not found for user '${userId}'.`);

  const name = updates.name ?? existing.name;
  const color = updates.color ?? existing.color ?? '#4F46E5';
  const sortOrder = updates.sortOrder ?? existing.sortOrder ?? 0;
  const schedule = updates.schedule !== undefined ? updates.schedule : existing.schedule;

  const [row] = await sql`
    UPDATE tracker.groups
    SET name = ${name}, color = ${color}, sort_order = ${sortOrder},
        schedule = ${schedule ? sql.json(schedule) : null},
        updated_at = NOW(), updated_by = ${userId}
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING *
  `;
  return mapRowToGroup(row);
}

export async function softDeleteGroupSql(sql: postgres.Sql, id: GroupId, userId: UserId): Promise<void> {
  await sql`
    UPDATE tracker.groups
    SET deleted_at = NOW(), updated_at = NOW(), updated_by = ${userId}
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
  `;
}
