# ADR 0003: Vite + React for the Mini Apps (not Next.js)

- Status: accepted (2026-11-14)

## Context

Mini Apps run inside Telegram's WebView, render on the client and don't need SEO. Startup
performance on modest phones is critical.

## Decision

Each Mini App is a Vite + React + Tailwind SPA, served as static files by `apps/server`.
Animations with Motion and boards in SVG; Phaser or PixiJS only if a game requires it.

## Consequences

- Less JS at startup and no server/client boundary to manage.
- If a public site or SSR dashboard is needed in the future, it will be a separate app (e.g.
  Next.js).
