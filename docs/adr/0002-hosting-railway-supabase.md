# ADR 0002: Railway + Supabase as initial hosting

- Status: accepted (2026-11-14)

## Context

The initial proposal used Vercel + Railway + Supabase: three providers, three environments and
nine combinations of secrets and deployments before having any users.

## Decision

- **Railway:** a single Node service (`apps/server`) with the Hono API, the webhooks of all
  bots, the workers and the Mini Apps' static files (`/apps/<name>/`).
- **Supabase Cloud (EU):** Postgres, Realtime, Storage and Queues.

## Consequences

- One long-running process: no serverless function duration limits for queues and retries.
- A bot or worker under heavy load can be moved to its own Railway service without code changes.
- The Mini Apps could move to a CDN if traffic justifies it.
