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
  return { db };
}
