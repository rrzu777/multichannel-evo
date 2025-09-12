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

Flowise Troubleshooting
- Ensure env: `env/.flowise.env` exists and has `PORT=3000`.
- Start only Flowise: `docker compose up -d flowise`.
- Logs: `docker compose logs -f flowise` (look for port bind or DB path issues).
- Port clash: if `3012` busy, change host mapping in `docker-compose.yml`.
- Volume perms: the container writes to `/root/.flowise` (volume `flowise_data`). If it fails, prune/recreate the volume carefully.
- Auth: si `env/.flowise.env` define `FLOWISE_USERNAME/FLOWISE_PASSWORD`, las llamadas API deben incluir `Authorization`. Usa el script `scripts/flowise-create-chatflow.sh` con variables de entorno `FLOWISE_USERNAME` y `FLOWISE_PASSWORD` o `FLOWISE_API_KEY`.

Notes
- Registries explicit: Compose pins Docker Hub via `docker.io/...` to avoid mirror/misrouting issues.
- Evolution API image: set `.env` `EVOLUTION_IMAGE` to choose source.
  - GHCR (auth): `EVOLUTION_IMAGE=ghcr.io/evolutionapi/evolution-api:latest` (or a valid tag).
  - Local build (no registry): use the `local-build` profile.
- Postgres image includes pgvector: using `docker.io/pgvector/pgvector:pg14` to satisfy Chatwoot's `CREATE EXTENSION vector`.
- For production, place services behind a proxy (Traefik/Nginx) with TLS and move storage to external services as needed.

---

# Phase 3 — Flowise via Chatwoot Agent Bot

Goal
- Incoming messages in Chatwoot trigger the Agent Bot webhook; a small gateway calls Flowise and posts the reply back to the conversation. Optional human handoff on keywords.

What’s included
- `services/bot-gateway`: tiny Node service that receives Chatwoot webhook events, calls Flowise `/api/v1/prediction/{flowId}`, and posts replies to Chatwoot messages API.
- `docker-compose.yml`: service `bot-gateway` on port `3013`.
- `env/.botgateway.env`: template for Chatwoot and Flowise settings.

Setup
- Create a simple Flowise flow and note its Flow ID.
- Edit `env/.botgateway.env`:
  - `CHATWOOT_URL=http://chatwoot:3000` (internal) and set `CHATWOOT_ACCOUNT_ID`.
  - `CHATWOOT_API_TOKEN=<your Chatwoot API access token>` (Profile → Access Token).
  - `FLOWISE_URL=http://flowise:3000` and `FLOWISE_FLOW_ID=<your_flow_id>`.
- Bring up or restart the stack: `docker compose up -d --build bot-gateway`.

Configure Chatwoot Agent Bot
- In Chatwoot UI: Settings → Agent Bots → Add new → Webhook URL: `http://bot-gateway:3000/chatwoot/webhook` (internal) or `http://localhost:3013/chatwoot/webhook` (from host).
- Assign the bot to the WhatsApp inbox created by Evolution API.

Handoff
- The gateway opens the conversation when it detects any of: `humano, agente, asesor, operador` (configurable via `HANDOFF_KEYWORDS`). It also posts a short transfer message.

Healthchecks
- Bot gateway: `curl http://localhost:3013/health` → `{ ok: true }`.
- Flowise API: `curl -X POST http://localhost:3012/api/v1/prediction/<flowId> -H 'Content-Type: application/json' -d '{"question":"ping"}'`.

E2E Test (WhatsApp)
- Send a message to the WA number. Verify it appears in Chatwoot, bot replies, and handoff works on keyword.

RAG Flow
- Para un bot con RAG (usa tus documentos), sigue `docs/flowise/rag-support-bot.md`. Mantiene el contexto por conversación usando `sessionId`.

Importar Flujos (JSON)
- Ejemplos listos: `docs/flowise/exports/default-support-bot.flow.json` y `docs/flowise/exports/rag-support-bot.flow.json`.
- En Flowise UI: Chatflows → Import → selecciona el JSON.
- O vía API (ajusta según tu versión): ver `scripts/flowise-import.sh`.
