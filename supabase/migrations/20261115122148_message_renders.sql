
  create table "public"."message_renders" (
    "game_id" uuid not null,
    "not_before" timestamp with time zone not null default now(),
    "attempts" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."message_renders" enable row level security;

alter table "public"."games" add column "rendered_version" integer;

CREATE INDEX message_renders_not_before_idx ON public.message_renders USING btree (not_before);

CREATE UNIQUE INDEX message_renders_pkey ON public.message_renders USING btree (game_id);

alter table "public"."message_renders" add constraint "message_renders_pkey" PRIMARY KEY using index "message_renders_pkey";

alter table "public"."message_renders" add constraint "message_renders_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE not valid;

alter table "public"."message_renders" validate constraint "message_renders_game_id_fkey";

set check_function_bodies = off;

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


