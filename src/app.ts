import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Env, getEnv } from './config/env.js';
import { TrackerRepository } from './storage/tracker-repository.js';
import { InMemoryTrackerRepository } from './storage/in-memory-tracker-repository.js';
import { JwtVerifier } from './auth/types.js';
import { MockJwtVerifier, RemoteJwksVerifier } from './auth/jwt-verifier.js';
import { createAuthPreHandler } from './auth/auth-middleware.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { groupRoutes } from './routes/groups.js';
import { taskRoutes } from './routes/tasks.js';
import { consistencyRoutes } from './routes/consistency.js';
import { dataRoutes } from './routes/data.js';
import { feedbackRoutes } from './routes/feedback.js';

export interface AppOptions {
  repository?: TrackerRepository;
  jwtVerifier?: JwtVerifier;
  envOverrides?: Partial<Env>;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const env = getEnv(options.envOverrides);

  const app = fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: 'info',
            transport:
              env.NODE_ENV === 'development'
                ? {
                    target: 'pino-pretty',
                    options: { colorize: true },
                  }
                : undefined,
          },
  });

  // 1. Cross-Origin Resource Sharing
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // 2. RFC 7807 Error Handler Plugin
  registerErrorHandler(app);

  // 3. Dependency Injection
  const repository = options.repository ?? new InMemoryTrackerRepository();
  const verifier =
    options.jwtVerifier ??
    (env.NODE_ENV === 'test'
      ? new MockJwtVerifier()
      : new RemoteJwksVerifier({
          jwksUrl: env.JWKS_URL,
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
        }));

  // 4. Public Routes
  await app.register(healthRoutes);

  // 5. Authenticated Domain Routes
  await app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', createAuthPreHandler(verifier));

    await protectedApp.register(groupRoutes, { repository });
    await protectedApp.register(taskRoutes, { repository });
    await protectedApp.register(consistencyRoutes, { repository });
    await protectedApp.register(dataRoutes, { repository });
    await protectedApp.register(feedbackRoutes);
  });

  return app;
}
