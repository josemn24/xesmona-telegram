alter table "public"."games" drop constraint "games_game_type_check";

alter table "public"."games" add constraint "games_game_type_check" CHECK ((game_type = ANY (ARRAY['tic-tac-toe'::text, 'four-in-a-row'::text]))) not valid;

alter table "public"."games" validate constraint "games_game_type_check";

set check_function_bodies = off;

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



