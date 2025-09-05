# PRD Técnico – Plataforma Multicanal con Evolution API, Flowise y Chatwoot (sin Node-RED)

## Objetivo del Proyecto

Construir desde cero una plataforma multicanal **auto-hospedada** que centralice conversaciones de clientes (prioridad: **WhatsApp**; luego **Telegram**, **Instagram** y **Facebook Messenger**) en **Chatwoot** como inbox omnicanal. La automatización por IA se hará con **Flowise**; la orquestación **WhatsApp↔Chatwoot** la realiza **Evolution API** con su integración nativa (**sin Node-RED**). Se busca un **MVP productivo en VPS** con buenas prácticas de seguridad, monitoreo y backups.

- **WhatsApp**: vía **Evolution API** (motor WhatsApp Web con **Baileys** o **Whatsmeow**) + **integración nativa con Chatwoot** (creación de inbox, importación de contactos/mensajes, re-apertura de conversaciones, etc.).  
  doc.evolution-api.com  
  +2  
  doc.evolution-api.com  
  +2

- **IA**: **Flowise** expuesto por API **/prediction/{id}** para responder mensajes (usaremos **Chatwoot Agent Bot/webhooks** para “invocar” el bot).  
  docs.flowiseai.com  
  +1

- **Chatwoot**: inbox unificado, **Agent Bots** por webhook, **canales nativos (Telegram/IG/FB)**, APIs y guías de despliegue Docker.  
  Chatwoot  
  +1  
  Chatwoot Developers

---

## Arquitectura (visión general)

Contenedores Docker en una red interna:

- **evolution-api**: servicio HTTP con endpoints para **crear instancias** (sesiones WA), **enviar/recibir mensajes** y **configurar Chatwoot** directamente (parámetros `chatwootAccountId`, `chatwootToken`, `chatwootUrl`, etc.).  
  doc.evolution-api.com

- **chatwoot_rails + chatwoot_worker + postgres + redis**: Chatwoot auto-hospedado. Los canales **Telegram/IG/FB** se conectan con **inboxes nativos** de Chatwoot; **WhatsApp** entra por **Evolution API**.  
  Chatwoot Developers  
  Chatwoot

- **flowise**: diseñas flujos de IA; expone **API de predicción** para recibir un prompt y retornar la respuesta.  
  docs.flowiseai.com

- **proxy (Nginx/Traefik)**: TLS, enrutamiento por subdominios.

**Flujo lógico principal (WhatsApp):**  
Usuario ↔ WhatsApp ↔ **Evolution API** ↔ **Chatwoot** (conversación) ↔ (Webhook AgentBot) ↔ **Flowise** → respuesta ↔ **Chatwoot** ↔ **Evolution API** ↔ Usuario.  
**No hay Node-RED**: Evolution API “habla” con Chatwoot y Chatwoot “habla” con Flowise mediante webhook del bot.  
doc.evolution-api.com  
Chatwoot  
docs.flowiseai.com

---

## Fases de Desarrollo (desde repo vacío)

### Fase 1 — Scaffolding y stack base

**Objetivo:** dejar corriendo Evolution API, Chatwoot, Postgres, Redis y Flowise con Docker Compose.

**Tareas:**

**Repo `multichannel-evolution/` con:**
- `docker-compose.yml`
- `env/` con plantillas `.evolution.env`, `.chatwoot.env`, `.flowise.env`
- `docs/` (diagramas/README)

**Compose (servicios mínimos):**
- `postgres:14-alpine` (volumen persistente)
- `redis:7-alpine`
- `chatwoot_rails` + `chatwoot_worker` (imagen oficial, guías docker)  
  Chatwoot Developers
- `evolution-api` (imagen oficial o build del repo)  
  GitHub
- `flowiseai/flowise` (UI + API)  
  docs.flowiseai.com

**Variables clave:**
- **Chatwoot**: `SECRET_KEY_BASE`, `FRONTEND_URL`, `BACKEND_URL`, `POSTGRES_*`, `REDIS_URL`, `RAILS_ENV=production`.  
  Chatwoot Developers
- **Evolution API**: `APIKEY`, `JWT_SECRET`, storage, etc. (según README/doc)  
  doc.evolution-api.com
- **Flowise**: `FLOWISE_USERNAME/PASSWORD` (acceso admin), `PORT`.

**Preparar Chatwoot DB:** `rails db:chatwoot_prepare` (según guía).  
Chatwoot Developers

