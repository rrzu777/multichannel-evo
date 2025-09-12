# Flowise — Default Support Bot (Guía de creación)

Objetivo
- Crear un flujo simple que responda preguntas generales y mantenga contexto por conversación usando `sessionId` (mapeado desde `conversation_id` de Chatwoot).

Resumen del flujo
- Nodos: System Prompt → LLM (ej. OpenAI/Anthropic/Local) → Salida.
- Memoria: usar `sessionId` recibido en `overrideConfig.sessionId` desde el Bot Gateway.
- Endpoint: `POST /api/v1/prediction/{flowId}` con body `{ "question": "...", "overrideConfig": { "sessionId": "..." } }`.

Pasos en Flowise UI
- Accede a Flowise: `http://localhost:3012` (por defecto).
- Crea nuevo Chatflow y añade:
  - Prompt Template (System): pega el siguiente prompt de sistema.
  - LLM: elige tu proveedor (configura credenciales en Settings/Variables o en el nodo).
  - Conecta Prompt → LLM → Output (Default Response).
- Publica el flujo y copia el `Flow ID`.

Prompt de sistema (pégalo en el nodo Prompt/System)
```
Eres un asistente de soporte amigable y útil para una empresa.
- Responde en español de forma breve y clara.
- Si no sabes la respuesta, dilo y sugiere escalar con un humano.
- Si el usuario pide “humano” (o sinónimos), no respondas contenido nuevo.
```

Configuración del LLM
- Modelo: el de tu preferencia (OpenAI/Anthropic/Local LLM vía Ollama, etc.).
- Temperatura: 0.2–0.5 (sugerido 0.3).
- Credenciales: configúralas en Flowise UI (nunca en el repo).

Memoria por conversación
- No necesitas un nodo extra si tu chatflow soporta `overrideConfig.sessionId`.
- Desde el Bot Gateway enviamos `sessionId = conversation_id` para mantener el contexto.

Prueba rápida
- `curl -X POST http://localhost:3012/api/v1/prediction/<flowId> -H 'Content-Type: application/json' -d '{"question":"hola"}'`
- Deberías recibir un JSON con `text` (la respuesta).

Conexión con Chatwoot (vía Bot Gateway)
- El Bot Gateway invoca este flujo con `{ question, overrideConfig: { sessionId } }`.
- La respuesta `text` se publica en Chatwoot automáticamente.

Notas
- Puedes añadir retrieval (documentos) usando nodos de embeddings + vector store.
- Añade filtros/moderación según tu dominio (palabras prohibidas, límites de longitud).

