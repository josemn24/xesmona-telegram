
  create table "public"."bots" (
    "id" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."bots" enable row level security;


  create table "public"."game_moves" (
    "game_id" uuid not null,
    "version" integer not null,
    "round" integer not null,
    "seat" smallint not null,
    "move" jsonb not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."game_moves" enable row level security;


  create table "public"."game_players" (
    "game_id" uuid not null,
    "seat" smallint not null,
    "kind" text not null,
    "telegram_user_id" bigint,
    "display_name" text not null,
    "joined_at" timestamp with time zone not null default now()
      );


alter table "public"."game_players" enable row level security;


  create table "public"."games" (
    "id" uuid not null default gen_random_uuid(),
    "bot_id" text not null,
    "game_type" text not null,
    "mode" text,
    "bot_level" text,
    "status" text not null default 'waiting'::text,
    "state" jsonb not null,
    "version" integer not null default 0,
    "result" text,
    "winner_seat" smallint,
    "round" integer not null default 0,
    "created_by" bigint not null,
    "chat_id" bigint,
    "message_id" integer,
    "message_thread_id" integer,
    "inline_message_id" text,
    "chat_instance" text,
    "rendered_version" integer,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."games" enable row level security;


  create table "public"."message_renders" (
    "game_id" uuid not null,
    "not_before" timestamp with time zone not null default now(),
    "attempts" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."message_renders" enable row level security;


  create table "public"."telegram_users" (
    "id" bigint not null,
    "first_name" text not null,
    "username" text,
    "language_code" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."telegram_users" enable row level security;

CREATE UNIQUE INDEX bots_pkey ON public.bots USING btree (id);

CREATE UNIQUE INDEX game_moves_pkey ON public.game_moves USING btree (game_id, version);

CREATE UNIQUE INDEX game_players_game_id_telegram_user_id_key ON public.game_players USING btree (game_id, telegram_user_id);

CREATE UNIQUE INDEX game_players_pkey ON public.game_players USING btree (game_id, seat);

CREATE INDEX game_players_telegram_user_idx ON public.game_players USING btree (telegram_user_id);

CREATE UNIQUE INDEX games_chat_message_idx ON public.games USING btree (bot_id, chat_id, message_id) WHERE (message_id IS NOT NULL);

CREATE INDEX games_created_by_idx ON public.games USING btree (created_by);

CREATE UNIQUE INDEX games_inline_message_idx ON public.games USING btree (bot_id, inline_message_id) WHERE (inline_message_id IS NOT NULL);

CREATE UNIQUE INDEX games_pkey ON public.games USING btree (id);

CREATE INDEX message_renders_not_before_idx ON public.message_renders USING btree (not_before);

CREATE UNIQUE INDEX message_renders_pkey ON public.message_renders USING btree (game_id);

CREATE UNIQUE INDEX telegram_users_pkey ON public.telegram_users USING btree (id);

alter table "public"."bots" add constraint "bots_pkey" PRIMARY KEY using index "bots_pkey";

alter table "public"."game_moves" add constraint "game_moves_pkey" PRIMARY KEY using index "game_moves_pkey";

alter table "public"."game_players" add constraint "game_players_pkey" PRIMARY KEY using index "game_players_pkey";

alter table "public"."games" add constraint "games_pkey" PRIMARY KEY using index "games_pkey";

alter table "public"."message_renders" add constraint "message_renders_pkey" PRIMARY KEY using index "message_renders_pkey";

alter table "public"."telegram_users" add constraint "telegram_users_pkey" PRIMARY KEY using index "telegram_users_pkey";

alter table "public"."bots" add constraint "bots_id_check" CHECK ((id ~ '^[a-z][a-z0-9-]*$'::text)) not valid;

alter table "public"."bots" validate constraint "bots_id_check";

alter table "public"."game_moves" add constraint "game_moves_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE not valid;

alter table "public"."game_moves" validate constraint "game_moves_game_id_fkey";

alter table "public"."game_moves" add constraint "game_moves_seat_check" CHECK ((seat = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."game_moves" validate constraint "game_moves_seat_check";

alter table "public"."game_players" add constraint "game_players_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE not valid;

alter table "public"."game_players" validate constraint "game_players_game_id_fkey";

alter table "public"."game_players" add constraint "game_players_game_id_telegram_user_id_key" UNIQUE using index "game_players_game_id_telegram_user_id_key";

alter table "public"."game_players" add constraint "game_players_human_has_user" CHECK (((kind = 'human'::text) = (telegram_user_id IS NOT NULL))) not valid;

alter table "public"."game_players" validate constraint "game_players_human_has_user";

alter table "public"."game_players" add constraint "game_players_kind_check" CHECK ((kind = ANY (ARRAY['human'::text, 'bot'::text]))) not valid;

alter table "public"."game_players" validate constraint "game_players_kind_check";

alter table "public"."game_players" add constraint "game_players_seat_check" CHECK ((seat = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."game_players" validate constraint "game_players_seat_check";

alter table "public"."game_players" add constraint "game_players_telegram_user_id_fkey" FOREIGN KEY (telegram_user_id) REFERENCES public.telegram_users(id) not valid;

alter table "public"."game_players" validate constraint "game_players_telegram_user_id_fkey";

alter table "public"."games" add constraint "games_bot_id_fkey" FOREIGN KEY (bot_id) REFERENCES public.bots(id) not valid;

alter table "public"."games" validate constraint "games_bot_id_fkey";

alter table "public"."games" add constraint "games_bot_level_check" CHECK ((bot_level = ANY (ARRAY['easy'::text, 'normal'::text, 'hard'::text]))) not valid;

alter table "public"."games" validate constraint "games_bot_level_check";

alter table "public"."games" add constraint "games_chat_message_pair" CHECK (((chat_id IS NULL) = (message_id IS NULL))) not valid;

alter table "public"."games" validate constraint "games_chat_message_pair";

alter table "public"."games" add constraint "games_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.telegram_users(id) not valid;

alter table "public"."games" validate constraint "games_created_by_fkey";

alter table "public"."games" add constraint "games_game_type_check" CHECK ((game_type = ANY (ARRAY['tic-tac-toe'::text, 'four-in-a-row'::text]))) not valid;

alter table "public"."games" validate constraint "games_game_type_check";

alter table "public"."games" add constraint "games_level_only_vs_bot" CHECK (((NOT (mode IS DISTINCT FROM 'vs_bot'::text)) = (bot_level IS NOT NULL))) not valid;

alter table "public"."games" validate constraint "games_level_only_vs_bot";

alter table "public"."games" add constraint "games_mode_check" CHECK ((mode = ANY (ARRAY['pvp'::text, 'vs_bot'::text]))) not valid;

alter table "public"."games" validate constraint "games_mode_check";

alter table "public"."games" add constraint "games_mode_once_started" CHECK (((status = ANY (ARRAY['waiting'::text, 'expired'::text])) OR (mode IS NOT NULL))) not valid;

alter table "public"."games" validate constraint "games_mode_once_started";

alter table "public"."games" add constraint "games_result_check" CHECK ((result = ANY (ARRAY['win'::text, 'draw'::text]))) not valid;

alter table "public"."games" validate constraint "games_result_check";

alter table "public"."games" add constraint "games_round_check" CHECK ((round >= 0)) not valid;

alter table "public"."games" validate constraint "games_round_check";

alter table "public"."games" add constraint "games_single_message_ref" CHECK ((NOT ((message_id IS NOT NULL) AND (inline_message_id IS NOT NULL)))) not valid;

alter table "public"."games" validate constraint "games_single_message_ref";

alter table "public"."games" add constraint "games_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'playing'::text, 'finished'::text, 'expired'::text]))) not valid;

alter table "public"."games" validate constraint "games_status_check";

alter table "public"."games" add constraint "games_version_check" CHECK ((version >= 0)) not valid;

alter table "public"."games" validate constraint "games_version_check";

alter table "public"."games" add constraint "games_winner_only_on_win" CHECK (((result = 'win'::text) = (winner_seat IS NOT NULL))) not valid;

alter table "public"."games" validate constraint "games_winner_only_on_win";

alter table "public"."games" add constraint "games_winner_seat_check" CHECK ((winner_seat = ANY (ARRAY[0, 1]))) not valid;

alter table "public"."games" validate constraint "games_winner_seat_check";

alter table "public"."message_renders" add constraint "message_renders_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE not valid;

alter table "public"."message_renders" validate constraint "message_renders_game_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.attach_message(p_game_id uuid, p_chat_id bigint, p_message_id integer, p_message_thread_id integer DEFAULT NULL::integer)
 RETURNS public.games
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.broadcast_game_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.claim_renders(p_limit integer DEFAULT 20, p_lease_seconds integer DEFAULT 30)
 RETURNS SETOF public.message_renders
 LANGUAGE sql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_game(p_bot_id text, p_game_type text, p_created_by bigint, p_status text, p_state jsonb, p_players jsonb, p_mode text DEFAULT NULL::text, p_bot_level text DEFAULT NULL::text, p_inline_message_id text DEFAULT NULL::text, p_chat_instance text DEFAULT NULL::text)
 RETURNS public.games
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_render(p_game_id uuid, p_delay_seconds integer DEFAULT 0)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  insert into public.message_renders (game_id, not_before)
  values (p_game_id, now() + make_interval(secs => greatest(p_delay_seconds, 0)))
  on conflict (game_id) do update
  set not_before = greatest(public.message_renders.not_before, excluded.not_before);
$function$
;

CREATE OR REPLACE FUNCTION public.expire_games(p_waiting interval DEFAULT '24:00:00'::interval, p_idle interval DEFAULT '7 days'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_game_player(p_game_id uuid, p_user_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.game_players
    where game_id = p_game_id and telegram_user_id = p_user_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.join_game(p_game_id uuid, p_expected_version integer, p_telegram_user_id bigint, p_display_name text, p_state jsonb)
 RETURNS public.games
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.mark_rendered(p_game_id uuid, p_version integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.save_game(p_game_id uuid, p_expected_version integer, p_state jsonb, p_status text, p_round integer, p_moves jsonb DEFAULT '[]'::jsonb, p_result text DEFAULT NULL::text, p_winner_seat smallint DEFAULT NULL::smallint)
 RETURNS public.games
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.start_vs_bot(p_game_id uuid, p_expected_version integer, p_bot_level text, p_bot_name text, p_state jsonb)
 RETURNS public.games
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

grant delete on table "public"."bots" to "anon";

grant insert on table "public"."bots" to "anon";

grant references on table "public"."bots" to "anon";

grant select on table "public"."bots" to "anon";

grant trigger on table "public"."bots" to "anon";

grant truncate on table "public"."bots" to "anon";

grant update on table "public"."bots" to "anon";

grant delete on table "public"."bots" to "authenticated";

grant insert on table "public"."bots" to "authenticated";

grant references on table "public"."bots" to "authenticated";

grant select on table "public"."bots" to "authenticated";

grant trigger on table "public"."bots" to "authenticated";

grant truncate on table "public"."bots" to "authenticated";

grant update on table "public"."bots" to "authenticated";

grant delete on table "public"."bots" to "service_role";

grant insert on table "public"."bots" to "service_role";

grant references on table "public"."bots" to "service_role";

grant select on table "public"."bots" to "service_role";

grant trigger on table "public"."bots" to "service_role";

grant truncate on table "public"."bots" to "service_role";

grant update on table "public"."bots" to "service_role";

grant delete on table "public"."game_moves" to "anon";

grant insert on table "public"."game_moves" to "anon";

grant references on table "public"."game_moves" to "anon";

grant select on table "public"."game_moves" to "anon";

grant trigger on table "public"."game_moves" to "anon";

grant truncate on table "public"."game_moves" to "anon";

grant update on table "public"."game_moves" to "anon";

grant delete on table "public"."game_moves" to "authenticated";

grant insert on table "public"."game_moves" to "authenticated";

grant references on table "public"."game_moves" to "authenticated";

grant select on table "public"."game_moves" to "authenticated";

grant trigger on table "public"."game_moves" to "authenticated";

grant truncate on table "public"."game_moves" to "authenticated";

grant update on table "public"."game_moves" to "authenticated";

grant delete on table "public"."game_moves" to "service_role";

grant insert on table "public"."game_moves" to "service_role";

grant references on table "public"."game_moves" to "service_role";

grant select on table "public"."game_moves" to "service_role";

grant trigger on table "public"."game_moves" to "service_role";

grant truncate on table "public"."game_moves" to "service_role";

grant update on table "public"."game_moves" to "service_role";

grant delete on table "public"."game_players" to "anon";

grant insert on table "public"."game_players" to "anon";

grant references on table "public"."game_players" to "anon";

grant select on table "public"."game_players" to "anon";

grant trigger on table "public"."game_players" to "anon";

grant truncate on table "public"."game_players" to "anon";

grant update on table "public"."game_players" to "anon";

grant delete on table "public"."game_players" to "authenticated";

grant insert on table "public"."game_players" to "authenticated";

grant references on table "public"."game_players" to "authenticated";

grant select on table "public"."game_players" to "authenticated";

grant trigger on table "public"."game_players" to "authenticated";

grant truncate on table "public"."game_players" to "authenticated";

grant update on table "public"."game_players" to "authenticated";

grant delete on table "public"."game_players" to "service_role";

grant insert on table "public"."game_players" to "service_role";

grant references on table "public"."game_players" to "service_role";

grant select on table "public"."game_players" to "service_role";

grant trigger on table "public"."game_players" to "service_role";

grant truncate on table "public"."game_players" to "service_role";

grant update on table "public"."game_players" to "service_role";

grant delete on table "public"."games" to "anon";

grant insert on table "public"."games" to "anon";

grant references on table "public"."games" to "anon";

grant select on table "public"."games" to "anon";

grant trigger on table "public"."games" to "anon";

grant truncate on table "public"."games" to "anon";

grant update on table "public"."games" to "anon";

grant delete on table "public"."games" to "authenticated";

grant insert on table "public"."games" to "authenticated";

grant references on table "public"."games" to "authenticated";

grant select on table "public"."games" to "authenticated";

grant trigger on table "public"."games" to "authenticated";

grant truncate on table "public"."games" to "authenticated";

grant update on table "public"."games" to "authenticated";

grant delete on table "public"."games" to "service_role";

grant insert on table "public"."games" to "service_role";

grant references on table "public"."games" to "service_role";

grant select on table "public"."games" to "service_role";

grant trigger on table "public"."games" to "service_role";

grant truncate on table "public"."games" to "service_role";

grant update on table "public"."games" to "service_role";

grant delete on table "public"."message_renders" to "anon";

grant insert on table "public"."message_renders" to "anon";

grant references on table "public"."message_renders" to "anon";

grant select on table "public"."message_renders" to "anon";

grant trigger on table "public"."message_renders" to "anon";

grant truncate on table "public"."message_renders" to "anon";

grant update on table "public"."message_renders" to "anon";

grant delete on table "public"."message_renders" to "authenticated";

grant insert on table "public"."message_renders" to "authenticated";

grant references on table "public"."message_renders" to "authenticated";

grant select on table "public"."message_renders" to "authenticated";

grant trigger on table "public"."message_renders" to "authenticated";

grant truncate on table "public"."message_renders" to "authenticated";

grant update on table "public"."message_renders" to "authenticated";

grant delete on table "public"."message_renders" to "service_role";

grant insert on table "public"."message_renders" to "service_role";

grant references on table "public"."message_renders" to "service_role";

grant select on table "public"."message_renders" to "service_role";

grant trigger on table "public"."message_renders" to "service_role";

grant truncate on table "public"."message_renders" to "service_role";

grant update on table "public"."message_renders" to "service_role";

grant delete on table "public"."telegram_users" to "anon";

grant insert on table "public"."telegram_users" to "anon";

grant references on table "public"."telegram_users" to "anon";

grant select on table "public"."telegram_users" to "anon";

grant trigger on table "public"."telegram_users" to "anon";

grant truncate on table "public"."telegram_users" to "anon";

grant update on table "public"."telegram_users" to "anon";

grant delete on table "public"."telegram_users" to "authenticated";

grant insert on table "public"."telegram_users" to "authenticated";

grant references on table "public"."telegram_users" to "authenticated";

grant select on table "public"."telegram_users" to "authenticated";

grant trigger on table "public"."telegram_users" to "authenticated";

grant truncate on table "public"."telegram_users" to "authenticated";

grant update on table "public"."telegram_users" to "authenticated";

grant delete on table "public"."telegram_users" to "service_role";

grant insert on table "public"."telegram_users" to "service_role";

grant references on table "public"."telegram_users" to "service_role";

grant select on table "public"."telegram_users" to "service_role";

grant trigger on table "public"."telegram_users" to "service_role";

grant truncate on table "public"."telegram_users" to "service_role";

grant update on table "public"."telegram_users" to "service_role";

CREATE TRIGGER games_broadcast_change AFTER UPDATE ON public.games FOR EACH ROW WHEN ((new.version IS DISTINCT FROM old.version)) EXECUTE FUNCTION public.broadcast_game_change();


  create policy "game players receive game broadcasts"
  on "realtime"."messages"
  as permissive
  for select
  to authenticated
using (((extension = 'broadcast'::text) AND
CASE
    WHEN ((length(realtime.topic()) = 41) AND (realtime.topic() ~ '^game:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'::text) AND ((length((auth.jwt() ->> 'sub'::text)) >= 1) AND (length((auth.jwt() ->> 'sub'::text)) <= 18)) AND ((auth.jwt() ->> 'sub'::text) !~ '[^0-9]'::text)) THEN public.is_game_player((split_part(realtime.topic(), ':'::text, 2))::uuid, ((auth.jwt() ->> 'sub'::text))::bigint)
    ELSE false
END));



