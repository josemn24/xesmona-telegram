alter table "public"."games" drop constraint "games_mode_once_started";

alter table "public"."games" drop constraint "games_status_check";

alter table "public"."games" add constraint "games_mode_once_started" CHECK (((status = ANY (ARRAY['waiting'::text, 'expired'::text])) OR (mode IS NOT NULL))) not valid;

alter table "public"."games" validate constraint "games_mode_once_started";

alter table "public"."games" add constraint "games_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'playing'::text, 'finished'::text, 'expired'::text]))) not valid;

alter table "public"."games" validate constraint "games_status_check";

set check_function_bodies = off;

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


