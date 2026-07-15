# Refactor Watchlist

This note tracks files that are healthy enough to leave as-is for now, but should be watched when nearby work happens. Prefer incremental extraction during feature work over broad refactors without a concrete change driver.

Last reviewed: 2026-07-15

## Source File Size Policy

- Application and test source files should stay at or below 600 physical lines.
- Crossing 600 lines triggers a responsibility review. Extract cohesive services,
  composables, components, types, or data modules; do not reduce the count with
  formatting tricks or arbitrary file slices.
- New files must remain below the limit. A touched oversized file should become
  smaller and receive an explicit next extraction when it cannot reach the limit
  safely in the same change.
- Generated catalogs such as `frontend/src/constants/mdi.icons.ts` and already
  executed migrations are tracked separately. They are not split merely to meet
  the application-source limit.

The refreshed 2026-07-15 inventory contains 35 TypeScript, JavaScript, and Vue
files above 600 lines under `backend/src` and `frontend/src`. Two are the
generated/immutable exceptions above, leaving 33 actionable source and test
files. The inventory is regenerated after each wave rather than inferred from
the previous count.

## Prioritized Refactoring Waves

1. Backend generic Swagger generation (`generic-entity-swagger.ts`, 985 lines):
   separate schema, route/operation, and reusable decorator construction.
2. Frontend table utilities (`saplingTableUtil.ts`, 968 lines): separate value
   projection/formatting from filter, sorting, and table-state helpers.
3. Backend message templates (`message-template.service.ts`, 937 lines):
   separate rendering/context construction from template lookup and persistence.
4. Frontend edit-dialog orchestration (`useSaplingDialogEdit.ts`, 921 lines):
   separate draft/field state from persistence and relation coordination.

## Resume Point

- No extraction is left half-finished. The Developer Playground wave is fully
  typechecked, linted, tested, built, inventoried, and documented.
- The next session can start with either priority 1 (backend) or priority 2
  (frontend) without depending on unverified Playground work.
- Form Config administration remains below the limit. Extract entity/scope
  selection only when that workflow changes.

## Keep An Eye On

| File                                                             | Why it is on the list                                                                | Next useful extraction                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `frontend/src/components/dvelop/SaplingDvelopCloudWorkspace.vue` | The 858-line workflow still combines connection state, import controls, and results. | Extract connection/import panels when d.velop UI work next touches the page. |

## Rule Of Thumb

- File length identifies candidates; responsibility boundaries determine the
  extraction.
- Prefer one behavior-preserving extraction at a time for high-risk workflows.
- Keep typechecks and focused tests close to each extraction.

## Completed First Wave

- `backend/src/api/form-config/form-config.service.ts`: extracted stateless JSON
  validation and normalization into `FormConfigValidationService`; the
  persistence/orchestration service is now below 600 lines.
- `frontend/src/components/dialog/SaplingDialogEdit.vue`: extracted relation-tab
  navigation and reusable dialog keyboard shortcuts; the main component is now
  below 600 lines.

## Completed Second Wave

- `backend/src/api/import/import.service.ts`: extracted AI context construction,
  provider execution, reference candidates, and response normalization into
  `ImportAiSuggestionService`, with prompt construction in a pure module. The
  orchestrator decreased from 3,014 to about 2,470 lines; the extracted files
  remain below 600 lines.
- `frontend/src/components/import/SaplingImportWorkspace.vue`: extracted value
  mapping dialog state, source-value caching, reference hydration, and column
  usage helpers into `useSaplingImportValueMappings`. The workspace decreased
  from 1,846 to about 1,580 lines.

## Completed Third Wave

- `backend/src/api/import/import.service.ts`: extracted template filtering,
  persistence, conflict handling, sequence maintenance, and persisted value
  mappings into `ImportTemplateService`. The orchestrator decreased further to
  about 2,185 lines; the new service is about 354 lines.
- `frontend/src/components/import/SaplingImportWorkspace.vue`: extracted the
  selected-template session, race-safe loading, source/entity scope changes,
  save/update behavior, and template capability state into
  `useSaplingImportTemplates`. The workspace decreased further to about 1,460
  lines; the new composable is about 213 lines.

