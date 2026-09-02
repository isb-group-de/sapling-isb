# Refactor Watchlist

This note tracks files that are healthy enough to leave as-is for now, but should be watched when nearby work happens. Prefer incremental extraction during feature work over broad refactors without a concrete change driver.

Last reviewed: 2026-09-02

## Current Quality-Gate Resume Point

The 2026-09-02 audit contains seven files above 600 physical lines, all explicit
exceptions: the generated MDI catalog, the already-executed baseline migration,
and the cohesive persisted schemas for `CompanyItem`, `PersonItem`,
`TicketItem`, `EventItem`, and `SalesOpportunityItem`. Zero actionable source or
test files remain above the threshold.

The final frontend wave separated monitoring tabs, dashboard layout and query
state, calendar workspace initialization/actions, mail-recipient and relation
editing, table projection/query/control/shell state, edit-dialog supplemental
tabs/presentation/focus management, and Customer-360 loading, activity, related
panels, and card presentation. Stable route components and public composable
entry points remain in place.

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

The 2026-07-16 baseline contained five files above the threshold. The current
inventory is recorded in the resume point above and is regenerated after each
wave rather than inferred from the previous count.

## Prioritized Refactoring Waves

No size-driven extraction is currently queued. Continue applying the 600-line
review during feature work and keep orchestration out of the documented schema
exceptions.

## Resume Point

- No extraction is left half-finished; the current audit has zero actionable
  oversized files.
- The seven remaining files are generated, immutable, or documented schema
  cohesion exceptions.
- Form Config administration remains below the limit. Extract entity/scope
  selection only when that workflow changes.

## Keep An Eye On

| File | Why it is on the list | Next useful extraction |
| --- | --- | --- |
| `backend/src/entity/CompanyItem.ts` | Explicit cohesion exception: all persisted/scalar/relation fields plus their ORM, Swagger, and dynamic-form metadata define one company schema. | Retain fields together; extract only future behavior or metadata genuinely reused by another model. |
| `backend/src/entity/PersonItem.ts` | Explicit cohesion exception: the declarative person/security/relation schema must remain inspectable as one ORM model. Its two password lifecycle methods enforce invariants on that model. | Move new orchestration out immediately; keep field decorators and password invariants colocated. |
| `backend/src/entity/TicketItem.ts` | Explicit cohesion exception: ticket workflow, SLA, assignment, relation, and UI metadata collectively define one persisted ticket schema. | Extract new behavior into services; do not scatter field declarations across mixins or inheritance solely for size. |
| `backend/src/entity/EventItem.ts` | Explicit cohesion exception: the calendar record's persisted fields, recurrence metadata, relations, and generated-form decorators form one inspectable ORM schema. | Keep orchestration in calendar services; split only reusable behavior, not field declarations. |
| `backend/src/entity/SalesOpportunityItem.ts` | Explicit cohesion exception: pipeline fields, forecast/stage relations, ownership, and generated-UI metadata define one persisted opportunity schema. | Extract workflow behavior into services and keep the declarative model intact. |

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

## Completed Thirtieth Wave

- `backend/src/swagger/generic-entity-swagger.ts`: separated OpenAPI contracts,
  entity example construction, generic operation patching, and Swagger UI
  synchronization into four focused modules. The stable public entry point is
  now 62 lines; the extracted modules range from 78 to 371 lines.
- `frontend/src/utils/saplingTableUtil.ts`: separated template/header
  projection, filter/order construction, and entity/reference value projection
  into three reusable utility modules. The compatibility barrel is now three
  lines; the extracted modules are 378, 362, and 94 lines.
- The focused Swagger suite (3 tests), table utility suite (18 tests), backend
  and frontend typechecks, formatting, and diff checks are green. The refreshed
  inventory is now 34 files above 600 lines in total, including the two
  generated/immutable exceptions, leaving 32 actionable files.

## Completed Thirty-First Wave

- `backend/src/api/template/message-template.service.ts`: separated Markdown
  rendering/plain-text conversion, cached template metadata traversal, and
  placeholder/context rendering into focused collaborators behind the stable
  Nest service. The facade decreased from 937 to 116 lines; the new modules
  range from 23 to 372 lines.
- `frontend/src/composables/dialog/useSaplingDialogEdit.ts`: extracted template
  and form-config catalog state, translated grouping, lazy icon loading, and the
  complete save/reset/cancel state machine into two composables with shared
  contracts. The orchestrator decreased from 921 to 510 lines; the extracted
  modules are 208, 154, and 37 lines. Obsolete commented save logic was removed.
