# AI, MCP, And Vectorization

Sapling's AI system centers on Songbird, the internal assistant. Songbird can use Sapling data through MCP tools, generic services, and semantic vector search.

## Main Files

```text
backend/src/api/ai/ai.service.ts
backend/src/api/ai/ai-agent-context.service.ts
backend/src/api/ai/ai-agent-workbench.service.ts
backend/src/api/ai/ai-chat-persistence.service.ts
backend/src/api/ai/ai-chat-session.service.ts
backend/src/api/ai/ai-chat-message.service.ts
backend/src/api/ai/ai-chat-media.service.ts
backend/src/api/ai/ai-chat-stream.service.ts
backend/src/api/ai/ai-chat-tool-action.service.ts
backend/src/api/ai/ai-chat-runtime.service.ts
backend/src/api/ai/ai.controller.ts
backend/src/api/ai/ai-media.controller.ts
backend/src/api/ai/ai-agent.controller.ts
backend/src/api/ai/mcp.service.ts
backend/src/api/ai/sapling-mcp.service.ts
backend/src/api/ai/sapling-mcp-transport.service.ts
backend/src/api/ai/sapling-mcp-execution.service.ts
backend/src/api/ai/sapling-mcp-metadata.service.ts
backend/src/api/ai/sapling-mcp-generic-tool.service.ts
backend/src/api/ai/sapling-mcp-search-tool.service.ts
backend/src/api/ai/sapling-mcp-import-tool.service.ts
backend/src/api/ai/sapling-mcp-value.service.ts
backend/src/api/ai/sapling-mcp-tool-definitions.ts
backend/src/api/ai/sapling-mcp-permission.service.ts
backend/src/api/ai/ai-vector.service.ts
backend/src/api/ai/ai-vector-index.service.ts
backend/src/api/ai/ai-vector-search.service.ts
backend/src/api/ai/ai-vector-document-builder.service.ts
backend/src/api/ai/ai-vector-embedding.service.ts
backend/src/api/ai/ai-web-search.service.ts
backend/src/api/ai/ai-vector-content.utils.ts
backend/src/api/ai/ai-vector.utils.ts
backend/src/api/ai/prompts/
frontend/src/components/system/ai-chat/
frontend/src/services/api.ai.types.ts
frontend/src/components/system/SaplingVectorizationDialog.vue
```

## AI Service Boundaries

`AiService` is the stable controller, mail-processing, and MCP-facing facade.
The implementation is divided by lifecycle responsibility:

- `AiAgentContextService` resolves agents, pinned versions, playbooks, scoped
  memories, tool policies, and runtime instructions.
- `AiAgentWorkbenchService` owns workbench reads, runs, evaluations, and
  aggregate quality statistics.
- `AiChatPersistenceService` owns user/record ownership checks, session
  population, message paging/sequencing, and attachment/transcription links.
- `AiChatSessionService` and `AiChatMessageService` own their respective CRUD
  lifecycles while preserving the facade contract.
- `AiChatMediaService` owns import attachments, transcription, speech
  synthesis, and their persisted documents.
- `AiChatToolActionService` keeps confirm-first mutation preflight,
  persistence, confirmation/rejection, follow-up actions, and message payload
  synchronization together as one security boundary.
- `AiChatStreamService` orchestrates persisted messages, runtime selection,
  MCP tool execution, streaming providers, run traces, sources, and navigation
  links; provider-specific streaming remains in `AiChatRuntimeService`.

Assistant responses are durable from the beginning of a run. The session stores
its response lifecycle and read marker, while streamed message content is
checkpointed at a bounded interval and before tool execution. Completion and
failure are terminal persisted states. Session listing also recovers abandoned
responses after the configured stale timeout, preventing permanent responding
indicators after a process interruption.

All of these services are registered by `AiModule`; consumers should continue
to depend on `AiService` unless they are implementing an internal AI lifecycle
collaborator.

## Chat Model

Relevant entities:

```text
AiAgentItem
AiAgentVersionItem
AiAgentRunItem
AiAgentEvaluationItem
AiAgentPlaybookItem
AiAgentMemoryItem
AiChatSessionItem
AiChatMessageItem
AiChatToolActionItem
AiChatTranscriptionItem
AiProviderTypeItem
AiProviderModelItem
AiVectorDocumentItem
McpServerConfigItem
```

Provider/model records are stored in the database. Runtime credentials and provider behavior are resolved by backend AI provider services.

