# ADR 0003: Vite + React para las Mini Apps (no Next.js)

- Estado: aceptada (2026-11-14)

## Contexto

Las Mini Apps se ejecutan dentro del WebView de Telegram, se renderizan en el cliente y no
necesitan SEO. El rendimiento de arranque en móviles modestos es crítico.

## Decisión

Cada Mini App es una SPA de Vite + React + Tailwind, servida como estáticos por `apps/server`.
Animaciones con Motion y tableros en SVG; Phaser o PixiJS solo si un juego lo exige.

## Consecuencias

- Menos JS en el arranque y sin frontera servidor/cliente que gestionar.
- Si en el futuro hace falta un sitio público o dashboard con SSR, será otra app (p. ej. Next.js).
