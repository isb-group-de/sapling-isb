# Import Batches And External Record Links

Sapling has two import paths:

- the lightweight table CSV import under the generic table toolbar
- the initial-import workflow under `/import`

The initial-import workflow is designed for files that do not already match
Sapling handles or field names. It imports CSV data through auditable batches
and can link Sapling records back to stable keys from external systems.

## Main Files

```text
backend/src/api/import/
backend/src/api/import/import-ai-suggestion.service.ts
backend/src/api/import/import-ai-suggestion.prompts.ts
backend/src/api/import/import-template.service.ts
backend/src/api/import/import-matching.service.ts
backend/src/api/import/import-field-validation.service.ts
backend/src/api/import/import-execution.service.ts
backend/src/api/import/import-payload.service.ts
backend/src/api/import/import-reference-resolver.service.ts
backend/src/api/import/import-unique-conflict.service.ts
backend/src/api/import/import-batch-presenter.service.ts
backend/src/api/import/import-batch-query.service.ts
backend/src/api/import/import-validation.service.ts
backend/src/entity/ImportSourceItem.ts
backend/src/entity/ImportTemplateItem.ts
backend/src/entity/ImportTemplateValueMappingItem.ts
backend/src/entity/ImportBatchItem.ts
backend/src/entity/ImportBatchRowItem.ts
backend/src/entity/ExternalRecordLinkItem.ts
frontend/src/components/import/SaplingImportWorkspace.vue
frontend/src/composables/import/useSaplingImportValueMappings.ts
frontend/src/composables/import/useSaplingImportTemplates.ts
frontend/src/composables/import/useSaplingImportAiSuggestions.ts
frontend/src/composables/import/useSaplingImportMappingConfiguration.ts
frontend/src/composables/import/useSaplingImportBatchSession.ts
frontend/src/composables/import/useSaplingImportCommands.ts
frontend/src/composables/import/useSaplingImportPresentation.ts
frontend/src/composables/import/useSaplingImportConfigurationSession.ts
frontend/src/composables/import/useSaplingImportEntityCatalog.ts
frontend/src/services/api.import.service.ts
frontend/src/views/ImportView.vue
backend/src/api/ai/sapling-mcp.service.ts
frontend/src/components/system/ai-chat/SaplingAiChatConversation.vue
```

## Core Model

`ImportSourceItem` represents a source system such as Sage 100.

`ImportTemplateItem` stores reusable import strategies for one source system
and one target entity:

- field mappings
- field defaults for required values that are not present in the source file
- value mappings
- external key columns
- relation mapping metadata
- optional generic reference mapping

When the target entity metadata exposes a field default through the generic
template endpoint, the import workspace pre-fills that value for unmapped
fields. Explicit CSV mappings and template field-default overrides take
precedence.

The import workspace filters templates by selected source system and target
entity once either scope is selected, so users only see templates that fit the
current import context. When neither scope is selected yet, users can choose
from all active templates; selecting one applies its source system and target
entity before loading its mapping.

`ImportTemplateValueMappingItem` stores user-maintainable value conversions for
an import template. Each row maps one source value for one target field to the
value Sapling should receive. This keeps template maintenance available through
the generic table UI instead of forcing users to edit a JSON blob.

`ImportBatchItem` stores one uploaded CSV analysis and the selected mapping:

- target entity
- source system
- original headers and sample rows
- field mappings
- value mappings
- external key columns
- generic reference mapping
- selected import template
- validation and execution counters

`ImportBatchRowItem` stores row-level raw data, normalized payload, status,
action, target reference, external key details, and error messages.

`ExternalRecordLinkItem` is the stable bridge from an external system to any
Sapling record. It intentionally follows the same generic reference shape used
by `DocumentItem` and `InformationItem`:

```text
source + entity + externalKeyHash -> entity + reference
```

This keeps external IDs out of business entities and makes the mechanism work
for companies, people, tickets, documents, information records, and future
generic target types.

Generic record action menus can show external record links lazily for a single
persisted record when the current user has read permission for
`externalRecordLink`. The frontend only queries `externalRecordLink` when an
authorized user opens that action, using the current entity handle and record
handle as filter, then displays source system, external key parts, import
batches, and timestamps.

## Workflow

1. Upload a CSV file.
2. The backend parses headers, delimiter, rows, and sample rows.
3. Choose target entity and optional source system.
4. Load an existing import template or map CSV columns to Sapling fields.
5. Optionally configure value mappings for mapped fields, for example `1`
   from the file becomes status `5` or a referenced Sapling record handle.
6. Optionally configure defaults for fields that are required in Sapling but
   not present in the file, for example a default country or status.
7. For unique target fields, choose whether validation should reject duplicate
   values or append the selected external key to the imported value.