`AiAgentItem` stores configurable Songbird profiles with an agent prompt,
optional chat provider/model overrides, an independent web-search model, data
scopes, tool scopes, and mutation behavior. `AiAgentVersionItem` snapshots
prompts, search-model selection, and scope for traceable
production chats. `AiChatSessionItem.agent` and
`AiChatSessionItem.agentVersion` keep the chosen runtime for a conversation.
`AiAgentPlaybookItem` and `AiAgentMemoryItem` add controlled workflow and
instruction context. `AiAgentRunItem` records tool/source transparency and
runtime metadata. Mutating generic tools are confirm-gated through
`AiChatToolActionItem` when an agent uses `mutationMode = confirm`.

### OpenAI-Compatible Local Providers

LM Studio and Ollama are registered as OpenAI-compatible local providers. They
use the normal provider/model records, so the frontend selectors do not need
special-case behavior.

Default local configuration:

```text
provider handle: lmstudio
base URL credential: lmStudioBaseUrl = http://127.0.0.1:1234/v1
chat model: openai/gpt-oss-20b
embedding model: text-embedding-nomic-embed-text-v1.5
```

Default Ollama configuration:

```text
provider handle: ollama
base URL credential: ollamaBaseUrl = http://127.0.0.1:11434/v1
chat model example: gpt-oss:20b
embedding model example: nomic-embed-text
```

Local models should set `supportsTools` only when the loaded model reliably
supports OpenAI-style tool calls. Chat still works without tools, but Songbird
will not automatically call Sapling MCP tools for that model.

Local chat models do not need their own internet connection. If an Ollama or LM
Studio model supports tool calls, it can call Sapling's internal `web_search`
tool. Sapling then delegates that call to the independently configured OpenAI or
Gemini search model.

Ollama model seed records are inactive by default because local installations
may not have the example models pulled yet. Pull the model in Ollama, update
`providerModel` if needed, then activate the matching `AiProviderModelItem`.

For setup steps, smoke tests, and troubleshooting, see
`docs/ai/local-ai-provider-setup.md`.

## Songbird System Prompt

Songbird's base behavior and tool guidance live in:

```text
backend/src/api/ai/prompts/ai.prompts.ts
```

Important expectations:

- speak as the Sapling assistant
- use current Sapling tools when needed
- prefer generic tools for current data
- use semantic search for natural-language long-text questions
- do not invent record URLs
- treat internal handles as technical metadata unless explicitly requested

### Focused Markdown Preparation

`POST /api/ai/markdown/prepare` provides a non-persisting text transformation
for `SaplingFieldMarkdown`. It uses the user's preferred chat provider/model
when supplied and otherwise resolves the configured default runtime. The
dedicated system instruction corrects grammar, spelling, professional tone, and
awkward wording while requiring the model to stay close to the source and add,
remove, shorten, or summarize no content. It keeps the original language,
document type, structure, forms of address, salutations, greetings, closing
pleasantries, sign-offs, signatures, and personal wording. Unnecessarily
emotional, aggressive, accusatory, or exaggerated wording is made calm,
factual, and professional without changing the underlying message. The response
contains only the revised Markdown; it does not create a Songbird chat session
or message.

## MCP Layers

Sapling has two MCP-related layers.

### Internal Sapling MCP Server

File:

```text
backend/src/api/ai/sapling-mcp.service.ts
```

This exposes Sapling-native tools:

```text
current_person
entity_catalog
entity_schema
entity_search
generic_list
generic_get
generic_timeline
ticket_search
semantic_search
knowledge_search
web_search
generic_create
generic_update
generic_delete
```

It is also exposed over HTTP:

```text
/api/ai/mcp
```

`SaplingMcpService` is the stable facade. Internal MCP responsibilities are
split as follows:

- `SaplingMcpTransportService` owns HTTP sessions and MCP server transport.
- `SaplingMcpExecutionService` owns tool dispatch, result formatting, and
  tool-boundary error handling.
- Metadata/schema, generic CRUD/timeline, search, and import workflows live in
  their respective focused tool services.
- `SaplingMcpValueService` owns shared argument, policy, and payload
  normalization.
- Criteria construction, permission filtering, and result formatting remain
  isolated in their existing focused services.
- The public tool-definition aggregator composes catalog, search, import, and
  mutation definition modules while preserving the existing export.

Internal consumers should depend on `SaplingMcpService`; the collaborators are
implementation boundaries registered by `AiModule`.

### Provider-independent web search

