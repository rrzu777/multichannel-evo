#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   CHATWOOT_TOKEN=your_token CHATWOOT_ACCOUNT_ID=1 INSTANCE=wa1 ./scripts/evo_create_instance.sh
# Optional:
#   CHATWOOT_URL (default: http://chatwoot_rails:3000)
#   INTEGRATION (default: WHATSAPP-BAILEYS)

INSTANCE=${INSTANCE:-wa1}
CHATWOOT_URL=${CHATWOOT_URL:-http://chatwoot_rails:3000}
INTEGRATION=${INTEGRATION:-WHATSAPP-BAILEYS}

if [ -z "${CHATWOOT_TOKEN:-}" ] || [ -z "${CHATWOOT_ACCOUNT_ID:-}" ]; then
  echo "Set CHATWOOT_TOKEN and CHATWOOT_ACCOUNT_ID env vars." >&2
  exit 1
fi

if [[ "$INSTANCE" == http* || "$INSTANCE" == */* ]]; then
  echo "INSTANCE must be a short name (e.g., wa1), not a URL." >&2
  exit 1
fi

APIKEY=$(grep '^AUTHENTICATION_API_KEY=' env/.evolution.env | cut -d= -f2-)
if [ -z "$APIKEY" ]; then
  echo "AUTHENTICATION_API_KEY not found in env/.evolution.env" >&2
  exit 1
fi

# Basic reachability check
if ! curl -fsS http://localhost:3001/ >/dev/null 2>&1; then
  echo "Evolution API not reachable at http://localhost:3001. Start it first: docker compose up -d evolution-api-local" >&2
  exit 1
fi

echo "Creating Evolution API instance '$INSTANCE'…"
RESP=$(curl -fsS -X POST http://localhost:3001/instance/create \
  -H "apikey: $APIKEY" \
  -H "Content-Type: application/json" \
  -d "{\
    \"instanceName\":\"$INSTANCE\",\
    \"integration\":\"$INTEGRATION\",\
    \"chatwootUrl\":\"$CHATWOOT_URL\",\
    \"chatwootToken\":\"$CHATWOOT_TOKEN\",\
    \"chatwootAccountId\":\"$CHATWOOT_ACCOUNT_ID\",\
    \"chatwootSignMsg\":false,\
    \"chatwootReopenConversation\":true,\
    \"chatwootConversationPending\":true,\
    \"chatwootImportContacts\":true,\
    \"chatwootImportMessages\":true,\
    \"chatwootNameInbox\":\"WhatsApp $INSTANCE\"\
  }")

if command -v jq >/dev/null 2>&1; then
  echo "$RESP" | jq .
else
  echo "$RESP"
fi

echo "Done. Check Evolution API logs for QR and status:"
echo "  docker compose logs -f evolution-api-local"