**Validación:**
- Chatwoot accesible (p. ej. `http://localhost:3009`) y login admin OK.  
  Chatwoot Developers
- Evolution API responde en su puerto (Swagger/health).
- Flowise UI carga y puedes crear un flujo simple.  
  docs.flowiseai.com

---

### Fase 2 — WhatsApp con Evolution API + Chatwoot (básico, sin IA)

**Objetivo:** recibir y enviar mensajes de WhatsApp desde **Chatwoot** vía **Evolution API**.

**Tareas:**
- **Crear Inbox API en Chatwoot** (si deseas manejar WA como “canal API”) **o** usar la **integración nativa de Evolution con Chatwoot (recomendado)**.
  - **Opción recomendada**: **crear la instancia de WA directamente desde Evolution API** con los parámetros de Chatwoot para que **cree/configure el inbox automáticamente** (`/instance/create` con `chatwootAccountId`, `chatwootToken`, `chatwootUrl`, etc.).  
    doc.evolution-api.com
  - **Opción “manual”**: crear **API channel inbox** en Chatwoot y configurar webhooks; funciona pero no aprovecha el pegamento nativo.  
    Chatwoot

- **Levantar instancia WA en Evolution API:**
  - `POST /instance/create` con `integration: "WHATSAPP-BAILEYS"` (o **Whatsmeow**, si corresponde) y los campos de Chatwoot indicados arriba. Escanea el **QR** y espera estado “working”.  
    doc.evolution-api.com

**Probar:**
- Envía un WhatsApp al número vinculado → debe **aparecer directamente en Chatwoot** en el inbox creado por Evolution.
- Responde desde Chatwoot → **se envía por WA** vía Evolution API.

**Validación:** conversación entra/sale correctamente, sin IA aún.  
**Notas:** Evolution API documenta además un endpoint para **setear/ajustar** la integración con Chatwoot por instancia (`POST /chatwoot/set/{instance}`) con banderas útiles (`reopenConversation`, `conversationPending`, `importContacts`, `importMessages`, `signMsg`, `nameInbox`, etc.).  
doc.evolution-api.com

---

### Fase 3 — IA con Flowise vía Chatwoot Agent Bot (sin Node-RED)

**Objetivo:** que los mensajes entrantes en Chatwoot disparen un webhook a tu bot, y el bot (tu gateway a Flowise) responda y lo publique de vuelta en la conversación.

**Tareas:**
- **Diseñar un flujo** en **Flowise** (p. ej. “Default Support Bot”) y **publicarlo**. Apunta su endpoint `POST /prediction/{flowId}`.  
  docs.flowiseai.com
- **Crear un Agent Bot en Chatwoot** (Settings → Bots) y **configurar el Webhook URL** (tu gateway — **pequeño microservicio** muy simple en Node/Go o un serverless que haga: **recibir evento → llamar a Flowise → devolver payload a Chatwoot**).  
  Chatwoot  
  *(Alternativa sin microservicio: si tu Flowise está abierto y quieres prototipar, puedes apuntar el webhook a un tiny handler que solo “adapte” el JSON al `POST /prediction/{id}` y postee la respuesta a Chatwoot — 2 funciones).*
- **Asignar el bot** al inbox de WhatsApp que creó Evolution API (**conversaciones nuevas** quedarán **pending** con bot activo; Chatwoot enviará **eventos** al webhook).  
  Chatwoot

**Lógica del bot (gateway):**
- Recibe evento **`message_created`** (entrante).
- Llama **`POST /prediction/{flowId}`** con `{ text, sessionId=conversation_id }`.  
  docs.flowiseai.com
- Publica la **respuesta** en Chatwoot: **`POST /api/v1/accounts/{id}/conversations/{conversation_id}/messages`** (outgoing).  
  Chatwoot Developers
- **Handoff**: si la IA detecta intención/keyword (p. ej. “humano”), cambia estado a **open** vía **`PATCH /conversations/{id}`** y deja de responder.  
  Chatwoot Developers

**Validación:** conversación nueva en WA → Chatwoot → webhook → Flowise → respuesta del bot publicada y entregada al usuario. **Handoff funcional**.

---

### Fase 4 — Canales Telegram / Instagram / Facebook Messenger

**Objetivo:** sumar canales con el mínimo código, aprovechando **inboxes nativos de Chatwoot**.

**Tareas:**
- **Telegram**: inbox Telegram (**token** del bot) y listo.  
  Chatwoot
- **Instagram**: inbox Instagram (cuenta **Business** + permisos **Graph**).  
  Chatwoot
