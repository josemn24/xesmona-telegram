-- Games played through the bots (Phase 1: Tic-tac-toe in the chat).
-- Decisions: docs/adr/0005-play-vs-bot.md, docs/adr/0006-in-chat-games-inline-keyboards.md.

-- Telegram users seen by the bots. Inline callbacks only carry the user who taps, so other
-- players' names are looked up here.
create table public.telegram_users (
  id bigint primary key,
  first_name text not null,
  username text,
  language_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_users enable row level security;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null references public.bots (id),
  game_type text not null check (game_type in ('tic-tac-toe', 'four-in-a-row')),
  -- Null while the invitation is waiting for a second player or the vs-bot choice.
  mode text check (mode in ('pvp', 'vs_bot')),
  bot_level text check (bot_level in ('easy', 'normal', 'hard')),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- Engine state (pure JSON, owned by the game's engine).
  state jsonb not null,
  -- Incremented on every accepted change; travels in callback_data (optimistic concurrency).
  version integer not null default 0 check (version >= 0),
  result text check (result in ('win', 'draw')),
  winner_seat smallint check (winner_seat in (0, 1)),
  round integer not null default 0 check (round >= 0),
  created_by bigint not null references public.telegram_users (id),
  -- Message that shows the game: a chat message or an inline message, never both.
  chat_id bigint,
  message_id integer,
  message_thread_id integer,
  inline_message_id text,
  -- Stable per chat, also present on inline callbacks (ADR 0006).
  chat_instance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_level_only_vs_bot check (
    (mode is not distinct from 'vs_bot') = (bot_level is not null)
  ),
  constraint games_mode_once_started check (status = 'waiting' or mode is not null),
  constraint games_winner_only_on_win check ((result = 'win') = (winner_seat is not null)),
  constraint games_chat_message_pair check ((chat_id is null) = (message_id is null)),
  constraint games_single_message_ref check (
    not (message_id is not null and inline_message_id is not null)
  )
);

create unique index games_inline_message_idx
  on public.games (bot_id, inline_message_id)
  where inline_message_id is not null;

create unique index games_chat_message_idx
  on public.games (bot_id, chat_id, message_id)
  where message_id is not null;

create index games_created_by_idx on public.games (created_by);

alter table public.games enable row level security;

create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  seat smallint not null check (seat in (0, 1)),
  kind text not null check (kind in ('human', 'bot')),
  telegram_user_id bigint references public.telegram_users (id),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (game_id, seat),
  unique (game_id, telegram_user_id),
  constraint game_players_human_has_user check (
    (kind = 'human') = (telegram_user_id is not null)
  )
);

create index game_players_telegram_user_idx on public.game_players (telegram_user_id);

alter table public.game_players enable row level security;

-- Move history: one row per accepted move, keyed by the version it produced.
create table public.game_moves (
  game_id uuid not null references public.games (id) on delete cascade,
  version integer not null,
  round integer not null,
  seat smallint not null check (seat in (0, 1)),
  move jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, version)
);

alter table public.game_moves enable row level security;

-- No policies on any table: only the service role (server) can access them.