## Completed Fourth Wave

- `backend/src/api/import/import.service.ts`: extracted search-field selection,
  candidate loading, confidence scoring, and row recommendations into
  `ImportMatchingService`. The orchestrator decreased further to about 1,895
  lines; the new matching service is about 361 lines.
- `frontend/src/components/import/SaplingImportWorkspace.vue`: extracted AI
  request state, validated suggestion application, field-confidence metadata,
  external keys, value proposals, and reset behavior into
  `useSaplingImportAiSuggestions`. The workspace decreased further to about
  1,399 lines; the new composable is about 133 lines.

## Completed Fifth Wave

- `backend/src/api/import/import.service.ts`: extracted field defaults,
  current-person defaults, primitive date/boolean checks, required-field
  discovery, and validation messages into `ImportFieldValidationService`. The
  orchestrator decreased further to 1,757 lines; the new service is 180 lines.
- `frontend/src/components/import/SaplingImportWorkspace.vue`: extracted
  mapping initialization, stored-configuration application, normalization,
  relation/value/unique strategy builders, and configuration merging into
  `useSaplingImportMappingConfiguration`. The workspace decreased further to
  1,028 lines; the new composable is 447 lines.

## Completed Sixth Wave

- `backend/src/api/import/import.service.ts`: extracted queued row execution,
  create/update/skip/failure transitions, execution counters, and external-link
  upserts into `ImportExecutionService`. The orchestrator decreased further to
  1,651 lines; the new service is 270 lines.
- `frontend/src/components/import/SaplingImportWorkspace.vue`: extracted
  selector synchronization, open-batch loading, scope/template hydration,
  mapping restoration, polling restart, and missing-batch cleanup into
  `useSaplingImportBatchSession`. The workspace decreased further to 907 lines;
  the new composable is 208 lines.

## Completed Seventh Wave

- `backend/src/api/import/import.service.ts`: extracted source/value mapping,
  payload normalization, relation modes, generic references, metadata value
  lookup, and external-reference resolution into `ImportPayloadService` and
  `ImportReferenceResolverService`. The orchestrator decreased further to 1,296
  lines; the new services are 159 and 276 lines.
- `frontend/src/components/import/SaplingImportWorkspace.vue`: extracted file
  analysis, validation configuration, execution requests, error-report download,
  lifecycle flags, polling/tracking restart, and notifications into
  `useSaplingImportCommands`. The workspace decreased further to 840 lines; the
  new composable is 146 lines.

## Completed Eighth Wave

- `backend/src/api/import/import.service.ts`: extracted unique-field
  eligibility, database/in-batch conflict checks, append-key strategies, and
  conflict messages into `ImportUniqueConflictService`; batch/result/row DTO
  projection moved into `ImportBatchPresenterService`. The orchestrator
  decreased further to 1,010 lines; the new services are 213 and 92 lines.
- `frontend/src/components/import/SaplingImportWorkspace.vue`: extracted all
  preview/progress/message projection into `useSaplingImportPresentation`,
  mapping/template payload composition into
  `useSaplingImportConfigurationSession`, and entity metadata/options into
  `useSaplingImportEntityCatalog`. The workspace is now below the policy limit
  at 584 lines; the new composables are 250, 117, and 101 lines.
- Registered `FormConfigValidationService` with the Form Config provider owner.
  The initially introduced `CurrentModule <-> FormConfigModule` import edge was
  replaced by the cycle-free core-module boundary documented in the thirteenth
  wave below.

## Completed Ninth Wave

- `backend/src/api/import/import.service.ts`: extracted batch summaries, error
  rows, source-value queries, open-batch lists, and canonical batch lookup into
  `ImportBatchQueryService`; extracted the queued validation worker, request
  context, permission-aware user loading, planned actions, row transitions, and
  validation failure state into `ImportValidationService`.
