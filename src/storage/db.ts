/**
 * Laya (లయ) — PostgreSQL Database Client & Connection Manager
 * Neon Serverless PostgreSQL connection pooling with Fail-Fast health check.
 */

import postgres from 'postgres';
import { getEnv } from '../config/env.js';

let sqlClient: ReturnType<typeof postgres> | null = null;

export function getSql(): ReturnType<typeof postgres> | null {
  const env = getEnv();
  if (!env.DATABASE_URL) return null;
  if (!sqlClient) {
    sqlClient = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
    });
  }
  return sqlClient;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    const result = await sql`SELECT 1 as healthy`;
    return result[0]?.healthy === 1;
  } catch {
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
  }
}
