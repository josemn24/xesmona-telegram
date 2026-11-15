-- Hand-written: `supabase db diff` doesn't capture function privileges, so the revokes and
-- grant in supabase/schemas/30_realtime.sql are applied here. Supabase grants EXECUTE on new
-- functions to anon and authenticated by default.
-- The trigger function is only for the trigger.
revoke execute on function public.broadcast_game_change from public, anon, authenticated;
-- The `realtime.messages` policy runs as `authenticated`, so it needs `is_game_player`;
-- `anon` must not be able to probe who plays which game.
revoke execute on function public.is_game_player from public, anon;
grant execute on function public.is_game_player to authenticated;