- The stable controller/AI facade now delegates those workflows and is below the
  policy limit at 527 lines. The new query and validation services are 151 and
  397 lines, with focused regression tests for capped source-value queries,
  import-user permission hydration, and deleted/failed batch handling.

## Completed Tenth Wave

- `frontend/src/composables/event/useSaplingEvent.ts`: extracted timed-event
  pointer state, draft creation, move/resize calculations, readonly guards,
  forced dirty fields, synthetic click suppression, cancellation, drag colors,
  and rollback snapshots into `useSaplingCalendarDrag`.
- The calendar orchestrator decreased from 2,135 to 1,908 lines. The new
  reusable composable is 262 lines and has focused gesture tests for persisted
  moves, pure clicks, clean draft creation, participant initialization, snapshot
  rollback, and cancelled resize behavior. Context-menu and loading/presentation
  extraction remain the next calendar waves.

## Completed Eleventh Wave

- `frontend/src/composables/event/useSaplingEvent.ts`: extracted context-menu
  positioning and item projection, entity permissions, script-button loading
  and execution, record copying, navigation, timeline/change-log, mail,
  document/upload, and information actions into
  `useSaplingEventContextMenu`.
- The calendar orchestrator decreased from 1,908 to 1,570 lines. The new
  context-menu composable is 390 lines and keeps event loading and calendar
  refresh behind callbacks. Focused tests cover persisted-item hydration and
  positioning, unique-field-safe copies, permission-gated information, and the
  removal of edit/show/delete actions from the calendar menu.

## Completed Twelfth Wave

- `frontend/src/composables/event/useSaplingEvent.ts`: extracted visible-range,
  person, holiday, recurrence, and persisted-record reads into
  `useSaplingEventData`; labels, agenda, hero stats, people/holiday projection,
  and side-by-side drafts into `useSaplingEventPresentation`.
- Date navigation, logical day/week/month shifts, current-time scrolling,
  timeout cleanup, and work-hour overlays moved into
  `useSaplingCalendarNavigation`. Editor hydration, create/update persistence,
  participant references, route opening, drag rollback, local replacement, and
  update-conflict reload/merge moved into `useSaplingEventEditor`.
- The calendar orchestrator is now below the policy limit at 526 lines. The new
  data, navigation, presentation, and editor composables are 177, 224, 337, and
  382 lines. Seven focused calendar suites cover 24 tests across all extracted
  interaction, context-menu, data, presentation, navigation, and editor layers.

## Completed Thirteenth Wave

- `backend/src/api/generic/generic.service.ts`: extracted permission-filtered
  timeline record loading, descriptor dataset queries, cursor paging, and
  response composition into `GenericTimelineQueryService`. The facade decreased
  to 1,430 lines; the new query service is 204 lines and the existing focused
  multi-month dataset test continues to exercise the delegated workflow.
- `frontend/src/composables/table/useSaplingTableActions.ts`: extracted
  race-safe favorite loading, dialog defaults, persisted table state, route
  matching, and navigation into `useSaplingTableFavorites`. The action
  orchestrator decreased to 1,001 lines; the reusable composable is 209 lines
  with focused loading, active-route, persistence, and navigation tests.
- Fixed the Form Config DI regressions without duplicate providers or circular
  feature-module imports. `FormConfigCoreModule` now owns
  `FormConfigService` and `FormConfigValidationService`; `CurrentModule`
  imports only that provider module, while the HTTP-facing `FormConfigModule`
  imports `CurrentModule` one-way for permission checks.

## Completed Fourteenth Wave

- `backend/src/api/generic/generic.service.ts`: extracted the shared generic
  list/export query pipeline into `GenericListQueryService`, including custom
  field filters, query normalization, populate/field projection, after-read
  hooks, sanitizing, hydration, execution metadata, and export-limit handling.
  The facade decreased from 1,430 to 1,287 lines; the new service is 215 lines
  with three focused list/export tests, while the full GenericService suite
  remains green.
