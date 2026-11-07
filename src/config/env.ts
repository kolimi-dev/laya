import { z } from 'zod';
import dotenv from 'dotenv';

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4001),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),

  // Platform JWKS Authority
  JWKS_URL: z.string().url('JWKS_URL must be a valid URL').default('http://localhost:3000/.well-known/jwks.json'),
  JWT_ISSUER: z.string().default('https://platform.kolimi.dev'),
  JWT_AUDIENCE: z.string().default('kolimi_studio_apps'),

  // Optional PostgreSQL database URL (defaults to in-memory store in dev/test)
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL').optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(overrides?: Partial<Env>): Env {
  if (overrides) {
    return envSchema.parse({ ...process.env, ...overrides });
  }
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}
