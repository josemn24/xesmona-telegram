import { createClient } from '@supabase/supabase-js';
import type { BotServices, Database, ServerEnv } from '@xesmona/contracts';

/** Creates the shared services for bots. Exits if the database isn't configured. */
export function createServices(env: ServerEnv): BotServices {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      '[server] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run bots ' +
        '(locally: `pnpm db:start`, then copy the values from `supabase status`).',
    );
    process.exit(1);
  }
  // Service role on the server only: no user sessions to persist or refresh.
  const db = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Mini App games need Realtime; bots in the chat work without it (ADR 0009).
  const realtime =
    env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_JWT_SECRET
      ? {
          supabaseUrl: env.SUPABASE_URL,
          publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
          jwtSecret: env.SUPABASE_JWT_SECRET,
        }
      : undefined;
  if (!realtime) {
    console.warn(
      '[server] SUPABASE_PUBLISHABLE_KEY or SUPABASE_JWT_SECRET not set: Mini App games are off',
    );
  }
  return { db, ...(realtime && { realtime }) };
}
