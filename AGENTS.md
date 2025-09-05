# Repository Guidelines

## Project Structure & Module Organization

- Root: `docker-compose.yml` (Evolution API, Chatwoot, Postgres, Redis, Flowise).
- `env/`: environment templates (`.evolution.env`, `.chatwoot.env`, `.flowise.env`).
- `docs/`: architecture notes, diagrams, and operational runbooks.
- Optional: `scripts/` for one-off admin tasks (backup, healthchecks).

## Build, Test, and Development Commands

- Bootstrap env files: copy templates in `env/` and adjust secrets.
- Start stack: `docker compose up -d`
- Prepare Chatwoot DB: `docker compose exec chatwoot_rails bundle exec rails db:chatwoot_prepare`
- Follow logs: `docker compose logs -f chatwoot_rails` (or `evolution-api`, `flowise`)
- Tear down: `docker compose down -v` (removes volumes — destructive)

## Coding Style & Naming Conventions

- YAML/Compose: 2-space indentation; lowercase service names (`chatwoot_rails`).
- Env vars: upper snake case (`JWT_SECRET`), values quoted only when needed.
- Filenames: kebab-case for scripts, lowercase for directories.
- Shell scripts: `bash -euo pipefail`; keep idempotent and parameterized.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`…).

## Testing Guidelines

- Healthchecks (examples):
  - Evolution API: `curl http://localhost:<evo_port>/health`
  - Flowise: `curl -X POST http://localhost:<flowise_port>/prediction/<flowId> -H 'Content-Type: application/json' -d '{"question":"ping"}'`
  - Chatwoot readiness: app reachable; DB prepared without errors.
- WhatsApp E2E: create WA instance via Evolution API, scan QR, send a message → verify it appears in Chatwoot and replies are delivered.
- Record results in `docs/testing-notes.md` when adding features.

## Commit & Pull Request Guidelines

- Scope small; one logical change per PR.
- PR description: purpose, config changes, screenshots (Chatwoot inbox/bot settings), and redacted `.env` diffs.
- Link issues; note deployment/rollback steps.
- Check locally: compose up, DB prepared, basic healthchecks pass.

## Security & Configuration Tips

- Never commit secrets; store only in `env/` templates with placeholders.
- Restrict Flowise UI; expose only required API, ideally on internal network.
- Use TLS via Nginx/Traefik; set HSTS and secure headers at the proxy.
- Rotate tokens (`APIKEY`, `JWT_SECRET`) and back up Postgres volumes regularly.
