-- Hand-written: `supabase db diff` doesn't capture function privileges, so the revokes in
-- supabase/schemas/40_message_renders.sql are applied here. Only the server (service role)
-- queues and claims message renders.
revoke execute on function public.enqueue_render from public, anon, authenticated;
revoke execute on function public.claim_renders from public, anon, authenticated;
revoke execute on function public.mark_rendered from public, anon, authenticated;
