-- Hand-written: `supabase db diff` does not capture function privileges, table comments or
-- data, so what the schema files declare as revokes/grants/comments (and the bootstrap row
-- every environment needs) is applied here. Keep it in sync with supabase/schemas/.

-- Supabase grants EXECUTE on new functions to anon and authenticated by default; only the
-- server (service role) may change games, queue renders and expire games. (RLS without
-- policies already blocks those roles from the tables; this is defence in depth.)
revoke execute on function public.create_game from public, anon, authenticated;
revoke execute on function public.attach_message from public, anon, authenticated;
revoke execute on function public.join_game from public, anon, authenticated;
revoke execute on function public.start_vs_bot from public, anon, authenticated;
revoke execute on function public.save_game from public, anon, authenticated;
revoke execute on function public.enqueue_render from public, anon, authenticated;
revoke execute on function public.claim_renders from public, anon, authenticated;
revoke execute on function public.mark_rendered from public, anon, authenticated;
revoke execute on function public.expire_games from public, anon, authenticated;

-- The trigger function is only for the trigger.
revoke execute on function public.broadcast_game_change from public, anon, authenticated;
-- The `realtime.messages` policy runs as `authenticated`, so it needs `is_game_player`;
-- `anon` must not be able to probe who plays which game.
revoke execute on function public.is_game_player from public, anon;
grant execute on function public.is_game_player to authenticated;

-- Data every environment needs. `supabase db push` never runs seed.sql, so without this the
-- production database has no `games` bot and every game insert fails its `bots` foreign key.
-- seed.sql keeps the same row (idempotent) so local resets still work.
insert into public.bots (id, description)
values ('games', 'Xesmona multiplayer games')
on conflict (id) do nothing;

-- `db diff` dropped this comment from the baseline; it is declared in schemas/00_bots.sql.
comment on table public.bots is 'Xesmona Telegram bots registered on the platform';
