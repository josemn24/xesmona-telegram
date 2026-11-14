# ADR 0002: Railway + Supabase como hosting inicial

- Estado: aceptada (2026-11-14)

## Contexto

La propuesta inicial usaba Vercel + Railway + Supabase: tres proveedores, tres entornos y nueve
combinaciones de secretos y despliegues antes de tener usuarios.

## Decisión

- **Railway:** un único servicio Node (`apps/server`) con la API Hono, los webhooks de todos los
  bots, los workers y los estáticos de las Mini Apps (`/apps/<nombre>/`).
- **Supabase Cloud (UE):** Postgres, Realtime, Storage y Queues.

## Consecuencias

- Un proceso persistente: sin límites de duración de funciones serverless para colas y reintentos.
- Un bot o worker con mucha carga puede separarse en otro servicio de Railway sin cambiar código.
- Las Mini Apps podrían moverse a un CDN si el tráfico lo justifica.
