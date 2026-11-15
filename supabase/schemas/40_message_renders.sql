-- Chat messages that still have to show their game's latest state (ADR 0010).
-- Every edit renders the whole message from the latest database state, so a pending edit is
-- just "this game's message is behind": one row per game, and a second enqueue for the same
-- game coalesces into the first. The server edits right away when it can and only queues after
-- a 429 (waiting `retry_after`) or a transient error; a worker in the server drains the queue.

create table public.message_renders (
  game_id uuid primary key references public.games (id) on delete cascade,
  -- Not tried before this. Also used as the lease while the worker renders the row.
  not_before timestamptz not null default now(),
  -- Claims so far; the worker gives up after a few.
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index message_renders_not_before_idx on public.message_renders (not_before);

alter table public.message_renders enable row level security;
-- No policies: only the service role (server) can access this table.

-- Queues a render of the game's message, not before `p_delay_seconds` from now. A pending row
-- keeps its later `not_before`, so a render waiting out a 429 isn't brought forward.
create function public.enqueue_render(p_game_id uuid, p_delay_seconds integer default 0)
returns void
language sql
set search_path = ''
as $$
  insert into public.message_renders (game_id, not_before)
  values (p_game_id, now() + make_interval(secs => greatest(p_delay_seconds, 0)))
  on conflict (game_id) do update
  set not_before = greatest(public.message_renders.not_before, excluded.not_before);
$$;

-- Claims up to `p_limit` due renders for `p_lease_seconds`: another worker skips them until the
-- lease ends, and a crashed worker's rows come back after it.
create function public.claim_renders(p_limit integer default 20, p_lease_seconds integer default 30)
returns setof public.message_renders
language sql
set search_path = ''
as $$
  with due as (
    select game_id
    from public.message_renders
    where not_before <= now()
    order by not_before
    limit p_limit
    for update skip locked
  )
  update public.message_renders as r
  set not_before = now() + make_interval(secs => p_lease_seconds), attempts = r.attempts + 1
  from due
  where r.game_id = due.game_id
  returning r.*;
$$;

-- Records that the message shows `p_version` and drops the pending render if nothing newer is
-- left to show. An older confirmation never moves `rendered_version` back.
create function public.mark_rendered(p_game_id uuid, p_version integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
begin
  update public.games
  set rendered_version = greatest(coalesce(rendered_version, -1), p_version)
  where id = p_game_id
  returning * into v_game;

  if found and v_game.rendered_version >= v_game.version then
    delete from public.message_renders where game_id = p_game_id;
  end if;
end;
$$;

-- Only the server (service role) may call these. `db diff` ignores privileges, so these are
-- also applied by a hand-written migration (*_revoke_render_functions.sql): keep them in sync.
revoke execute on function public.enqueue_render from public, anon, authenticated;
revoke execute on function public.claim_renders from public, anon, authenticated;
revoke execute on function public.mark_rendered from public, anon, authenticated;
