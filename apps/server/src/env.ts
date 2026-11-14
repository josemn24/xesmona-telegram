import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serverEnvSchema, type ServerEnv } from '@xesmona/contracts';
import { z } from 'zod';

// src/ y dist/ están al mismo nivel, así que la ruta relativa vale para ambos.
const rootEnvFile = fileURLToPath(new URL('../../../.env', import.meta.url));

/** Carga .env de la raíz (solo si existe; en Railway las variables vienen del entorno). */
export function loadEnv(): ServerEnv {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error(`Configuración del servidor inválida:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }
  return result.data;
}
