# ADR 0004: Varios bots en un proceso

- Estado: aceptada (2026-11-14)

## Contexto

Xesmona tendrá varios bots (juegos, encuestas, comunidad…) con marca y configuración propias.

## Decisión

- Cada bot vive en `apps/bot-<id>` y exporta un `BotDefinition` (`@xesmona/contracts`).
- `apps/server` mantiene un registro estático de bots, crea una instancia de grammY por bot y
  expone `POST /webhook/<id>` (validando `X-Telegram-Bot-Api-Secret-Token`).
- Configuración por bot con prefijo de entorno `BOT_<ID>_` (`TOKEN`, `WEBHOOK_SECRET`,
  `MINIAPP_URL`). Un bot sin token se omite al arrancar.
- Los datos llevan `bot_id`. Una Mini App puede servir a varios bots: el backend valida el
  `initData` con el token del bot que la abrió.

## Consecuencias

- Añadir un bot = nueva app + una línea en el registro + variables de entorno.
- Un fallo grave en un bot afecta al proceso compartido; mitigación: `bot.catch` por bot y, si
  hace falta, separar el bot en otro servicio.