- `frontend/src/composables/table/useSaplingTableActions.ts`: extracted JSON/CSV
  transfer commands into `useSaplingTableTransferActions`, bounded single/bulk
  deletion into `useSaplingTableDeleteActions`, script-button loading/execution
  into `useSaplingTableScripts`, and context-menu/side actions into
  `useSaplingTableContextActions`.
- The table action facade is now below the policy limit at 483 lines. The four
  new reusable composables are 198, 128, 159, and 245 lines. Together with the
  favorites composable, five focused suites cover 12 table-action tests.

## Completed Fifteenth Wave

- `backend/src/api/generic/generic.service.ts`: extracted relation add/delete
  lifecycle and owning-side `afterUpdate` hooks into
  `GenericRelationMutationService`; inline 1:m payload extraction and
  update/create/delete synchronization moved into
  `GenericInlineCollectionService`.
- The complete create/update/delete lifecycle, including concurrency handling,
  scripts, reference validation, custom fields, change logs, open-task events,
  and mail automation, moved into `GenericEntityMutationService`. The public
  GenericService facade decreased from 1,287 to 499 lines. The new services are
  267, 218, and 488 lines; 37 focused/full Generic tests remain green.
- `frontend/src/components/system/SaplingFormConfigAdmin.vue`: moved validated
  JSON import/export into `useSaplingFormConfigTransfer`, draft payload and
  preview-template projection into pure utilities, and static editor options
  into a reusable data module. The component decreased from 699 to 583 lines;
  the extracted modules are 85, 73, and 32 lines with five focused tests.

## Completed Sixteenth Wave

- `backend/src/api/generic/generic-timeline.service.ts`: separated registry and
  relation descriptor discovery, date-window/filter handling, and response
  projection into `GenericTimelineDescriptorService`,
  `GenericTimelineDateService`, and `GenericTimelineProjectionService`, with
  shared contracts in `generic-timeline.types.ts`. The public facade decreased
  from 968 to 125 lines; the extracted modules are 142, 241, 434, and 50 lines.
- `backend/src/api/generic/generic.service.spec.ts`: replaced the 3,240-line
  monolithic suite with a 234-line shared fixture module and eight focused
  read, update, conflict, change-log, reference, mutation, relation, and
  timeline suites between 201 and 548 lines. All 31 preserved tests pass after
  removing the original suite; the backend typecheck, production build, and
  focused ESLint are also clean. A production bootstrap smoke test remained
  alive without reproducing the Form Config dependency/module exceptions.

## Completed Seventeenth Wave

- `frontend/src/entity/entity.ts`: replaced the 2,256-line declaration module
  with an eight-line compatibility barrel and domain-oriented base, platform,
  customer/CRM, calendar, account/communication, service/knowledge,
  integration, and AI/MCP type modules. The new modules range from 8 to 452
  lines, use type-only cross-domain dependencies, and preserve all 88 public
  interface/class exports exactly.
- `frontend/src/utils/eventRecurrence.ts`: extracted the reusable recurrence
  input, parsed-rule, weekday, frequency, end-mode, and calendar-occurrence
  contracts into `eventRecurrence.types.ts`. The implementation decreased from
  608 to 590 lines and keeps its existing public type exports for compatibility;
  the new contract module is 35 lines.
- The frontend typecheck, focused ESLint, production build, and all six focused
  recurrence tests are green. The refreshed inventory now contains 50
  actionable files above the policy limit.

## Completed Eighteenth Wave

- `backend/src/api/ai/ai.service.ts`: separated agent context, workbench,
  shared chat persistence/ownership, session lifecycle, message lifecycle,
  attachment/transcription/speech media, confirm-first tool actions, and
  streaming orchestration into eight focused Nest services. The stable public
  facade decreased from 2,751 to 405 lines; the extracted services range from
  179 to 536 lines and preserve constructor defaults for direct unit-test use.
- `backend/src/api/ai/ai.service.spec.ts`: replaced the 915-line monolithic
  suite with a 151-line shared fixture module plus focused runtime/navigation
  and tool-action suites of 538 and 266 lines. All 21 original tests remain in
  the new suites.
