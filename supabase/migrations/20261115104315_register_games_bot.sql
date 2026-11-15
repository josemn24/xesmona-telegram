-- Hand-written: data every environment needs, which `db diff` doesn't produce.
-- `supabase db push` never runs seed.sql, so without this the production database has no
-- `games` bot and every game insert fails its `bots` foreign key. seed.sql keeps the same row
-- (idempotent) so local resets still work if this migration changes.
insert into public.bots (id, description)
values ('games', 'Xesmona multiplayer games')
on conflict (id) do nothing;
