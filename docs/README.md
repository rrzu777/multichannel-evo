# Phase 1 — Scaffolding & Stack Base

This repository provides a Docker-based setup for Evolution API, Chatwoot, Postgres, Redis, and Flowise.

Quickstart
- Copy env templates: `cp env/.chatwoot.env env/.chatwoot.env.local && cp env/.evolution.env env/.evolution.env.local && cp env/.flowise.env env/.flowise.env.local` (or edit the originals with secure values).
- Review `env/.chatwoot.env` and set strong secrets (`SECRET_KEY_BASE`, DB password).
- Bring up the stack: `docker compose up -d`
- Prepare Chatwoot DB: `docker compose exec chatwoot_rails bundle exec rails db:chatwoot_prepare`

Default Ports
- Chatwoot: http://localhost:3009
- Evolution API: http://localhost:3001
- Flowise: http://localhost:3002

Healthchecks
- Postgres: service health must be healthy (compose HC).
- Chatwoot: UI loads; `db:chatwoot_prepare` completes without errors.
- Evolution API: GET `/health` (if available) on port 3001.
- Flowise: UI loads and you can create a simple flow.

Notes
- Evolution API image: set a `.env` (compose) variable `EVOLUTION_IMAGE` to pick a registry. Examples:
  - Docker Hub (default): `EVOLUTION_IMAGE=evolutionapi/evolution-api:latest`
  - GHCR (requires public visibility or auth): `EVOLUTION_IMAGE=ghcr.io/evolution-api/evolution-api:latest`
  - If GHCR denies access, run `docker login ghcr.io` with a PAT that has `read:packages` or switch to Docker Hub.
- For production, place services behind a proxy (Traefik/Nginx) with TLS and move storage to external services as needed.