- **Facebook Messenger**: inbox Facebook (**página**).  
  Chatwoot
- **IA**: asigna el **mismo Agent Bot** (webhook) a estos inboxes; Chatwoot enviará los eventos al bot, tú llamarás a Flowise y responderás como en WA.  
  Chatwoot

**Validación:** DMs de **TG/IG/FB** entran a Chatwoot; el **bot responde**; **handoff** funciona.

---

### Fase 5 — Pruebas, endurecimiento y Piloto en VPS

**Objetivo:** consolidar calidad y pasar a producción.

**Tareas (resumen):**

**Seguridad:**
- Proxy con **HTTPS** (Nginx/Traefik), **HSTS**, **headers** seguros.
- Tokens/API keys en variables de entorno; **rotate** periódico.
- **Autenticación** a Flowise UI; **exponer solo lo necesario** (idealmente Flowise API detrás de red interna).  
  Chatwoot Developers

**Monitoreo:**
- **Healthchecks** de Chatwoot (Docker guide), Evolution API **health**, Flowise **/prediction** ping.  
  Chatwoot Developers
- **Uptime Kuma/Alertas**.

**Backups:**
- **Postgres** (Chatwoot) diarios; versionado.
- Volúmenes (si Evolution API persiste sesión/archivos).

**Pruebas E2E:**
- **Carga** (mensajes simultáneos).
- **Media** (imágenes, notas de voz, documentos) por WA/TG/IG/FB (Evolution y Chatwoot soportan media; ajusta **límites/políticas**).  
  doc.evolution-api.com

**Despliegue:**
- **VPS** 4–8 GB RAM, 2–4 vCPU.
- **Dominios**: `chatwoot.tu-dominio`, `evoapi.tu-dominio`, `flowise.tu-dominio`.
- Seguir **guía Docker de Chatwoot** para prod (Nginx + Let’s Encrypt).  
  Chatwoot Developers

**Criterio de aceptación del piloto:** estabilidad **7×24**, latencia de respuesta IA aceptable, **handoff** sin pérdidas, agentes satisfechos con el flujo.

---

## Consideraciones técnicas clave

- **¿Por qué sin Node-RED?** Evolution API ya **pega directamente con Chatwoot** (crea/gestiona inbox y sincroniza mensajes), y **Chatwoot Agent Bot** te da el **webhook** perfecto para enchufar **Flowise** sin un orquestador intermedio. Menos piezas = menos fallos.  
  doc.evolution-api.com  
  +1  
  Chatwoot

- **Elección de motor WA en Evolution:** puedes usar **Baileys** (JS) o **Whatsmeow** (Go) según tu preferencia/estabilidad del momento; ambos están contemplados por el proyecto.  
  doc.evolution-api.com  
  docs.evoapicloud.com

- **Chatwoot: API Channel vs integración de Evolution:** la **integración nativa** de Evolution con Chatwoot es más rápida y trae opciones como **importContacts/importMessages**, **reopen**, etc.; **solo usa API Channel** si de verdad necesitas control extremo.  
  doc.evolution-api.com  
  Chatwoot

- **Flowise API:** el endpoint **/prediction/{id}** simplifica; usa **conversation_id** de Chatwoot como **sessionId** para mantener memoria por conversación.  
  docs.flowiseai.com

---

## Roadmap de mejoras (post-MVP)

- **Persistencia de contexto** (si Flowise no retiene): almacenar últimos **N** mensajes por conversación.  
- **Políticas anti-spam** y **throttling** por número.  
- **Observabilidad** (correlación request-id entre Evolution↔Chatwoot↔Flowise).  
- **Hardening de adjuntos** (antivirus, tamaño máximo, extensión permitida).  
- **Despliegue HA**: réplicas de Chatwoot worker, Evolution API detrás de balanceador.

---

## Fuentes principales

- **Evolution API** – Intro y motores; **instancias e integración con Chatwoot (crear/setear)**:  
  doc.evolution-api.com  
  +2  
  doc.evolution-api.com  
  +2  
  docs.evoapicloud.com

- **Chatwoot** – **Agent Bots, Webhooks, API Channel y despliegue Docker**:  
  Chatwoot  
  +2  
  Chatwoot  
  +2  
  Chatwoot Developers

- **Flowise** – **API de predicción**:  
  docs.flowiseai.com  
  +1

- **Stack ejemplo Evolution+Chatwoot en Docker (comunidad)**:  
  GitHub  
  +1