- The backend typecheck, focused ESLint, production build, all seven AI-folder
  suites (51 tests), and a Nest bootstrap smoke test are clean. The bootstrap
  initialized `AiModule` and mapped AI routes successfully before reporting
  the already occupied development port 3000.

## Completed Nineteenth Wave

- `backend/src/api/ai/sapling-mcp.service.ts`: separated argument and payload
  normalization, metadata/schema discovery, generic CRUD and timelines,
  semantic/ticket/knowledge search, import workflows, tool dispatch/result
  formatting, and HTTP MCP sessions into focused Nest services. The stable
  facade decreased from 1,759 to 108 lines; the new services range from 199 to
  360 lines and preserve the existing public contract and direct-test defaults.
- `backend/src/api/ai/sapling-mcp-tool-definitions.ts`: replaced the 724-line
  catalog with a 13-line compatibility aggregator, an 8-line shared contract,
  and catalog, search, import, and mutation definition modules of 225, 144,
  270, and 100 lines.
- `backend/src/api/ai/sapling-mcp.service.spec.ts`: replaced the 1,189-line
  suite with a 99-line fixture module and metadata/security, generic CRUD, and
  search/import suites of 330, 519, and 257 lines. All 18 preserved MCP tests
  pass without testing private implementation methods.
- Backend typecheck, focused ESLint, production build, all nine AI-folder
  suites (51 tests), and the Nest bootstrap smoke test are clean. The bootstrap
  initialized `FormConfigCoreModule`, `FormConfigModule`, `CurrentModule`, and
  `AiModule`, mapped the MCP routes, and stopped only because development port
  3000 was already occupied. The refreshed inventory decreased from 50/48 to
  47 total / 45 actionable files above 600 physical lines.

## Completed Twentieth Wave

- `backend/src/api/ai/ai-vector.service.ts`: separated entity-specific source
  document construction, pure section-content/metadata projection, batched
  provider embeddings, transactional index reconciliation, and
  permission-filtered semantic search into focused services and utilities.
  The stable `AiVectorService` facade decreased from 1,242 to 36 lines; the new
  implementation files range from 42 to 469 lines.
- Added direct public regression coverage for unchanged/updated/new/obsolete
  index documents, embedding deltas, unindexed search, grouped similarity
  matches, and filtering through `GenericService` permissions. The two focused
  suites are 155 and 162 lines with three tests.
- Backend typecheck, focused ESLint, production build, all eleven AI-folder
  suites (54 tests), and the Nest bootstrap smoke test are clean. `AiModule`
  initialized with the new Vectorization providers, mapped the vectorization
  routes, and stopped only at the already occupied development port 3000. The
  refreshed inventory is now 46 total / 44 actionable files above 600 physical
  lines.

## Completed Twenty-First Wave

- `frontend/src/components/system/SaplingAiChat.vue`: extracted runtime and
  provider/model/agent selection, session paging and persistence, import
  attachments, and message streaming/tool-action handling into reusable
  composables. The shell decreased from 1,312 to 548 lines; the four new
  lifecycle composables are 287, 181, 70, and 269 lines.
- `SaplingAiChatMessageList.vue`: moved confirm-first tool-action rendering and
  its technical-details dialog into the reusable 415-line
  `SaplingAiChatToolActions.vue`. Pure navigation/result extraction and router
  presentation live in 153- and 62-line modules. The message list decreased
  from 1,104 to 343 lines.
- Added five public regression tests for pending-action navigation suppression,
  visible/primary link projection, nested mutation-result links, streaming
  runtime/context payloads, attachment cleanup, and confirmed follow-up tool
  actions. Frontend typecheck, focused ESLint, all 76 Vitest files (259 tests),
  and the production build are green.
- The refreshed physical inventory is now 44 files above 600 lines in total,
  including the two generated/immutable exceptions, leaving 42 actionable
  files. The 50-to-44 change counts six oversized source files; the additional
  changed files are extracted collaborators, tests, module wiring, and docs,
  not extra entries removed from the oversized-file inventory.

## Completed Twenty-Second Wave

