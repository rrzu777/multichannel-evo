const express = require('express');

// Env config
const PORT = process.env.PORT || 3000;
const CHATWOOT_URL = process.env.CHATWOOT_URL || 'http://chatwoot:3000';
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN;

const FLOWISE_URL = process.env.FLOWISE_URL || 'http://flowise:3000';
const FLOWISE_FLOW_ID = process.env.FLOWISE_FLOW_ID;
const FLOWISE_PREDICTION_BASE = process.env.FLOWISE_PREDICTION_BASE || '/api/v1/prediction';
const FLOWISE_API_KEY = process.env.FLOWISE_API_KEY || '';

const HANDOFF_KEYWORDS = (process.env.HANDOFF_KEYWORDS || 'humano,agente,asesor,operador').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

if (!CHATWOOT_ACCOUNT_ID || !CHATWOOT_API_TOKEN) {
  console.warn('[WARN] CHATWOOT_ACCOUNT_ID and/or CHATWOOT_API_TOKEN not set. Replies will fail.');
}
if (!FLOWISE_FLOW_ID) {
  console.warn('[WARN] FLOWISE_FLOW_ID not set. Prediction calls will fail.');
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Utility: safe getters for diverse Chatwoot webhook shapes
function extractPayload(body) {
  // Normalize Chatwoot Agent Bot / Webhook shapes
  // Try several common paths without throwing
  const candidates = [];
  const push = (obj) => obj && candidates.push(obj);

  // Typical agent bot payload
  push(body);
  push(body?.data);
  push(body?.payload);

  // Sometimes message comes in arrays
  if (Array.isArray(body?.messages) && body?.messages.length) push({ message: body.messages[0], conversation: body.conversation });
  if (Array.isArray(body?.data?.messages) && body?.data?.messages.length) push({ message: body.data.messages[0], conversation: body.data.conversation });

  for (const data of candidates) {
    const msg = data?.message || data;
    const content = msg?.content || data?.content;
    const messageType = msg?.message_type || data?.message_type;
    const senderType = msg?.sender_type || data?.sender_type;
    const conversationId = data?.conversation?.id || data?.conversation_id || msg?.conversation_id || data?.id;

    if (content && (conversationId || messageType || senderType)) {
      return { content, messageType, senderType, conversationId };
    }
  }

  return { content: undefined, messageType: undefined, senderType: undefined, conversationId: undefined };
}

function isIncoming({ messageType, senderType }) {
  // Prefer message_type === 'incoming'; fallback: sender_type === 'Contact'
  if (messageType) return String(messageType).toLowerCase() === 'incoming';
  if (senderType) return String(senderType).toLowerCase() === 'contact';
  return true; // default to true if unclear, but we also guard against empty content
}

function shouldHandoff(text) {
  const t = (text || '').toLowerCase();
  return HANDOFF_KEYWORDS.some(k => t.includes(k));
}

async function callFlowise(question, sessionId) {
  const url = `${FLOWISE_URL.replace(/\/$/, '')}${FLOWISE_PREDICTION_BASE}/${encodeURIComponent(FLOWISE_FLOW_ID)}`;
  const body = { question, overrideConfig: { sessionId } };
  const headers = { 'Content-Type': 'application/json' };
  if (FLOWISE_API_KEY) {
    headers['X-API-Key'] = FLOWISE_API_KEY; // common header in Flowise
    headers['apikey'] = FLOWISE_API_KEY; // some builds expect lowercase 'apikey'
    headers['Authorization'] = `Bearer ${FLOWISE_API_KEY}`; // some builds accept Bearer
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Flowise error ${res.status}: ${text}`);
  }
  // Flowise returns { text: string, ... }
  const json = await res.json();
  return json?.text || json?.answer || JSON.stringify(json);
}

async function postChatwootMessage(conversationId, content) {
  const url = `${CHATWOOT_URL.replace(/\/$/, '')}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_access_token': CHATWOOT_API_TOKEN
    },
    body: JSON.stringify({ content, message_type: 'outgoing', private: false })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Chatwoot post message error ${res.status}: ${text}`);
  }
}

async function openChatwootConversation(conversationId) {
  const url = `${CHATWOOT_URL.replace(/\/$/, '')}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'api_access_token': CHATWOOT_API_TOKEN
    },
    body: JSON.stringify({ status: 'open' })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Chatwoot open conversation error ${res.status}: ${text}`);
  }
}

app.post('/chatwoot/webhook', async (req, res) => {
  try {
    const { content, messageType, senderType, conversationId } = extractPayload(req.body || {});
    console.log('[bot-gateway] webhook event', {
      hasBody: !!req.body,
      conversationId,
      messageType,
      senderType,
      contentPreview: (content || '').slice(0, 80)
    });

    if (!conversationId) {
      console.warn('[WARN] Missing conversationId in payload');
      try {
        console.log('[bot-gateway] raw body snippet', JSON.stringify(req.body).slice(0, 2000));
      } catch (_) {}
      return res.status(200).json({ skipped: true, reason: 'missing_conversation_id' });
    }

    if (!content || !isIncoming({ messageType, senderType })) {
      return res.status(200).json({ skipped: true });
    }

    // Handoff keyword detection from user side
    if (shouldHandoff(content)) {
      await openChatwootConversation(conversationId).catch(err => {
        console.error('[ERROR] open conversation failed:', err.message);
      });
      // Optional acknowledgement to user
      await postChatwootMessage(conversationId, 'Te conecto con un agente humano.').catch(() => {});
      return res.json({ ok: true, handoff: true });
    }

    // Query Flowise
    const answer = await callFlowise(content, String(conversationId));

    // Post back to Chatwoot
    await postChatwootMessage(conversationId, answer);

    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR] webhook handling failed:', err);
    res.status(200).json({ ok: false, error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`[bot-gateway] listening on :${PORT}`);
});