- The focused message-template suite (6 tests), edit-dialog suite (9 tests),
  backend and frontend typechecks, full production build, formatting, and diff
  checks are green. The refreshed inventory is now 32 files above 600 lines in
  total, including the two generated/immutable exceptions, leaving 30
  actionable files.

## Completed Thirty-Second Wave

- `backend/src/api/kpi/kpi.executor.ts`: extracted current/previous time-range
  calculation, sparkline bucket construction, point projection, date labels,
  and bucket SQL expressions into `KpiTimeframePlanner`. The database executor
  decreased from 930 to 558 lines; the planner is 370 lines.
- Added three focused planner tests for current/previous month ranges, rolling
  yearly month buckets, point projection, and unsupported combinations.
- `frontend/src/composables/table/useSaplingTableColumnFilter.ts`: extracted
  filter-state normalization, operator descriptions, dynamic-token labels, and
  relation lookup/filter construction into pure utilities with a separate
  public contract module. The composable decreased from 877 to 580 lines; the
  utility and type modules are 203 and 32 lines.
- The new KPI planner suite (3 tests), existing column-filter suite (4 tests),
  backend and frontend typechecks, full production build, formatting, and diff
  checks are green. The refreshed inventory is now 30 files above 600 lines in
  total, including the two generated/immutable exceptions, leaving 28
  actionable files.

## Completed Thirty-Third Wave

- `backend/src/auth/auth-provider-user-import.service.ts`: separated external
  Azure/Google directory access, mapping, token refresh, paging/search, and
  retry classification from Sapling person/role/company persistence. The
  import facade decreased from 921 to 292 lines; the injected directory service
  is 424 lines and pure mapping/error utilities are 181 lines.
- Provider import tests now target the persistence facade and directory retry
  boundary independently. All nine preserved tests pass without coupling the
  persistence service to private provider-client methods.
- `frontend/src/components/dvelop/SaplingDvelopCloudWorkspace.vue`: extracted
  connection/health/sync controls, metric cards, metadata tables, table headers,
  and empty rows into five reusable presentation components. Shared contracts
  and pure status/reference/date helpers moved into focused modules. The route
  workspace decreased from 858 to 488 lines; extracted files range from 11 to
  166 lines.
- Added three focused d.velop presentation utility tests. Backend and frontend
  typechecks, the full production build, formatting, and diff checks are green.
  The refreshed inventory is now 28 files above 600 lines in total, including
  the two generated/immutable exceptions, leaving 26 actionable files.

## Completed Thirty-Fourth Wave

- `backend/src/api/current/current.service.ts`: separated open-task queries and
  snapshot composition into `CurrentOpenTaskService`, and idempotent role-based
  dashboard/favorite provisioning into `CurrentStarterWorkspaceService`. The
  stable current-user/session/permission facade decreased from 886 to 560
  lines; the collaborators are 151 and 139 lines.
- `frontend/src/composables/table/useSaplingTable.ts`: separated form-config
  loading, selection, overlay state, and request scheduling into
  `useSaplingTableFormConfig`, and query-string parsing/replacement into
  `saplingTableRouteState.ts`. The table orchestrator decreased from 835 to 595
  lines; the new modules are 143 and 127 lines.
- The focused Current suite (3 tests), generic-table suite (12 tests), backend
  and frontend typechecks, and formatting are green. The refreshed inventory is
  now 26 files above 600 lines in total, including the two generated/immutable
  exceptions, leaving 24 actionable files.

## Completed Thirty-Fifth Wave

- `backend/src/api/ai/ai.controller.ts`: separated transcription/speech
  catalogs, audio transcription, import attachments, and generated message
  speech into `AiMediaController`; administrative workbench, runs, and
  evaluations moved into `AiAgentController`. All controllers retain the
  existing `api/ai` routes, authentication guard, and service boundaries. The
  original controller decreased from 852 to 505 lines; the new controllers are
  315 and 107 lines.
- `frontend/src/composables/table/useSaplingTableFilterHelpers.ts`: replaced the
  800-line mixed helper with a two-line compatibility barrel. Filter-state and
  column-template normalization, filter-tree traversal/pruning, and scalar,
  range, date, and relation-clause restoration now live in three focused
  modules of 112, 243, and 460 lines.
