-- Hand-written: `supabase db diff` doesn't capture function privileges, so the revokes in
-- supabase/schemas/20_functions.sql are applied here. Supabase grants EXECUTE on new
-- functions to anon and authenticated by default; only the server (service role) may change
-- games. (RLS without policies already blocks those roles from the tables; this is defence
-- in depth.)
revoke execute on function public.create_game from public, anon, authenticated;
revoke execute on function public.attach_message from public, anon, authenticated;
revoke execute on function public.join_game from public, anon, authenticated;
revoke execute on function public.start_vs_bot from public, anon, authenticated;
revoke execute on function public.save_game from public, anon, authenticated;
