# Local AI Provider Setup: LM Studio And Ollama

This guide explains how to connect Sapling's AI chat and vectorization features
to local models through LM Studio or Ollama.

Sapling talks to both providers through OpenAI-compatible HTTP APIs:

```text
Sapling -> OpenAI-compatible client -> LM Studio or Ollama -> local model
```

## What Works

- Chat through Songbird.
- Optional Sapling MCP tool calls when the selected local model supports
  OpenAI-style tool calling.
- Embeddings for semantic search when a real embedding model is configured.
- Provider and model selection through the existing AI provider/model records.

Currently local providers are not used for speech-to-text or speech output.
Those features remain provider-specific.

## Provider Records

Provider records live in Sapling under:

```text
/table/aiProviderType
```

Model records live under:

```text
/table/aiProviderModel
```

When a model is created through the generic table, its `handle` is mandatory.
Use a stable technical value such as `ollama-gemma4-12b`; the provider-facing
model name remains in `providerModel` (for example `gemma4:12b`). An empty
handle cannot be persisted as a usable Songbird preference.

Depending on the database state, these records may already exist from seed data.
If they do not appear after running seeders, create or update them manually in
the two tables above. Some environments may have already executed an older seed
file, and Sapling intentionally skips already successful seed scripts.

Do not broadly clear seed tracking in a real environment. If a seed must be
rerun, inspect `seed_script_item` first and remove only the exact marker you
intend to rerun.

## LM Studio

### 1. Start LM Studio Server

In LM Studio:

1. Open the Developer tab.
2. Start the local server.
3. Confirm that the OpenAI-compatible server is reachable at:

```text
http://127.0.0.1:1234/v1
```

Optional command-line variant:

```bash
lms server start
```

### 2. Load Models

Load one chat model and, if semantic search should be local too, one embedding
model.

Known working example values:

```text
chat model id: openai/gpt-oss-20b
embedding model id: text-embedding-nomic-embed-text-v1.5
```

The exact model id must match what LM Studio returns from:

```text
GET http://127.0.0.1:1234/v1/models
```

### 3. Configure Provider

Create or verify this `AiProviderTypeItem`:

```json
{
  "handle": "lmstudio",
  "title": "LM Studio",
  "credentialTypes": ["lmStudioBaseUrl"],
  "credentials": {
    "lmStudioBaseUrl": "http://127.0.0.1:1234/v1"
  },
  "isActive": true
}
```

### 4. Configure Chat Model

Create or verify this `AiProviderModelItem`:

```json
{
  "handle": "lmstudio-openai-gpt-oss-20b",
  "title": "GPT OSS 20B",
  "provider": "lmstudio",
  "providerModel": "openai/gpt-oss-20b",
  "supportsStreaming": true,
  "supportsTools": true,
  "supportsEmbeddings": false,
  "isDefault": true,
  "isActive": true
}
```

Set `supportsTools` to `false` if the loaded model does not reliably return
valid tool calls.

### 5. Configure Embedding Model

Create or verify this `AiProviderModelItem`:

```json
{
  "handle": "lmstudio-nomic-embed-text-v1_5",
  "title": "Nomic Embed Text v1.5",
  "provider": "lmstudio",
  "providerModel": "text-embedding-nomic-embed-text-v1.5",
  "supportsStreaming": false,
  "supportsTools": false,
  "supportsEmbeddings": true,
  "embeddingBatchSize": 16,
  "isDefault": true,
  "isActive": true
}
```

## Ollama

### 1. Start Ollama

Ollama usually serves its native API at:

```text
http://127.0.0.1:11434/api
```

Sapling uses Ollama's OpenAI-compatible endpoint:

```text
http://127.0.0.1:11434/v1
```

### 2. Pull Models

Pull at least one chat model:

```bash
ollama pull gpt-oss:20b
```

Pull one embedding model if semantic search should use Ollama:

```bash
ollama pull nomic-embed-text
```