- The filter roundtrip suite (5 tests), backend and frontend typechecks, and the
  full production build are green. The refreshed inventory is now 24 files
  above 600 lines in total, including the two generated/immutable exceptions,
  leaving 22 actionable files.

## Completed Thirty-Sixth Wave

- `backend/src/auth/auth.controller.ts`: moved provider-directory imports,
  impersonation lifecycle, and personal API-token routes into the focused
  `AuthAdministrationController`. Public login/logout/passkey behavior remains
  in the original controller, whose constructor stays source-compatible for
  existing tests. The original decreased from 905 to 568 lines; the
  administrative controller is 370 lines.
- `frontend/src/composables/account/useSaplingPermission.ts`: extracted
  permission capability/state projection, record lookup/cloning, role-member
  updates, and mutation helpers into `saplingPermission.utils.ts`. The stateful
  permission workflow decreased from 797 to 598 lines; the utility module is
  235 lines.
- Added three direct utility tests for entity capabilities, nested role cloning,
  and membership updates. The existing Auth controller suite (17 tests), new
  utility suite (3 tests), backend/frontend typechecks, and full production
  build are green. The refreshed inventory is now 22 files above 600 lines in
  total, including the two generated/immutable exceptions, leaving 20
  actionable files.

## Completed Thirty-Seventh Wave

- `backend/src/api/generic/generic-custom-field.service.ts`: separated entity
  template construction into `generic-custom-field-template.factory.ts` and
  payload/value normalization, typed-column assignment, and extraction into
  `CustomFieldValueCodec`. Shared payload/template contracts moved into a small
  contract module. The persistence/filter facade decreased from 836 to 487
  lines; collaborators are 102, 274, and 4 lines.
- `frontend/src/composables/account/useSaplingAccount.ts`: extracted account
  contracts, date/calendar formatting, catalog option mapping, and handle
  normalization into `saplingAccount.utils.ts`. The composable decreased from
  697 to 580 lines; utilities are 145 lines.
- `frontend/src/components/account/SaplingAccount.vue`: extracted reusable
  active-session and Songbird preference panels. The composition shell
  decreased from 676 to 577 lines; panels are 71 and 128 lines.
- Custom-field regression coverage (8 tests), account/permission utility suites
  (6 tests), backend/frontend typechecks, and the full production build are
  green. The refreshed inventory is now 19 files above 600 lines in total,
  including the two generated/immutable exceptions, leaving 17 actionable
  files.

## Completed Thirty-Eighth Wave

- `backend/src/api/script/script.service.ts`: separated webhook, Teams, and
  inbox subscription lookup/delivery, recipient population, payload snapshots,
  and background scheduling into `ScriptSubscriptionService`. Lifecycle names
  moved into `script.types.ts` and remain re-exported by the stable facade. The
  script loader/runner decreased from 774 to 517 lines; collaborators are 289
  and 12 lines.
- `frontend/src/components/system/SaplingFormConfigAdmin.vue`: extracted the
  entity/config/scope settings toolbar into the reusable
  `SaplingFormConfigContextControls` component, and template-to-draft building,
  group creation/removal/reordering, field moves, visibility, and order
  normalization into pure utilities. The administration shell decreased from
  751 to 548 lines; collaborators are 120 and 174 lines.
- Added three draft utility regression tests; together with the existing draft
  suite, six focused cases are green. The Script suite (3 tests), backend and
  frontend typechecks, and full production build are green. The refreshed
  inventory is now 17 files above 600 lines in total, including the two
  generated/immutable exceptions, leaving 15 actionable files.

## Completed Thirty-Ninth Wave

- `backend/src/api/teams/teams.service.ts`: separated Microsoft Graph chat
  creation/message delivery, Azure token refresh, authentication-error retry,
  and delivery status persistence into `TeamsGraphDeliveryService`. The
  subscription/template facade decreased from 735 to 349 lines; the Graph
  delivery collaborator is 393 lines.
- Existing Teams tests now target the Graph delivery boundary directly. Both
  token-refresh and non-authentication failure cases remain green without
  patching private methods on the orchestration facade.
- `frontend/src/services/api.ai.service.ts`: extracted all public chat,
  attachment, transcription, vectorization, MCP, and agent workbench contracts
  into `api.ai.types.ts`, with compatibility re-exports from the stable service
  path. The HTTP client decreased from 731 to 571 lines; contracts are 193
  lines.
- Teams tests (2), backend/frontend typechecks, and the full production build
  are green. The refreshed inventory is now 15 files above 600 lines in total,
  including the two generated/immutable exceptions, leaving 13 actionable
  files.