- `backend/src/api/mail/mail.service.ts`: separated template rendering,
  provider session/sender resolution, provider transport, and follow-up event
  persistence into four focused Nest services. The stable controller,
  processor, and inbound-sync facade decreased from 1,294 to 279 lines; its
  collaborators are 80, 379, 243, and 217 lines.
- `backend/src/api/mail/mail.service.spec.ts`: replaced the 844-line suite with
  facade, provider-session, and provider-transport suites of 226, 186, and 158
  lines. All 12 preserved behaviors now test public responsibility boundaries
  instead of patching private methods on the facade.
- Backend typecheck, focused ESLint, all six Mail-folder suites (44 tests), and
  the production build are clean. The built Nest application remained running
  through the bounded bootstrap smoke-test window, confirming that the new
  providers resolve successfully.
- The refreshed physical inventory is now 42 files above 600 lines in total.
  After excluding the generated icon catalog and executed migration, 40
  actionable source and test files remain. This wave removed exactly the two
  oversized Mail files from the inventory.

## Completed Twenty-Third Wave

- `backend/src/api/mail/email-inbox-sync.service.ts`: separated the complete AI
  message-processing lifecycle into `EmailInboxProcessingService`, including
  agent execution, the bounded repair turn, mutation validation and
  confirmation, customer binding, target linking, and failure handling.
- Prompt construction, status/log helpers, deterministic action defaults, and
  shared relation/value normalization moved into
  `email-inbox-sync.utils.ts`. The stable scheduler/import/retry facade keeps
  its public API and delegates processing through the registered Nest provider.
- The original service decreased from 1,136 to 532 physical lines. The new
  processing service and utility module are 338 and 339 lines. Backend
  typecheck, the 28 focused inbox/provider tests, and the production backend
  build are green.
- The refreshed inventory is now 41 files above 600 lines in total, including
  the two generated/immutable exceptions, leaving 39 actionable files. The
  remaining 1,063-line inbox synchronization suite is the next focused Mail
  extraction.

## Completed Twenty-Fourth Wave

- `backend/src/api/mail/email-inbox-sync.service.spec.ts`: replaced the
  1,063-line mixed-responsibility suite with a 422-line scheduler/import/retry
  suite, a 263-line direct `EmailInboxProcessingService` suite, and a 224-line
  utility-contract suite.
- A reusable processing harness now owns the shared AI message, subscription,
  action, entity-manager, and provider setup. All 26 original inbox cases plus
  the two provider cases remain green across four focused suites.
- Backend typecheck and focused ESLint are clean. The refreshed physical
  inventory is now 40 files above 600 lines in total, including the two
  generated/immutable exceptions, leaving 38 actionable files.

## Completed Twenty-Fifth Wave

- `backend/src/api/document/dvelop-configuration.service.ts`: separated Cloud
  HTTP/authentication and endpoint fallback into `DvelopCloudClientService`,
  payload traversal and metadata normalization into
  `DvelopCloudMetadataService`, and repository/category/property persistence
  into `DvelopConfigurationImportService`.
- Public DTO and health contracts now live in
  `dvelop-configuration.types.ts`. The stable configuration facade owns only
  sync selection, orchestration, connection lookup, and capability reporting;
  direct construction remains available for focused tests while Nest uses the
  registered collaborators.
- The original service decreased from 1,186 to 318 physical lines. Client,
  metadata, import, and types modules are 173, 461, 219, and 82 lines. Backend
  typecheck, focused ESLint, all three Document-folder suites (16 tests), and
  the production backend build are green.
- The refreshed inventory is now 39 files above 600 lines in total, including
  the two generated/immutable exceptions, leaving 37 actionable files.

## Completed Twenty-Sixth Wave

- `frontend/src/components/crm/SaplingCrmWorkspace.vue`: extracted sales,
  account, customer-success, and signal presentation into four reusable panel
  components. The route component now owns only page composition and decreased
  from 1,097 to 167 physical lines.
