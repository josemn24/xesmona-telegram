# ADR 0001: Monorepo with pnpm and Turborepo

- Status: accepted (2026-11-14)

## Context

There will be several bots and Mini Apps sharing contracts, game engines and utilities.

## Decision

A single repository with pnpm workspaces (`apps/*`, `packages/*`) and Turborepo to orchestrate
`typecheck`, `test` and `build`. Shared versions through the pnpm `catalog`. Internal packages
are consumed as TypeScript source (no build of their own); the apps bundle them.

## Consequences

- A change to a contract is validated against every consumer in the same PR.
- The server must bundle `@xesmona/*` (`noExternal` in tsup).
- If a package is ever published outside the repo, it will need its own build.
