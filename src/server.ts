import { buildApp } from './app.js';
import { getEnv } from './config/env.js';

async function start(): Promise<void> {
  const env = getEnv();
  const app = await buildApp();

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`\n======================================================`);
    console.log(`✨ [Laya (लय)] Consistency & Rhythm Engine Started`);
    console.log(`   Address:  ${address}`);
    console.log(`   Health:   ${address}/api/v1/health`);
    console.log(`   Checklist: ${address}/api/v1/tasks/active`);
    console.log(`   JWKS:     ${env.JWKS_URL}`);
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
      process.exit(0);
    });
  }
}

start();
