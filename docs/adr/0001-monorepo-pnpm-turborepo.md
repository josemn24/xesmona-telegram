# ADR 0001: Monorepo con pnpm y Turborepo

- Estado: aceptada (2026-11-14)

## Contexto

Habrá varios bots y Mini Apps que comparten contratos, motores de juego y utilidades.

## Decisión

Un único repositorio con pnpm workspaces (`apps/*`, `packages/*`) y Turborepo para orquestar
`typecheck`, `test` y `build`. Versiones compartidas mediante el `catalog` de pnpm. Los paquetes
internos se consumen como fuente TypeScript (sin build propio); las apps los empaquetan.

## Consecuencias

- Un cambio en un contrato se valida en todos los consumidores en el mismo PR.
- El servidor debe empaquetar `@xesmona/*` (`noExternal` en tsup).
- Si un paquete se publica fuera del repo, necesitará su propio build.
