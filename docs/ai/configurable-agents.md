# Configurable AI Agents

Sapling AI agents are admin-managed chat profiles for Songbird. They reuse the existing chat runtime, provider/model records, internal Sapling MCP tools, external MCP server configs, and semantic search. An agent does not start a separate orchestration stack; it scopes the normal Songbird runtime.

The chat provider/model and web-search provider/model are independent. An
administrator can select an optional OpenAI or Gemini search provider and a
search-capable model in the Runtime tab. Selecting a model also selects its
provider; selecting a provider filters the model list. If only the search
provider is selected, Sapling uses that provider's default search model;
otherwise Sapling uses the active system-wide default for web search.
This lets a tool-capable Ollama or LM Studio chat model use online research
without pretending that the local provider has built-in browsing.
The runtime selectors are bidirectional: choosing a provider filters its model
list, while choosing a model directly selects its owning provider. The search
provider selector is a UI-only filter; the persisted search-model relation
remains the authoritative provider/model combination.
The builder loads the search provider/model catalog independently from the chat
catalog, so a search-capable model does not also need to be exposed as a chat
model merely to appear in this selector.

AI Agents 2.0 extends the builder into an Agent Workbench. The principle stays
the same: agents assist work, prepare changes, and explain sources; mutating
actions remain confirm-first.

## Main Files

```text
backend/src/entity/AiAgentItem.ts
backend/src/entity/AiAgentVersionItem.ts
backend/src/entity/AiAgentRunItem.ts
backend/src/entity/AiAgentEvaluationItem.ts
backend/src/entity/AiAgentPlaybookItem.ts
backend/src/entity/AiAgentMemoryItem.ts
backend/src/entity/AiChatToolActionItem.ts
backend/src/api/ai/ai-agent-policy.service.ts
backend/src/api/ai/ai-agent-context.service.ts
backend/src/api/ai/ai-agent-workbench.service.ts
backend/src/api/ai/ai-chat-tool-action.service.ts
backend/src/api/ai/ai-chat-stream.service.ts
backend/src/api/ai/ai.service.ts
backend/src/api/ai/mcp.service.ts
frontend/src/views/AiAgentBuilderView.vue
frontend/src/components/ai/AiAgentConfigurationPanels.vue
frontend/src/components/ai/AiAgentWorkbenchPanels.vue
frontend/src/components/ai/aiAgentBuilder.types.ts
frontend/src/components/ai/aiAgentBuilder.utils.ts
frontend/src/composables/ai/useAiAgentBuilder.ts
frontend/src/components/system/SaplingAiChat.vue
frontend/src/components/system/ai-chat/SaplingAiChatMessageList.vue
frontend/src/components/system/ai-chat/SaplingAiChatToolActions.vue
frontend/src/components/system/ai-chat/useSaplingAiChatRuntimeCatalog.ts
frontend/src/components/system/ai-chat/useSaplingAiChatSessions.ts
frontend/src/components/system/ai-chat/useSaplingAiChatAttachments.ts
frontend/src/components/system/ai-chat/useSaplingAiChatStream.ts
```

## Frontend Chat Boundaries

`SaplingAiChat.vue` is the overlay and lifecycle orchestrator. Reusable chat
behavior is divided by responsibility:

- `useSaplingAiChatRuntimeCatalog` loads providers, models, agents, and voice
  targets and keeps runtime selection consistent with sessions/preferences.
- `useSaplingAiChatSessions` owns session lists, message paging, rename/archive
  persistence, and deterministic session ordering.
- `useSaplingAiChatAttachments` owns import-analysis upload state.
- `useSaplingAiChatStream` owns request context, streaming events, local failure
  projection, and confirm/reject tool-action updates.
- `SaplingAiChatMessageList` renders message history while
  `SaplingAiChatToolActions` owns the reusable confirm-first action card and
  technical-details dialog. Shared navigation parsing remains UI-independent.

The new-chat state uses the selected agent's `welcomeMessage` and
`conversationStarters` as its onboarding surface. Existing sessions present
their pinned agent/provider/model as compact context rather than as disabled
configuration controls. The session rail supports title/runtime search and
groups conversations by recency; enabling archived sessions adds them to the
active list instead of replacing it.

Chat provider/model catalogs load atomically and retry one transient empty or
failed first response. Optional transcription or speech catalogs do not block
the core chat runtime. Until the core catalog has settled, the chat renders a
loading state rather than claiming that no provider is configured; an actual
failure or empty result remains recoverable through the in-chat retry action.
Every catalog request has a bounded client-side wait so a request that never
settles transitions to that recoverable state instead of leaving the chat in
an endless loading state. Optional voice catalogs do not drive the main chat
progress indicator.
An already-open chat initializes immediately when its component mounts, which
also repairs state after a development hot reload. The loading presentation is
driven only by active provider/model requests; an idle, not-yet-loaded state is
shown as recoverable instead of being mislabeled as an endless load.

