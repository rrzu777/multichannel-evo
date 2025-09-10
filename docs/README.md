# Phase 1 — Scaffolding & Stack Base

This repository provides a Docker-based setup for Evolution API, Chatwoot, Postgres, Redis, and Flowise.

Quickstart
- Copy env templates: `cp env/.chatwoot.env env/.chatwoot.env.local && cp env/.evolution.env env/.evolution.env.local && cp env/.flowise.env env/.flowise.env.local` (or edit the originals with secure values).
- Review `env/.chatwoot.env` and set strong secrets (`SECRET_KEY_BASE`, DB password).
- Bring up the stack: `docker compose up -d`
- Prepare Chatwoot DB: `docker compose exec chatwoot_rails bundle exec rails db:chatwoot_prepare`

Default Ports
- Chatwoot: http://localhost:3000 (changed from 3009)
- Evolution API: http://localhost:3001
- Flowise: http://localhost:3012 (changed from 3002)

Healthchecks
- Postgres: service health must be healthy (compose HC).
- Chatwoot: UI loads; `db:chatwoot_prepare` completes without errors.
- Evolution API: GET `/health` (if available) on port 3001.
- Flowise: UI loads and you can create a simple flow.

Notes
- Registries explicit: Compose pins Docker Hub via `docker.io/...` to avoid mirror/misrouting issues.
- Evolution API image: set `.env` `EVOLUTION_IMAGE` to choose source.
  - GHCR (auth): `EVOLUTION_IMAGE=ghcr.io/evolutionapi/evolution-api:latest` (or a valid tag).
  - Local build (no registry): use the `local-build` profile.
- Postgres image includes pgvector: using `docker.io/pgvector/pgvector:pg14` to satisfy Chatwoot's `CREATE EXTENSION vector`.
- For production, place services behind a proxy (Traefik/Nginx) with TLS and move storage to external services as needed.
