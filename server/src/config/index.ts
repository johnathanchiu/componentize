import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1000).max(65535)).default('5001'),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  ALLOWED_ORIGINS: z.string().transform(str => str.split(',')).default('http://localhost:5173'),
  MODEL_NAME: z.string().default('claude-sonnet-4-5-20250929'),
  MAX_TOKENS: z.string().transform(Number).pipe(z.number().positive()).default('16000'),
  MAX_ITERATIONS: z.string().transform(Number).pipe(z.number().positive()).default('150'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()).default('100'),
});

// Validate and parse environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    process.exit(1);
  }
};

export const config = parseEnv();

// Export typed config object
export const appConfig = {
  env: config.NODE_ENV,
  port: config.PORT,
  isDevelopment: config.NODE_ENV === 'development',
  isProduction: config.NODE_ENV === 'production',

  api: {
    anthropicApiKey: config.ANTHROPIC_API_KEY,
    modelName: config.MODEL_NAME,
    maxTokens: config.MAX_TOKENS,
    maxIterations: config.MAX_ITERATIONS,
  },

  cors: {
    allowedOrigins: config.ALLOWED_ORIGINS,
  },

  rateLimit: {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    // Disable rate limiting in development
    max: config.NODE_ENV === 'development' ? 0 : config.RATE_LIMIT_MAX_REQUESTS,
  },
};
