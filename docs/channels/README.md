# Channels (Phase 4)

This folder documents how to add Telegram, Instagram, and Facebook Messenger channels to Chatwoot and reuse the same Agent Bot that talks to Flowise.

Before you start
- Chatwoot is running and reachable (see Phase 1).
- Agent Bot is created and working for WhatsApp (see Phase 3). Note its Webhook URL and confirm it replies via Flowise.
- You have admin access to Chatwoot and to the social accounts you will connect.

Guides
- Telegram: see `telegram.md`.
- Instagram: see `instagram.md`.
- Facebook Messenger: see `facebook.md`.

Testing checklist (all channels)
- Send a DM to the channel → appears in the correct Chatwoot inbox.
- Bot replies within a couple of seconds.
- Handoff works using configured keywords (e.g., "humano", "agente").
- Media (images) can be sent and received.

Security tips
- Never commit tokens or app secrets. Store them in `.env` or a secret manager.
- Restrict Flowise UI, expose only the API needed by the bot-gateway.
- Rotate API tokens periodically and audit which inboxes have bots assigned.
