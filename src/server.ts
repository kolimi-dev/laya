import { buildApp } from './app.js';
import { getEnv } from './config/env.js';
import { getSql, closeDatabaseConnection } from './storage/db.js';

async function start(): Promise<void> {
  const env = getEnv();
  const app = await buildApp();
  const sql = getSql();

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`\n======================================================`);
    console.log(`✨ [Laya (లయ)] Consistency & Rhythm Engine Started`);
    console.log(`   Address:  ${address}`);
    console.log(`   Health:   ${address}/api/v1/health`);
    console.log(`   Checklist: ${address}/api/v1/tasks/active`);
    console.log(`   JWKS:     ${env.JWKS_URL}`);
    console.log(`   Storage:  ${sql ? 'PostgreSQL (Neon DB)' : 'In-Memory (Ephemeral)'}`);
    console.log(`   Mode:     ${env.NODE_ENV}`);
    console.log(`======================================================\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\n🛑 Received ${signal}, shutting down Laya gracefully...`);
      await app.close();
      await closeDatabaseConnection();
      process.exit(0);
    });
  }
}

start();
