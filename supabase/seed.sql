insert into public.bots (id, description)
values ('games', 'Xesmona multiplayer games')
on conflict (id) do nothing;