8. Optionally ask the AI to suggest a configuration. The backend sends only
   CSV headers, a few sample rows, target entity metadata, reference
   candidates, and matching templates to the configured chat model. The
   returned suggestion is normalized server-side and then applied in the UI as
   an editable proposal.
9. Optionally choose one or more external key columns.
10. Save the current mapping as an import template for later batches.
11. Optionally configure relation mappings by handle, by displayed value, or
    by external key links from previous imports.
12. Optionally configure a generic target reference for entities such as
    `information` that use `entity + reference`.
13. Validate the batch. Validation is queued as a background job, so the
    workspace can be left while row payloads, required fields, reference
    mappings, and planned actions are checked.
14. Download the complete error report when invalid rows need source-file
    cleanup.
15. Execute the batch. Execution is also queued as a background job. If valid
    rows exist, the workspace can run the import without invalid rows; invalid
    rows remain in the batch for later correction.

An exported `handle` can be mapped back to `handle` when a Sapling export is
re-imported. It is used only as the routing identity for the planned update and
is removed before field-permission checks and create/update mutations. Read-only
system fields such as `createdAt` and `updatedAt` are not importable field data.

Validation rejects non-empty invalid date strings and invalid boolean values
before execution. This includes source values such as `NULL` in date or datetime
fields and unsupported boolean values such as `-1`, so those rows are shown as
invalid in the preview instead of failing later in PostgreSQL or MikroORM.

Value mappings are stored as `ImportTemplateValueMappingItem` rows for reusable
templates and are also copied into the batch `mapping` JSON when a batch is
validated. They are applied while the batch is validated, before the row payload
is normalized for the target entity. The validated payload is then used for
execution, so users can inspect the Sapling preview before anything is written.

During execution, rows with an existing external record link update the linked
Sapling record. Rows without a link create a new record and store the link.
Rows that are not ready are skipped, so a few invalid CSV rows do not block a
large otherwise valid import.

Validation checks single-field unique constraints exposed by entity metadata.
For a unique field such as `company.name`, the batch can either mark duplicate
values as row errors or append the selected external key value, for example
`Leibniz (12345)`. If no external key column is selected, the row number is
used as a deterministic fallback suffix.

Validation and execution use the `imports` BullMQ queue when Redis is enabled.
When Redis is disabled locally, Sapling starts the same work in-process after
the API response returns. `ImportBatchItem` stores the current operation,
processed row count, job id, start/completion/failure timestamps, and latest
job error. The frontend stores active batch handles in local storage and polls
`GET /api/import/batches/:handle`; terminal states raise Message Center
notifications even if the user has left the import page while the app remains
open.

The optional matching endpoint returns a conservative row-level decision
proposal. Each sampled row receives `create`, `update`, `ambiguous`, or
`error`, plus confidence, matched reference, candidates, reason, and blocking
issues. A unique external record link is the strongest update signal. Fuzzy
value matches can suggest candidates, but ambiguous candidates do not trigger
automatic merging.

`ImportMatchingService` owns source/target search-field selection, candidate
queries, confidence scoring, display labels, and row-level recommendations. The
import facade resolves existing external links because that lookup is shared
with execution, then delegates the remaining matching workflow.

Import batches and import batch rows are intentionally deletable through the
generic entity UI in non-production setup workflows. Deleting a batch cascades
its row records; external record links keep their business reference and only
drop the optional first/last batch pointer.

Relation mappings with mode `externalKey` resolve target references through
`ExternalRecordLinkItem`. This supports staged imports such as importing
companies first and then importing persons whose company column contains the
same external company key. The lookup uses:

```text
source system + referenced entity + configured key columns -> Sapling handle
```

If the follow-up import uses a different column name for the same single
external key value, for example `iXISFirma` in a person file pointing to a
company previously imported with `iXISAdresse`, the resolver first tries the
canonical hash and then falls back to a unique single-key value match.

Import templates are created through `POST /api/import/templates` and updated
through `PATCH /api/import/templates/:handle`. Re-saving an existing template
must keep using its returned handle so the backend updates instead of trying to
insert another row with the same source/entity/title uniqueness key.

`ImportTemplateService` owns template filtering, persistence, title-conflict
checks, serial-sequence maintenance, value-mapping rows, and summary mapping.
`ImportService` keeps thin delegating methods because controllers and AI tools
use the existing import API facade.

`ImportFieldValidationService` owns configured/default metadata values,
current-person defaults, date and boolean validation, and required-field
diagnostics. `ImportValidationService` owns the queued validation worker,
permission-aware import-user hydration, row state transitions, planned actions,
progress/failure state, and composes payload, reference, custom-field, and
unique-conflict validation.

`ImportExecutionService` owns the queued execution worker, execution counters,
row create/update/skip/failure transitions, and external-record-link upserts.
`ImportService` validates whether a batch may be queued and delegates the actual
background execution by batch and user handle.

