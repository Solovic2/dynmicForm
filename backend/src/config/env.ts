import 'dotenv/config';
import { z } from 'zod';

/**
 * Central, validated configuration.
 * Importing this module loads `.env` (via dotenv) and validates the environment
 * once at boot. If required variables are missing the process exits with a
 * clear message instead of failing later with a cryptic runtime error.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  // Comma-separated list of allowed origins; empty means "reflect request origin".
  CORS_ORIGIN: z.string().optional(),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  // Expressed as vercel/ms strings understood by jsonwebtoken (e.g. "1h", "7d").
  ACCESS_TOKEN_TTL: z.string().default('1h'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),

  // S3-compatible object storage (MinIO in local dev).
  // Internal endpoint the backend uses; browser-reachable endpoint used to sign
  // download URLs (they differ under Docker: minio:9000 vs localhost:9000).
  S3_ENDPOINT: z.string().min(1, 'S3_ENDPOINT is required'),
  S3_PUBLIC_ENDPOINT: z.string().min(1, 'S3_PUBLIC_ENDPOINT is required'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
  S3_ACCESS_KEY_ID: z.string().min(1, 'S3_ACCESS_KEY_ID is required'),
  S3_SECRET_ACCESS_KEY: z.string().min(1, 'S3_SECRET_ACCESS_KEY is required'),
  // MinIO needs path-style addressing; real S3 uses virtual-hosted style.
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Global upload ceiling (bytes) enforced by the multipart parser.
  MAX_UPLOAD_BYTES: z.coerce.number().default(10 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