## Completed Fortieth Wave

- Split the 813-line `useSaplingTable.test.ts` into a 267-line shared harness,
  a 251-line initialization/loading suite, and a 286-line route/filter suite.
  All 12 original scenarios remain intact.
- `useSaplingCommandPalette.ts`: extracted debounced, abortable global record
  search and entity-prefixed query parsing into
  `useSaplingCommandPaletteRecordSearch`. The palette decreased from 682 to 567
  lines; its collaborator is 110 lines.
- `useSaplingNavigation.ts`: extracted text normalization/search matching,
  group sorting, expansion toggles, parent/group resolution, route grouping,
  and entity ordering into `saplingNavigation.utils.ts`. The composable
  decreased from 649 to 566 lines; utilities are 81 lines.
- Added four navigation utility tests. Together with the split table suites,
  16 focused tests, the frontend typecheck, and the full production build are
  green. The refreshed inventory is now 12 files above 600 lines in total,
  including the two generated/immutable exceptions, leaving 10 actionable
  files.

## Completed Forty-First Wave

- `ai-entity-generation.service.ts`: extracted deterministic prompt assembly,
  response parsing, sensitive-value pruning, field mapping, and target payload
  construction into the focused `AiEntityGenerationPayloadBuilder`. The
  orchestration service decreased from 674 to 385 lines; its builder is 284
  lines, and the service constructor/API remained stable.
- `generic.controller.ts`: moved the admin-only parsed-row import route into
  `GenericImportController` while retaining the exact `api/generic/:entityHandle/import`
  route and guard stack. The generic CRUD/timeline controller decreased from
  642 to 592 lines; the import controller is 67 lines and is registered in the
  generic module.
- The AI generation and domain endpoint suites cover 35 passing tests, and the
  backend typecheck is green. The refreshed inventory is now 10 files above 600
  lines in total, including the two generated/immutable exceptions, leaving 8
  actionable files.

## Completed Forty-Second Wave

- Azure calendar delivery/import: extracted Graph response contracts,
  authentication-error classification, date/email/text normalization, and
  outbound event mapping into `azure-calendar.utils.ts`. The service decreased
  from 686 to 571 lines; the provider-specific utility module is 123 lines.
- Google calendar delivery/import: extracted the corresponding Google-specific
  normalization and outbound mapping into `google-calendar.utils.ts`. The
  service decreased from 612 to 533 lines; the utility module is 84 lines.
  Provider semantics remain separate instead of being hidden behind a leaky
  shared abstraction.
- Split the generic controller contract scenarios out of
  `domain-endpoints.spec.ts`: the remaining multi-domain suite is 464 lines and
  `generic.controller.spec.ts` is 190 lines, with all seven original generic
  scenarios preserved.
- Added four focused provider utility scenarios. Across the affected suites, 41
  tests and the backend typecheck are green. The refreshed inventory is now 7
  files above 600 lines in total, including two generated/immutable exceptions,
  leaving 5 files for extraction or explicit cohesion review.

## Completed Forty-Third Wave

- `entity.decorator.ts`: extracted its public metadata option and shape
  contracts into `entity-metadata.types.ts` while preserving compatibility
  re-exports. The runtime decorator module decreased from 654 to 580 lines; the
  type module is 99 lines. Fifteen focused decorator/template tests and the
  backend typecheck are green.
- `permission-matrices.ts`: extracted the distinct 348-line support-role dataset
  into `permission-matrix-support.ts` behind the existing named export. The
  remaining shared types/helper plus sales/customer/contractor matrices are 482
  lines; the support data module is 349 lines. The backend typecheck is green.
- Audited `CompanyItem` (760), `PersonItem` (751), and `TicketItem` (699). They
  are declarative persisted schemas with field-level ORM, API, and generated-UI
  metadata rather than mixed orchestration. Splitting their fields into mixins,
  fragments, or inherited classes would obscure the actual database model and
  decorator order, so all three are explicit logical-cohesion exceptions.
- The final inventory contains exactly five files above 600 lines: the generated
  icon catalog, one already-executed migration, and the three persisted-schema
  cohesion exceptions. Zero actionable source/test files remain above the
  policy threshold.
- The final full verification is green: backend 121 suites / 470 tests,
  frontend 89 files / 303 tests, both typechecks, the combined production build,
  and `git diff --check`. The full frontend audit also caught and removed a
  technical entity/field-handle fallback from the extracted Form Config preview.
