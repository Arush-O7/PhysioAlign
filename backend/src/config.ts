import 'dotenv/config';
import crypto from 'crypto';
import { z } from 'zod';

const env = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().default(5001),
    DATABASE_URL: z.string().optional(),
    AUTH_SECRET: z.string().optional(),
    // GEMINI_API_KEY is the real name, the VITE_ one is still read so older .env files keep working
    GEMINI_API_KEY: z.string().optional(),
    VITE_GEMINI_API_KEY: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    VITE_GOOGLE_CLIENT_ID: z.string().optional(),
    ADMIN_EMAILS: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
  })
  .parse(process.env);

if (!env.AUTH_SECRET) {
  console.warn('[config] AUTH_SECRET is not set, using a random one. Everyone is logged out on restart.');
}

export const config = {
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  authSecret: env.AUTH_SECRET || crypto.randomBytes(32).toString('hex'),
  geminiApiKey: env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '',
  googleClientId:
    env.GOOGLE_CLIENT_ID ||
    env.VITE_GOOGLE_CLIENT_ID ||
    '303655418647-jmkugqbao9oc38na1qigl309qsa7gg96.apps.googleusercontent.com',
  adminEmails: (env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  corsOrigins: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : [],
};