Use any other Ollama model if preferred. The important part is that the
`providerModel` value in Sapling exactly matches the local Ollama model name.

### 3. Configure Provider

Create or verify this `AiProviderTypeItem`:

```json
{
  "handle": "ollama",
  "title": "Ollama",
  "credentialTypes": ["ollamaBaseUrl"],
  "credentials": {
    "ollamaBaseUrl": "http://127.0.0.1:11434/v1"
  },
  "isActive": true
}
```

### 4. Configure Chat Model

Create or verify this `AiProviderModelItem`:

```json
{
  "handle": "ollama-gpt-oss-20b",
  "title": "GPT OSS 20B",
  "provider": "ollama",
  "providerModel": "gpt-oss:20b",
  "supportsStreaming": true,
  "supportsTools": true,
  "supportsEmbeddings": false,
  "isDefault": true,
  "isActive": true
}
```

If the chosen Ollama model does not support tool calls reliably, set:

```json
{
  "supportsTools": false
}
```

Chat will still work, but Songbird will not call Sapling MCP tools with that
model.

### 5. Configure Embedding Model

Create or verify this `AiProviderModelItem`:

```json
{
  "handle": "ollama-nomic-embed-text",
  "title": "Nomic Embed Text",
  "provider": "ollama",
  "providerModel": "nomic-embed-text",
  "supportsStreaming": false,
  "supportsTools": false,
  "supportsEmbeddings": true,
  "embeddingBatchSize": 16,
  "isDefault": true,
  "isActive": true
}
```

## Apply Seed Data

If the local provider records are present in pending seed files, apply them with:

```bash
npm run orm:seed --prefix backend
```

For a full local update path, use:

```bash
npm run orm:deploy --prefix backend
```

If the records are not created because the matching seed file was already
executed in your local database, create the provider/model records manually
through Sapling's generic tables.

## Test Provider Availability

Use these local checks outside Sapling if something does not appear in the UI.

LM Studio:

```bash
curl http://127.0.0.1:1234/v1/models
```

Ollama:

```bash
curl http://127.0.0.1:11434/v1/models
curl http://127.0.0.1:11434/api/tags
```

## Test In Sapling

1. Start Sapling backend and frontend.
2. Open Songbird.
3. Select provider `LM Studio` or `Ollama`.
4. Select the local chat model.
5. Send a simple prompt, for example:

```text
Antworte exakt mit: OK
```

For semantic search:

1. Open the vectorization dialog as an admin.
2. Select the local embedding provider and model.
3. Select an entity such as `ticket` or `knowledgeArticle`.
4. Run vectorization.
5. Ask Songbird a natural-language question that should use semantic search.

## Troubleshooting

### Provider Does Not Appear

- Provider is inactive.
- No active chat-capable model exists for that provider.
- Credentials are missing or malformed.
- Seed file was already marked as executed before local provider records were
  added.

### Model Does Not Appear

- The model has no non-empty technical `handle`.
- Model record is inactive.
- `supportsStreaming` is false for a chat model.
- `supportsEmbeddings` is false for an embedding model.
- The model's `provider` relation points to the wrong provider.

### Chat Fails

- Local server is not running.
- `providerModel` does not match the loaded model id.
- The model is too large for available RAM/VRAM.
- `supportsTools` is true but the model cannot emit valid tool calls. Disable
  `supportsTools` and retry.

### Vectorization Fails

- The selected model is a chat model, not an embedding model.
- The embedding model is not loaded or not pulled locally.
- The PostgreSQL database does not have pgvector available.
- Existing vector indexes were created with a different provider/model and need
  to be rerun for the selected entity.

## References

- LM Studio OpenAI-compatible endpoints: https://lmstudio.ai/docs/developer/openai-compat
- LM Studio local server: https://lmstudio.ai/docs/developer/core/server
- Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility
- Ollama API introduction: https://docs.ollama.com/api/introduction
