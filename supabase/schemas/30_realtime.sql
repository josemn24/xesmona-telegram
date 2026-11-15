-- Live game updates for the Mini Apps (Phase 2).
-- The Mini App never reads tables: it gets snapshots from the server API and then listens to
-- Supabase Realtime broadcasts on the private topic `game:<game uuid>`. The server signs a
-- Supabase JWT for the player (`role: authenticated`, `sub: <telegram user id>`).

-- True when the Telegram user plays in the game. Security definer because `authenticated`
-- has no access to `game_players` (RLS without policies); it only answers yes/no.
create function public.is_game_player(p_game_id uuid, p_user_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_players
    where game_id = p_game_id and telegram_user_id = p_user_id
  );
$$;

-- Broadcasts the game snapshot after every accepted change. Done in the database, inside the
-- same transaction as the save, so a broadcast is only sent for a committed change and the
-- server can't forget one. Players see the new version even if the move came from another
-- client (another player, the bot reply, the chat inline keyboard). Private: only players
-- may subscribe (policy below). `realtime.send` never raises (it logs a warning), so a
-- Realtime problem can't make a move fail. Security definer so it doesn't depend on the
-- caller being allowed to insert into `realtime.messages`.
create function public.broadcast_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'version', new.version,
      'state', new.state,
      'status', new.status,
      'result', new.result,
      'winner_seat', new.winner_seat,
      'round', new.round,
      'mode', new.mode
    ),
    'game',
    'game:' || new.id::text,
    true
  );
  return null;
end;
$$;

-- Every state change bumps `version`; updates that don't (e.g. attach_message) aren't news
-- for the players.
create trigger games_broadcast_change
  after update on public.games
  for each row
  when (new.version is distinct from old.version)
  execute function public.broadcast_game_change();

-- Only the game's players may receive its broadcasts. No insert policy: clients never
-- broadcast, only the server does (through the trigger above).
-- `case` guards the casts so a malformed topic or a non-numeric `sub` gives false instead of
-- an error (`and` doesn't guarantee evaluation order). Lengths instead of `$` anchors:
-- `db diff` mangles a `$'` sequence in the generated migration.
create policy "game players receive game broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and case
      when length(realtime.topic()) = 41
        and realtime.topic() ~ '^game:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        and length(auth.jwt() ->> 'sub') between 1 and 18
        and (auth.jwt() ->> 'sub') !~ '[^0-9]'
      then public.is_game_player(
        split_part(realtime.topic(), ':', 2)::uuid,
        (auth.jwt() ->> 'sub')::bigint
      )
      else false
    end
  );

-- `db diff` ignores privileges, so these are also applied by the hand-written migration
-- (*_revoke_realtime_functions.sql): keep them in sync.
-- The trigger function is only for the trigger.
revoke execute on function public.broadcast_game_change from public, anon, authenticated;
-- The policy runs as `authenticated`, so it needs `is_game_player`; `anon` doesn't.
revoke execute on function public.is_game_player from public, anon;
grant execute on function public.is_game_player to authenticated;