The session rail derives response activity from persisted session lifecycle
fields. Running responses remain marked as responding across reloads; completed
responses remain new until the owning user opens the conversation and the
explicit read endpoint advances its read marker. While a response is running,
the frontend polls persisted activity and message checkpoints so a reloaded
conversation continues to fill without depending on the original HTTP stream.
If the live response stream is interrupted, the chat shows a localized
connection message and reloads already persisted progress when available.

## Agent Model

`AiAgentItem` stores:

- profile fields such as title, description, icon, color, welcome message, and starters
- `promptMarkdown` for agent-specific system instructions
- optional provider/model overrides
- data scope through `allowedEntityHandles` and `allowedKnowledgeEntityHandles`
- tool scope through `allowedInternalTools` and `allowedExternalTools`
- `mutationMode`, currently `confirm` or `readOnly`
- optional role visibility; no roles means visible to all users with chat access

`AiChatSessionItem.agent` stores the selected agent for a conversation. Existing sessions keep their agent; new chats use the selected or default active agent.

`AiAgentVersionItem` snapshots production behavior. New sessions pin the active
or selected version on `AiChatSessionItem.agentVersion`, so later prompt changes
do not rewrite the meaning of older chats.

`AiAgentPlaybookItem` stores structured multi-step guidance for common jobs,
for example ticket resolution or estimate preparation. Playbooks are prompt
context, not hidden automation; the normal agent policy and confirm-first rules
still apply.

`AiAgentMemoryItem` stores controlled reusable instructions, glossary notes,
customer context, or snippets. Memory is included only when active and scoped to
the selected agent and context.

`AiAgentRunItem` records transparent execution metadata: agent, version,
playbook, provider/model, tool calls, sources, pending actions, duration,
status, errors, and final answer where available. `AiAgentEvaluationItem`
stores manual test cases and review status for quality tracking.

## Tool Policy

The chat runtime asks `AiAgentPolicyService` to convert an agent into an MCP policy. The policy is enforced in two places:

1. Tool listing, so the model only sees allowed tools.
2. Tool execution, so direct or repeated tool calls cannot bypass the policy.

Internal Sapling tools also enforce entity scope. For example, `generic_get`, `generic_list`, `semantic_search`, and generic mutations reject disallowed entity handles. `entity_catalog` and `entity_search` are filtered to the allowed entities.

External MCP tools must match `allowedExternalTools`, using either `toolName` or `serverName.toolName`. `McpServerConfig.allowedTools` is also enforced independently for each server.

## Confirmed Mutations

Agents with `mutationMode = confirm` do not execute `generic_create`, `generic_update`, or `generic_delete` immediately. Instead, Sapling creates an `AiChatToolActionItem` with status `pending`.

The frontend renders pending actions in the chat. The user can:

- confirm, which calls `POST /api/ai/chat/tool-actions/:handle/confirm`
- reject, which calls `POST /api/ai/chat/tool-actions/:handle/reject`

The confirm endpoint reloads the stored action, checks ownership, expiry, and agent policy again, then executes the exact stored tool call.

## Builder

The guided workbench lives at:

```text
/ai-agents
```

It saves the base agent through the generic `aiAgent` API and uses
`GET /api/ai/chat/tools` to show active internal and external MCP tools. The
workbench also calls:

```text
GET /api/ai/agents/:handle/workbench
POST /api/ai/agents/:handle/test-runs
GET /api/ai/agents/:handle/runs
GET /api/ai/agents/:handle/evaluations
POST /api/ai/agents/:handle/evaluations
POST /api/ai/chat/sessions/:handle/playbook
```

Admins can create version snapshots, run test prompts, inspect recent runs,
maintain quality test cases, and review memory/playbooks from the same surface.

On desktop, the builder is a viewport-height workspace: the agent rail and the
active editor panel scroll independently while tabs and save actions remain
visible. The usage panel summarizes the current 25-run workbench window and
renders runs newest-first as expandable trace cards. A collapsed card keeps
status, model, start time, duration, tool/source counts, pending actions, and
context scannable. Expanding it groups token usage, tool arguments and results,
sources/navigation, prepared actions, response text, and error details. Keep
long trace values bounded and wrapping so a provider payload or encoded route
cannot introduce horizontal page scrolling.

The route-level builder is a composition shell. Profile, prompt, data, tool,
runtime, and release controls live in `AiAgentConfigurationPanels`; version,
test-run, memory/playbook, evaluation, usage, and trace presentation live in
`AiAgentWorkbenchPanels`. `useAiAgentBuilder` owns loading and commands, while
the type and utility modules own reusable draft/evaluation contracts and pure
API mapping. New workbench sections should extend the matching panel or add a
focused sibling rather than returning workflow logic to the route component.

## Extension Notes

- Add new internal tools to agent seed scopes when they should be available to seeded agents.
- Keep mutating tools confirm-gated unless the product explicitly chooses a stronger automation mode.
- Add specialized builder controls only when JSON fields become too error-prone for administrators.
- Add domain playbooks for repeated work before introducing automation. A
  playbook should describe steps and expected output; tools and writes stay
  governed by the agent policy.
