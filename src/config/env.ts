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
  JWKS_URL: z.string().url('JWKS_URL must be a valid URL').default('https://platform.kolimi.dev/.well-known/jwks.json'),
  JWT_ISSUER: z.string().default('https://platform.kolimi.dev'),
  JWT_AUDIENCE: z.string().default('kolimi_studio_apps'),
  JWT_SECRET: z.string().default('laya_dev_jwt_secret_change_in_production_min32chars'),
  ALLOW_BETA_TOKENS: z.coerce.boolean().default(false),

  // Email OTP via Resend (kolimi.dev)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Kolimi ID <auth@kolimi.dev>'),

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
