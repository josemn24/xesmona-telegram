-- Initial migration (setup smoke test).
-- Registry of known bots; the rest of the data model arrives in Phase 1.
create table public.bots (
  id text primary key check (id ~ '^[a-z][a-z0-9-]*$'),
  description text,
  created_at timestamptz not null default now()
);

alter table public.bots enable row level security;
-- No policies: only the service role (server) can access this table.

comment on table public.bots is 'Xesmona Telegram bots registered on the platform';
