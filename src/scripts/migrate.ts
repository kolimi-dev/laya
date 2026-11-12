/**
 * Laya (లయ) — Database Schema Migration Runner
 * Executes tracker schema migrations against Neon Serverless PostgreSQL.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSql, closeDatabaseConnection } from '../storage/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

async function runMigrations() {
  console.log('🚀 Running Laya tracker schema migrations...\n');

  const sql = getSql();
  if (!sql) {
    console.error('❌ DATABASE_URL is not configured. Migration aborted.\n');
    process.exit(1);
  }

  try {
    const migrationsDir = path.join(projectRoot, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found.');
      process.exit(0);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`📄 Executing migrations/${file}...`);
      const migrationSql = fs
        .readFileSync(path.join(migrationsDir, file), 'utf8')
        .replace(/^\uFEFF/, '')
        .trim();
      await sql.unsafe(migrationSql);
      console.log(`✅ migrations/${file} applied successfully.`);
    }

    console.log('\n🎉 All Laya tracker migrations completed successfully!');
    await closeDatabaseConnection();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Laya migration failed:', error);
    await closeDatabaseConnection();
    process.exit(1);
  }
}

runMigrations();
