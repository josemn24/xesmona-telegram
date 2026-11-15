-- Game state changes. Each function runs in one transaction. The engine (TypeScript) decides
-- what the new state is; these functions only guarantee that one change per version wins:
-- they return null when `p_expected_version` no longer matches (e.g. a simultaneous tap).

-- Creates a game and its players.
-- p_players: [{ "seat": 0, "kind": "human", "telegram_user_id": 1, "display_name": "Ada" }, …]
-- Returns null if an inline message already has a game (two first taps at once).
create function public.create_game(
  p_bot_id text,
  p_game_type text,
  p_created_by bigint,
  p_status text,
  p_state jsonb,
  p_players jsonb,
  p_mode text default null,
  p_bot_level text default null,
  p_inline_message_id text default null,
  p_chat_instance text default null
)
returns public.games
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
begin
  insert into public.games (
    bot_id, game_type, created_by, mode, bot_level, status, state,
    inline_message_id, chat_instance
  )
  values (
    p_bot_id, p_game_type, p_created_by, p_mode, p_bot_level, p_status, p_state,
    p_inline_message_id, p_chat_instance
  )
  on conflict (bot_id, inline_message_id) where inline_message_id is not null do nothing
  returning * into v_game;

  if not found then
    return null;
  end if;

  insert into public.game_players (game_id, seat, kind, telegram_user_id, display_name)
  select v_game.id, (p ->> 'seat')::smallint, p ->> 'kind',
    (p ->> 'telegram_user_id')::bigint, p ->> 'display_name'
  from jsonb_array_elements(p_players) as p;

  return v_game;
end;
$$;

-- Links a /play game to the message that shows it (sent after the game is created).
create function public.attach_message(
  p_game_id uuid,
  p_chat_id bigint,
  p_message_id integer,
  p_message_thread_id integer default null
)
returns public.games
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
begin
  update public.games
  set chat_id = p_chat_id,
    message_id = p_message_id,
    message_thread_id = p_message_thread_id,
    updated_at = now()
  where id = p_game_id and message_id is null and inline_message_id is null
  returning * into v_game;

  if not found then
    return null;
  end if;
  return v_game;
end;
$$;

-- Second player joins a waiting invitation.
create function public.join_game(
  p_game_id uuid,
  p_expected_version integer,
  p_telegram_user_id bigint,
  p_display_name text,
  p_state jsonb
)
returns public.games
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
begin
  update public.games
  set mode = 'pvp', status = 'playing', state = p_state,
    version = version + 1, updated_at = now()
  where id = p_game_id and version = p_expected_version and status = 'waiting'
  returning * into v_game;

  if not found then
    return null;
  end if;

  insert into public.game_players (game_id, seat, kind, telegram_user_id, display_name)
  values (p_game_id, 1, 'human', p_telegram_user_id, p_display_name);

  return v_game;
end;
$$;

-- The creator of a waiting invitation plays vs the bot instead.
create function public.start_vs_bot(
  p_game_id uuid,
  p_expected_version integer,
  p_bot_level text,
  p_bot_name text,
  p_state jsonb
)
returns public.games
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
begin
  update public.games
  set mode = 'vs_bot', bot_level = p_bot_level, status = 'playing', state = p_state,
    version = version + 1, updated_at = now()
  where id = p_game_id and version = p_expected_version and status = 'waiting'
  returning * into v_game;

  if not found then
    return null;
  end if;

  insert into public.game_players (game_id, seat, kind, display_name)
  values (p_game_id, 1, 'bot', p_bot_name);

  return v_game;
end;
$$;

-- Saves accepted moves (one, or two when the bot replies) or a rematch (no moves).
-- p_moves: [{ "seat": 0, "move": { "cell": 4 } }, …]; each move gets the next version.
-- Optional arguments have `default null` so they can be left out (generated types need it).
create function public.save_game(
  p_game_id uuid,
  p_expected_version integer,
  p_state jsonb,
  p_status text,
  p_round integer,
  p_moves jsonb default '[]'::jsonb,
  p_result text default null,
  p_winner_seat smallint default null
)
returns public.games
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
  v_count integer := jsonb_array_length(p_moves);
begin
  update public.games
  set state = p_state, status = p_status, result = p_result, winner_seat = p_winner_seat,
    round = p_round, version = version + greatest(v_count, 1), updated_at = now()
  where id = p_game_id and version = p_expected_version
  returning * into v_game;

  if not found then
    return null;
  end if;

  insert into public.game_moves (game_id, version, round, seat, move)
  select p_game_id, p_expected_version + m.ordinality::integer, p_round,
    (m.value ->> 'seat')::smallint, m.value -> 'move'
  from jsonb_array_elements(p_moves) with ordinality as m;

  return v_game;
end;
$$;

-- Only the server (service role) may call these. `db diff` ignores privileges, so these are
-- also applied by a hand-written migration (*_revoke_game_functions.sql): keep them in sync.
revoke execute on function public.create_game from public, anon, authenticated;
revoke execute on function public.attach_message from public, anon, authenticated;
revoke execute on function public.join_game from public, anon, authenticated;
revoke execute on function public.start_vs_bot from public, anon, authenticated;
revoke execute on function public.save_game from public, anon, authenticated;
