# Flowise — RAG Support Bot (Guía)

Objetivo
- Crear un chatflow con RAG (retrieval-augmented generation) que responda preguntas basándose en tus documentos, manteniendo contexto por conversación via `sessionId`.

Arquitectura del flujo
- Ingesta: Cargador de documentos (PDF/Markdown/Texto) → Partición (Text Splitter).
- Indexado: Embeddings → Vector Store (recomendado: Chroma local para MVP).
- Recuperación: Vector Store Retriever (topK 3–5, score threshold si está disponible).
- Generación: LLM con prompt de sistema que cite fuentes cuando sea posible.
- Memoria: usar `overrideConfig.sessionId` que envía el Bot Gateway (Chatwoot `conversation_id`).

Pre-requisitos
- LLM + Embeddings configurados en Flowise (OpenAI/Anthropic/Ollama/LocalAI, etc.).
- Sin servicios extra: usa Vector Store = Chroma (local). Para producción puedes cambiar a Qdrant/Milvus/Weaviate/Supabase (pgvector).

Pasos (UI Flowise)
1) Crear Chatflow nuevo.
2) Añadir nodos:
   - Document Loader: usa el nodo "File Loader" y sube PDFs/MD/TXT.
   - Text Splitter: tamaño 800–1200, solapamiento 100–150.
   - Embeddings: elige la familia que coincida con tu LLM/infra.
   - Vector Store Upsert: tipo Chroma. Conecta desde Text Splitter + Embeddings.
   - Vector Store Retriever: tipo Chroma, topK=4–5.
   - Prompt Template (System): pega el prompt de abajo.
   - LLM: conecta desde Prompt y desde Retriever (según el nodo de "Conversational RAG" o armando Cadena Manual: Combina contexto recuperado + pregunta en el prompt).
   - Output: Default Response.
3) Publicar y copiar el `Flow ID`.

Prompt de sistema sugerido
```
Eres un asistente de soporte que responde SOLO con base en el contexto proporcionado.
- Idioma: español.
- Si el contexto no contiene la respuesta, indica que no está en la base y sugiere hablar con un humano.
- Resume y responde con precisión; máximo 5 oraciones.
- Si el usuario pide "humano" o sinónimos, no respondas contenido nuevo.
- Si es posible, cita la sección o título del documento relevante.
```

Plantilla de Prompt (ejemplo si armas cadena manual)
```
[INSTRUCCIONES]
{{system_instructions}}

[CONTEXTO]
{{retrieved_context}}

[PREGUNTA]
{{user_question}}
```
- Donde `retrieved_context` se arma concatenando los topK pasajes retornados por el Retriever.

Parámetros recomendados
- Text Splitter: `chunk_size=1000`, `chunk_overlap=120`.
- Retriever: `topK=4`, `score_threshold` (si disponible) ~0.3–0.5.
- LLM: temperatura 0.2–0.4; límite de tokens de salida 256–512.

Memoria por conversación
- El Bot Gateway envía `overrideConfig: { sessionId: conversation_id }`.
- Si tu chatflow soporta memoria nativa, actívala para mantener el historial por `sessionId`.

Pruebas
- Importa 2–3 documentos de prueba (FAQ, políticas, precios).
- `curl -X POST http://localhost:3012/api/v1/prediction/<flowId> -H 'Content-Type: application/json' -d '{"question":"¿Cuál es el horario de soporte?"}'`
- Verifica que la respuesta use pasajes del contexto.

Producción (opcional)
- Cambia Vector Store a Qdrant/Milvus/Weaviate/Supabase(pgvector) según tu infraestructura.
- Controla tamaño y formato de archivos, y añade pipeline de limpieza/normalización.
- Añade nodos de "Fallback" cuando no haya contexto relevante.