`ImportPayloadService` owns source-to-target value mappings, payload
normalization, metadata/default application, and final custom-field collection.
`ImportReferenceResolverService` owns relation mapping modes, generic-reference
mapping, metadata value-field lookup, external-key construction, and external
record-link resolution. The validation worker composes both services instead of
implementing those responsibilities in the import facade.

`ImportUniqueConflictService` owns unique-field eligibility, database and
in-batch claims, append-external-key behavior, length-aware suffixes, and
structured conflict messages. `ImportBatchPresenterService` maps persisted
batches and rows into API summaries without adding projection logic to the
orchestrator. `ImportBatchQueryService` owns canonical batch lookup, batch/error
summaries, distinct source-value queries, and the open-batch read model.
`ImportService` remains the stable controller and AI-tool facade for batch
configuration, job dispatch, matching, suggestions, and delegation to these
focused services.

On the frontend, `useSaplingImportTemplates` owns the selected template session,
race-safe loading, source/entity scope application, save/update selection, and
template-related capability state. The workspace supplies callbacks for applying
mapping configuration and loading entity metadata.

## AI Chat Import Agent

The AI Chat can expose an Import-Agent for CSV, TSV, and TXT files. The chat
upload endpoint stores the original file as a `DocumentItem`, analyzes it
through the same import parser, creates an `ImportBatchItem`, and links the
result to the chat with `AiChatAttachmentItem`.

The chat does not introduce a second import engine. It uses the existing batch,
template, validation, and execution services:

- uploaded files become auditable import batches
- the agent receives only a compact file summary in chat context
- `import_get_batch` can inspect the batch when more detail is needed
- `import_list_templates` and `import_suggest_mapping` prepare strategies
- `import_match_existing_records` checks sampled values against readable data
- `import_configure_batch` and `import_execute_batch` remain confirm-gated

The V1 upload surface is deliberately CSV-first. XLSX, multi-file imports, and
richer binary ingestion remain extension points.

## AI Suggestions

`POST /api/import/batches/:handle/suggest` builds a constrained prompt for the
configured/default chat provider. The request can pass the currently selected
target entity and source system because a freshly analyzed batch is not yet
validated and may not have those relations persisted.

The endpoint returns structured proposals for:

- CSV column to Sapling field mappings
- one or more recommended external key columns
- detected reference fields
- conservative value mapping candidates
- confidence and short reasoning per proposal

`ImportAiSuggestionService` owns AI context construction, provider execution,
reference candidates, and response normalization. Prompt construction remains a
pure module in `import-ai-suggestion.prompts.ts`; `ImportService` only validates
the batch/source/entity context and delegates the suggestion request.

`useSaplingImportAiSuggestions` owns the frontend suggestion request lifecycle,
field confidence metadata, validation against available headers and fields,
external-key application, value-mapping proposals, and reset behavior.

The import workspace delegates value-mapping dialog state, source-value caches,
reference hydration, and source-column usage helpers to
`useSaplingImportValueMappings`. `useSaplingImportMappingConfiguration` owns
mapping-state initialization, stored-configuration application, column/default
normalization, relation and unique-conflict strategies, and serialization back
to the import API shape. `useSaplingImportBatchSession` owns source/entity/template
selection synchronization, open-batch loading, state hydration, polling restart,
and cleanup when a tracked batch disappears. Validation/execution commands and
error-report creation are delegated to `useSaplingImportCommands`, which owns
their request lifecycle flags, tracking/polling restart, and notifications.
`useSaplingImportPresentation` owns preview/error rows, progress and execution
state, entity/field labels, and structured row-message translation.
`useSaplingImportConfigurationSession` composes mapping resets, template
application, external/generic key normalization, and save-payload construction.
`useSaplingImportEntityCatalog` owns available entities, selected metadata and
permissions, importable-field filtering, and selector filters/options. The
workspace is now a sub-600-line composition shell.

Default-value and value-mapping editors use edit semantics because they capture
configuration values rather than creating a target record directly. Create-only
helpers such as duplicate suggestions therefore stay out of the import workspace.
Single-line source-column and default-value controls share the same comfortable
height and top alignment across text, numeric, date, boolean, and reference
renderers.

The UI applies the proposal to the same editable mapping state used for manual
configuration. Users can correct fields, open the value mapping dialog, save
the result as an import template, and then validate the batch through the
normal import path.

## Extension Points

The current workflow is CSV-first and deliberately conservative. Future
extensions should add to the batch configuration shape instead of replacing it:

- XLSX parsing
- fuzzy reference matching
- multi-file imports
- staged imports with explicit publish/rollback behavior
- richer document binary ingestion

Keep the canonical record bridge in `ExternalRecordLinkItem` so repeated imports
remain generic and auditable.
