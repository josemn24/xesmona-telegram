# xesmona-telegram

Bots de Telegram y Mini Apps de Xesmona. Visión y arquitectura en
[docs/project-overview.md](docs/project-overview.md).

## Requisitos

- Node 24 LTS (`.nvmrc`) y corepack actualizado (`npm i -g corepack@latest` si falla la firma de pnpm).
- Docker (para Supabase local) y [Supabase CLI](https://supabase.com/docs/guides/cli).
- Un bot de **pruebas** creado con [@BotFather](https://t.me/BotFather) (no uses el de producción).

## Puesta en marcha

```bash
corepack enable
pnpm install
cp .env.example .env   # rellena BOT_GAMES_TOKEN
pnpm db:start          # opcional: Supabase local
pnpm dev
```

- Servidor: http://localhost:3000/health
- Mini App: http://localhost:5173/apps/games/ (fuera de Telegram se simula el entorno)
- Escribe `/ping` al bot en Telegram: responde `pong`.

## Probar la Mini App dentro de Telegram

Telegram exige HTTPS. Expón Vite con un túnel y registra la URL en BotFather:

```bash
cloudflared tunnel --url http://localhost:5173
```

1. En @BotFather: `/newapp`, elige el bot y usa `https://<túnel>/apps/games/` como URL.
2. Pon el direct link resultante (`https://t.me/<bot>/<app>`) en `BOT_GAMES_MINIAPP_URL`.
3. `/start` al bot y pulsa «Abrir juegos».

## Scripts

| Script                      | Qué hace                                      |
| --------------------------- | --------------------------------------------- |
| `pnpm dev`                  | Servidor + Mini App en modo desarrollo        |
| `pnpm check`                | Lint, typecheck, tests y build (igual que CI) |
| `pnpm format`               | Formatea con Prettier                         |
| `pnpm db:start` / `db:stop` | Arranca/para Supabase local                   |
| `pnpm db:reset`             | Recrea la BD aplicando migraciones y seed     |
| `pnpm db:types`             | Genera tipos TS del esquema                   |

## Despliegue (pendiente)

Railway: build `pnpm install --frozen-lockfile && pnpm build`, start
`pnpm --filter @xesmona/server start`, con `BOT_MODE=webhook`, `PUBLIC_URL` y
`BOT_<ID>_WEBHOOK_SECRET` definidos. Supabase Cloud en región UE.
