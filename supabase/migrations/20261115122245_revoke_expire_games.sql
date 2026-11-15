-- Hand-written: `supabase db diff` doesn't capture function privileges, so the revoke in
-- supabase/schemas/50_expire_games.sql is applied here. Only the server expires games.
revoke execute on function public.expire_games from public, anon, authenticated;
