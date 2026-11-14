import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serverEnvSchema, type ServerEnv } from '@xesmona/contracts';
import { z } from 'zod';

// src/ and dist/ are at the same level, so the relative path works for both.
const rootEnvFile = fileURLToPath(new URL('../../../.env', import.meta.url));

/** Loads the root .env (only if it exists; on Railway variables come from the environment). */
export function loadEnv(): ServerEnv {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error(`Invalid server configuration:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }
  return result.data;
}