`web_search` is part of the internal Sapling MCP server; no additional MCP
process or paid intermediary is required. The tool is advertised only when an
active `AiProviderModelItem` has `supportsWebSearch = true` and its OpenAI or
Gemini provider credentials are configured. `isDefaultWebSearch` selects the
system fallback, while `AiAgentItem.webSearchProvider`/`webSearchModel` and the
version snapshot can choose a different search provider and model per agent.

The chat model and search model are deliberately separate. OpenAI and Gemini
chat models can use the tool through their normal function-calling flow. Ollama
and LM Studio can use exactly the same tool when the local model supports
OpenAI-compatible function calls. Local providers themselves are not marked as
web-search capable.

Provider execution lives in `AiWebSearchService`:

- OpenAI uses the Responses API `web_search` tool and requests the complete
  source list.
- Gemini uses the Interactions API with `google_search` and adds `url_context`
  when the request contains explicit URLs.
- The normalized result contains the answer, actual search queries, citations,
  provider/model handles, usage, and timestamp.
- Web citations are persisted as `kind = web` run/message sources and rendered
  as external links in chat.

Web content is always untrusted evidence. Provider instructions and Songbird's
system prompt prohibit following webpage instructions. Company onboarding must
research first, inspect the `company` schema, check existing records, and only
then prepare a confirm-gated create or update.

See:

```text
docs/integrations/sapling-mcp-http.md
```

### MCP Aggregator

File:

```text
backend/src/api/ai/mcp.service.ts
```

This lists and executes:

- internal Sapling MCP tools
- configured external MCP servers from `McpServerConfigItem`

External MCP server configs can use HTTP or `stdio`.
`McpServerConfig.allowedTools` is enforced when listing and executing external
tools. Agent policies add a second allow-list layer for both internal and
external tools.

## Permissions

MCP calls use the current authenticated Sapling user.

Rules:

- generic tools use generic services and entity permissions
- semantic search loads matching records through generic service permissions
- security fields are intentionally omitted from MCP schemas
- missing permissions should fail rather than silently exposing data

## Vectorization

Main files:

```text
backend/src/api/ai/ai-vector.service.ts
backend/src/api/ai/ai-vector-index.service.ts
backend/src/api/ai/ai-vector-search.service.ts
backend/src/api/ai/ai-vector-document-builder.service.ts
backend/src/api/ai/ai-vector-embedding.service.ts
backend/src/api/ai/ai-vector-content.utils.ts
backend/src/api/ai/ai-vector.utils.ts
backend/src/entity/AiVectorDocumentItem.ts
frontend/src/components/system/SaplingVectorizationDialog.vue
```

Vectorization builds chunks from selected entity records and stores embeddings in `AiVectorDocumentItem`.

`AiVectorService` is the stable controller/AI facade. Internally:

- `AiVectorDocumentBuilderService` loads supported source entities and creates
  their section documents.
- `ai-vector-content.utils.ts` contains pure entity-to-text and metadata
  projection helpers.
- `AiVectorEmbeddingService` batches provider calls and keeps OpenAI-compatible
  and Gemini embedding execution behind one contract.
- `AiVectorIndexService` computes document deltas and reconciles the persisted
  index transactionally.
- `AiVectorSearchService` embeds queries, groups matching chunks, and reloads
  source records through `GenericService`, preserving entity permissions.

Consumers should continue to depend on `AiVectorService`; the internal
collaborators are registered by `AiModule`.

Each vector document has:

- source entity handle
- source record handle
- source section
- chunk index
- title
- content
- content hash
- metadata
- provider/model handles
- embedding dimensions
- vector embedding

Content hashes avoid re-embedding unchanged chunks.

## Supported Semantic Entities

Configured in `ai-vector.utils.ts`.

```text
ticket
event
salesOpportunity
effortEstimate
effortEstimatePosition
knowledgeArticle
```

Sections:

| Entity                   | Sections                                           |
| ------------------------ | -------------------------------------------------- |
| `ticket`                 | `overview`, `problem`, `solution`                  |
| `event`                  | `overview`, `description`                          |
| `salesOpportunity`       | `overview`, `description`, `painPoints`            |
| `effortEstimate`         | `overview`, `requirements`                         |
| `effortEstimatePosition` | `overview`, `offerText`                            |
| `knowledgeArticle`       | `overview`, `problem`, `solution`, `documentation` |

## Running Vectorization

The frontend vectorization dialog lets an admin choose:

- embedding provider
- embedding model
- entity handle

Then it calls:

