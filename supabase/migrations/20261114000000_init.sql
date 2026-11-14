-- Migración inicial (prueba de humo del set up).
-- Registro de bots conocidos; el resto del modelo de datos llega en la Fase 1.
create table public.bots (
  id text primary key check (id ~ '^[a-z][a-z0-9-]*$'),
  description text,
  created_at timestamptz not null default now()
);

alter table public.bots enable row level security;
-- Sin políticas: solo el service role (servidor) accede a esta tabla.

comment on table public.bots is 'Bots de Telegram de Xesmona registrados en la plataforma';