- CRM entity/view contracts and pure relation, amount, probability, date,
  opportunity, customer, and urgency rules moved into focused type and utility
  modules. Data loading lives in `useSaplingCrmWorkspaceData`; filtering,
  projections, metrics, navigation, and lifecycle orchestration live in
  `useSaplingCrmWorkspace`.
- The extracted panels are 38-59 lines, the data composable is 118 lines, and
  the presentation composable is 530 lines. Six focused utility tests cover
  relation normalization, open opportunity rules, customer/value semantics,
  numeric bounds, contact dates, and urgency.
- Frontend typecheck, focused ESLint, the utility suite, and the production
  frontend build are green. The refreshed inventory is now 38 files above 600
  lines in total, including the two generated/immutable exceptions, leaving 36
  actionable files.

## Completed Twenty-Seventh Wave

- `frontend/src/views/AiAgentBuilderView.vue`: extracted profile/prompt/data,
  tool/runtime/release configuration into `AiAgentConfigurationPanels` and
  versioning, test runs, memory/playbooks, evaluations, usage, and run traces
  into `AiAgentWorkbenchPanels`. The route now owns only page composition,
  agent selection, tabs, and save/reset actions and decreased from 926 to 198
  physical lines.
- Builder draft/evaluation contracts and pure conversion, trimming, relation,
  role, and selection helpers moved into `aiAgentBuilder.types.ts` and
  `aiAgentBuilder.utils.ts`. API loading, reference catalogs, selection state,
  save/version/test/evaluation commands, and workbench lifecycle moved into the
  321-line `useAiAgentBuilder` composable.
- The configuration and workbench panels are 164 and 263 lines; utility/type
  modules are 134 and 35 lines. Four focused mapper tests plus the existing
  translation-fallback audit cover seven cases.
- Frontend typecheck, focused ESLint, focused tests, and the production build
  are green. The refreshed inventory is now 37 files above 600 lines in total,
  including the two generated/immutable exceptions, leaving 35 actionable
  files.

## Completed Twenty-Eighth Wave

- `frontend/src/components/kanban/SaplingKanbanBoard.vue`: extracted reusable
  column/card/drop-preview presentation into `SaplingKanbanColumns`, complete
  drag-image and drop state into `useSaplingKanbanDrag`, and data loading,
  metadata projection, filters, formatting, mutations, and edit-dialog
  lifecycle into `useSaplingKanbanBoard`.
- Shared board props/dialog contracts and pure ordering, scope, color/icon,
  relation, filter, and fallback-display rules moved into focused type and
  utility modules. The public board component now owns only page composition,
  toolbar/filter placement, and collaborator wiring.
- The original component decreased from 1,009 to 232 physical lines. The
  column component is 118 lines, board and drag composables are 538 and 96
  lines, and type/utility modules are 15 and 70 lines.
- Eight focused utility/drag tests, frontend typecheck, focused ESLint, and the
  production build are green. The refreshed inventory is now 36 files above
  600 lines in total, including the two generated/immutable exceptions,
  leaving 34 actionable files.

## Completed Twenty-Ninth Wave

- `frontend/src/components/developer/SaplingPlayground.vue`: extracted the
  action/dialog showcase, field gallery, KPI gallery, and reusable content card
  into focused presentation components. The route component now owns only page
  composition, the generic table, and collaborator wiring and decreased from
  991 to 174 physical lines.
- Field demo state moved into `useSaplingPlaygroundFields`; KPI loading and the
  stable four-card projection moved into `useSaplingPlaygroundKpis`; action
  catalog, dialog launchers, feedback, and dialog lifecycle moved into
  `useSaplingPlaygroundShowcase`. Shared contracts and pure KPI/metric
  projection live in `playground.types.ts` and `playground.utils.ts`.
- The extracted field and showcase components are 235 and 216 lines; the KPI
  gallery and reusable card are 20 and 16 lines. The three composables are 41,
  48, and 337 lines, and all new source files remain below the policy limit.
- Three focused utility tests, frontend typecheck, focused ESLint, and the
  production build are green. The refreshed inventory is now 35 files above
  600 lines in total, including the two generated/immutable exceptions,
  leaving 33 actionable files.