```text
POST /api/ai/vectorize
```

The exact route is implemented in `AiController` and handled by `AiVectorService`.

The matching vector index must exist before `semantic_search` returns semantic results.

## Semantic Search Flow

1. `semantic_search` receives `entityHandle`, `query`, and `limit`.
2. `AiVectorService` validates the entity is vectorizable.
3. It resolves the active provider/model from latest vector documents.
4. It embeds the query.
5. It retrieves nearest vector chunks.
6. It groups chunks by source record.
7. It loads accessible source records through `GenericService`.
8. It returns only records the user may read.

## Adding A Vectorizable Entity

1. Ensure the entity has useful long-text fields.
2. Add the entity handle to `VECTOR_ENTITY_HANDLES`.
3. Add sections to `VECTOR_SEARCHABLE_SECTIONS`.
4. Add relations to `VECTOR_SEARCH_RELATIONS`.
5. Add hints to `VECTOR_SEARCH_USAGE_HINTS`.
6. Add a document builder in `AiVectorService`.
7. Add frontend vectorization entity option and field labels.
8. Update MCP/AI prompt guidance if the new entity changes tool use.
9. Add or update tests for MCP forwarding/prompt expectations.

## Tool Guidance

Use:

- `ticket_search` for exact ticket numbers, external numbers, strict keywords, known fix lookup
- `knowledge_search` for broad knowledge-base questions across curated articles, tickets, effort estimates, estimate positions, and sales opportunities
- `web_search` for current public information, company research, and direct
  inspection of user-provided public URLs such as an Impressum
- `semantic_search` for natural-language long-text questions
- `entity_schema` before generic create/update/filter on unfamiliar entities
- `generic_get` when the exact handle is known
- `generic_timeline` for record history/activity questions

## Chat Navigation And Sources

Songbird stores tool transparency separately from chat navigation.

- `sources` records which tools and entities influenced an answer for audit and
  review.
- `navigationLinks` records deliberate UI actions such as opening a route, a
  specific record, or a filtered table of actual returned records.
- Navigation links are always user-triggered buttons. Loading an answer or
  selecting a chat session must never open a route automatically.
- No navigation link should be emitted for empty results, schema-repair
  responses, failed tool calls, read-only blocks, or confirm-gated pending
  actions.
- Search navigation links should be based on returned record handles, grouped by
  entity where needed, rather than a broad reconstructed query or only the last
  result.

This keeps buttons such as "Tabelle öffnen" tied to meaningful data and avoids
showing table actions for confirmation prompts or purely explanatory answers.

## Estimate, Opportunity, And Ticket Actions

Phase 4 exposes the existing knowledge search through ScriptButtons on
`effortEstimate`, `salesOpportunity`, and `ticket`. The buttons open Songbird
with a record-specific prompt. Songbird should first load the current record with
`generic_get`, then use `knowledge_search` across the indexed knowledge sources:

- effort estimates: compare previous estimates and estimate positions, derive
  typical positions, hour ranges, assumptions, and risks.
- sales opportunities: find similar pain points, solved cases, tickets, effort
  estimates, estimate positions, and reusable reference solutions.
- tickets: find similar cases, known fixes, knowledge articles, related effort
  estimates, estimate positions, and reference opportunities.

## AI Draft Creation

Phase 3 adds a generic entity-generation path for ScriptButtons. The shipped
`ticketKnowledgeArticle` template creates draft `knowledgeArticle` records from
ticket context through the configured/default chat provider.

The configuration lives in `aiEntityGenerationTemplate`:

- `sourceEntity`, `targetEntity`, and `actionName` bind a template to a
  ScriptButton action.
- `sourceRelations` controls which relations are loaded into the model prompt.
- `fieldMapping` maps model JSON keys to target fields.
- `sourceFieldMapping` copies deterministic values from source record paths to
  target fields, such as `contract.products.0` to `product`.
- `targetDefaults` sets fixed values such as draft status and internal
  visibility.
- `sourceReferenceField` and `userReferenceField` preserve provenance.

This keeps the first Ticket -> Knowledge Article action reusable instead of
hard-coding the target fields into `TicketController`.

## Common Mistakes

- Forgetting to run vectorization after adding a vectorizable entity.
- Returning vector matches without permission-filtered record loading.
- Treating `ticket_search` as a semantic search replacement.
- Adding a long-text entity to prompts but not to `VECTOR_ENTITY_HANDLES`.
- Hard-coding tool payloads instead of reading MCP schemas.
