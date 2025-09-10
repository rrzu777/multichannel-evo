#!/usr/bin/env bash
set -euo pipefail

echo "=== Multichannel EVO • Phase 1 bootstrap ==="

# Helper to ensure docker compose is available
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required (docker compose)." >&2
  exit 1
fi

PROJECT_NAME="multichannel-evo"

echo "1) Stopping stack and cleaning local volumes (project-scoped)"
docker compose down -v || true

# Clean known volumes for a fresh start (ignore errors if missing)
for v in ${PROJECT_NAME}_pgdata ${PROJECT_NAME}_redisdata ${PROJECT_NAME}_chatwoot_storage ${PROJECT_NAME}_evolution_data ${PROJECT_NAME}_flowise_data; do
  docker volume rm "$v" >/dev/null 2>&1 || true
done

echo "2) Pre-pulling base images (Docker Hub explicit)"
docker pull docker.io/pgvector/pgvector:pg14
docker pull docker.io/library/redis:7-alpine
docker pull docker.io/chatwoot/chatwoot:latest
docker pull docker.io/flowiseai/flowise:latest

echo "3) Starting Postgres and Redis"
docker compose up -d postgres redis

echo "4) Waiting for Postgres to be healthy"
attempts=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' mc_postgres 2>/dev/null || echo starting)" = "healthy" ]; do
  attempts=$((attempts+1))
  if [ $attempts -gt 60 ]; then
    echo "Postgres did not become healthy in time. Logs:" >&2
    docker compose logs --tail=200 postgres >&2 || true
    exit 1
  fi
  sleep 2
done

echo "5) Preparing Chatwoot database"
# One-off run ensures DB is prepared even if app container is restarting
docker compose run --rm chatwoot_rails sh -lc "bundle exec rails db:chatwoot_prepare"

echo "6) Starting Chatwoot (Rails + Worker)"
docker compose up -d chatwoot_rails chatwoot_worker

echo "7) Building and starting Evolution API (local build)"
if [ ! -f services/evolution-api/package.json ]; then
  echo "Evolution API source not found in services/evolution-api. Cloning upstream…"
  git clone https://github.com/EvolutionAPI/evolution-api.git services/evolution-api
fi
docker compose build evolution-api-local
docker compose up -d evolution-api-local

echo "8) Starting Flowise"
docker compose up -d flowise

echo "=== Ready ==="
echo "Chatwoot:     http://localhost:3009"
echo "EvolutionAPI: http://localhost:3001"
echo "Flowise:      http://localhost:3012"
