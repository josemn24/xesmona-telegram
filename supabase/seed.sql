insert into public.bots (id, description)
values ('games', 'Juegos multijugador de Xesmona')
on conflict (id) do nothing;
