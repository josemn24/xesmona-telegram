-- Abandoned games expire with no winner (ADR 0010): invitations nobody accepted and games
-- nobody plays any more. Run periodically by the server's render worker.
--
-- Expiring bumps `version`, so the Realtime trigger tells open Mini Apps (30_realtime.sql)
-- and buttons still showing the old version are rejected as stale. Games with a chat message
-- get a queued render so the message says it expired.
-- Returns how many games expired.
create function public.expire_games(
  p_waiting interval default interval '24 hours',
  p_idle interval default interval '7 days'
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.games
    set status = 'expired', version = version + 1, updated_at = now()
    where (status = 'waiting' and updated_at < now() - p_waiting)
      or (status = 'playing' and updated_at < now() - p_idle)
    returning id, chat_id, inline_message_id
  ),
  queued as (
    insert into public.message_renders (game_id)
    select id from expired where chat_id is not null or inline_message_id is not null
    on conflict (game_id) do nothing
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

-- Only the server (service role) may call this. `db diff` ignores privileges, so this is also
-- applied by the hand-written *_privileges_and_bootstrap_data.sql migration: keep them in sync.
revoke execute on function public.expire_games from public, anon, authenticated;
