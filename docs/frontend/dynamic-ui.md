# Frontend Dynamic UI

Sapling's frontend renders much of the application from backend entity metadata. This allows new entities to appear in generic tables and dialogs without building one custom screen per entity.

## Main Files

```text
frontend/src/router/index.ts
frontend/src/views/TableView.vue
frontend/src/views/PartnerView.vue
frontend/src/views/FileView.vue
frontend/src/stores/genericStore.ts
frontend/src/stores/translationStore.ts
frontend/src/services/api.generic.service.ts
frontend/src/services/translation.service.ts
frontend/src/components/dialog/
frontend/src/components/dialog/SaplingDialogEditFieldRenderer.vue
frontend/src/composables/table/
frontend/src/composables/generic/
```

## Dynamic Routes

The router defines generic entity routes:

```text
/table/:entity
/partner/:entity
/file/:entity
/kanban/:entity
```

These routes use the entity handle from the URL and load data/templates/translations dynamically.
The Kanban route additionally requires entity template metadata from
`@SaplingKanban(...)`; it groups records by the configured status/stage relation
and updates that relation through the generic API when a card is moved.

The generic board keeps responsibilities separated: `SaplingKanbanBoard`
composes the page, filters, and edit dialog; `SaplingKanbanColumns` renders
reusable columns, cards, and drop previews; `useSaplingKanbanBoard` owns
metadata/data projection and persistence; `useSaplingKanbanDrag` owns the drag
image and drop lifecycle. Shared board contracts and pure ordering, scope,
relation, and display rules live in `kanbanBoard.types.ts` and
`kanbanBoard.utils.ts`.

Specialized views exist for workflows that are not pure CRUD:

```text
/event
/note
/permission
/form-config
/system
/playground
```

The CRM workspace follows the same composition rule for custom workflow views:
`SaplingCrmWorkspace.vue` assembles reusable sales, account,
customer-success, signal, list, and toolbar components. Generic CRM reads live
in `useSaplingCrmWorkspaceData`, while workspace projections and navigation
live in `useSaplingCrmWorkspace`. Shared CRM contracts and pure transformation
rules stay in `crmWorkspace.types.ts` and `crmWorkspace.utils.ts`, so panels do
not duplicate entity-shape or formatting assumptions. The toolbar separates
shared filters (search and responsibility) from cockpit-specific filters such
as opportunity close horizon, customer segment, and contact-gap threshold.
Cockpit counts and hero metrics are navigational summaries; health signals
switch to the relevant cockpit and leave record drilldown to the result lists.

The Developer Playground is also a composition shell. Its action/dialog
catalog is rendered by `SaplingPlaygroundShowcase`, field examples by
`SaplingPlaygroundFieldGallery`, KPI examples by
`SaplingPlaygroundKpiGallery`, and repeated demo surfaces by
`SaplingPlaygroundCard`. Field state, KPI loading, and showcase/dialog state
stay in separate developer composables. Shared Playground contracts and pure
KPI/metric projections live in `playground.types.ts` and
`playground.utils.ts`. Add new examples to the matching gallery or catalog
instead of rebuilding cards, KPI loading, or dialog feedback in the route
component.

## Data Sources

The dynamic UI depends on:

- generic records from `/api/generic/:entityHandle`
- entity templates from `/api/template/:entityHandle`
- translations from translation endpoints/store
- current user and permission metadata
- entity/navigation seed data

Authenticated templates include a per-field `fieldAccess` object with read,
create, and update flags plus effective stages. Completely inaccessible fields
are absent from normal templates. A write-only field remains in edit metadata
but is initialized empty and omitted from an update payload until the user
actually enters a new value.

## Generic Store And Services

Important files:

```text
frontend/src/services/api.generic.service.ts
frontend/src/stores/genericStore.ts
frontend/src/services/api.current.service.ts
frontend/src/services/api.template.service.ts
frontend/src/services/api.document.service.ts
frontend/src/services/api.error.service.ts
```

`genericStore` coordinates loading, caching, and state used by tables/dialogs. API services centralize request behavior and error handling.

Generic list requests have a maximum page size of `100`. Normal tables remain
server-paginated. Internal catalogs that must be complete, such as navigation,
permission matrices, command-palette entries, dashboards, calendar data, and
reference lookups, use `ApiGenericService.findAll()` so every response page is
loaded. Handle-based hydration uses `findByHandles()`, which batches handle
filters into groups of at most `100`. Do not implement complete catalog loading
with one `find()` call or a configured single-page limit.

## Translation Loading

Important files:

```text
frontend/src/stores/translationStore.ts
frontend/src/services/translation.service.ts
frontend/src/composables/generic/useTranslationLoader.ts
```

Components should load the namespaces they render.
`TranslationService` loads every matching generic API page through
`ApiGenericService.findAll()`. Keep the stable `handle` ordering from that
helper; unordered manual pagination can skip translation rows when a namespace
set spans multiple pages.

Examples:

```ts
useTranslationLoader("global", "ticket", "company");
```

Avoid hard-coded labels when translations exist.

## Template-Driven Field Rendering

The edit dialog uses `EntityTemplateDto` from the backend.

Main renderer:

```text
frontend/src/components/dialog/SaplingDialogEditFieldRenderer.vue
```

Selection examples:

| Backend metadata                                   | Frontend field             |
| -------------------------------------------------- | -------------------------- |
| relation field                                     | single-select reference    |
| `genericReference`                                 | generic reference selector |
| `inlineCollection.renderer === "conditionBuilder"` | inline condition builder   |
| `isMarkdown`                                       | markdown editor/preview    |
| `isMoney`                                          | money field                |
| `isPercent`                                        | percent field              |
| `isNumeric`                                        | numeric stepper            |
| `isPhone`                                          | phone field                |
| `isMail`                                           | mail field                 |
| `isLink`                                           | link field                 |
| `isColor`                                          | color picker               |
| `isIcon`                                           | icon picker                |
| `isSecurity`                                       | password/security field    |
| boolean type                                       | boolean field              |
| date/datetime type                                 | date/time field            |
| JSON type                                          | JSON field                 |

If a new field behavior is generally useful, add a Sapling option and renderer branch rather than special-casing one entity.

The shared icon picker renders `isIcon` fields as a searchable, paginated icon
grid. Keep icon-selection behavior in `SaplingFieldIcon.vue` so every dynamic
entity dialog receives the same visual picker.

Phone fields use the current person's company country when available. If that
country is missing, the frontend falls back to
`VITE_SAPLING_DEFAULT_PHONE_COUNTRY` / `VITE_SAPLING_DEFAULT_PHONE_DIALING_CODE`;
the backend uses the matching `SAPLING_DEFAULT_PHONE_*` variables for generic
API and import normalization.

Collection relations normally render as relation tabs after the parent record
exists. A backend field decorated with `@SaplingInlineCollection(...)` is the
exception: it stays in the main form and is saved as a structured child-entity
collection. The first implementation is the email-subscription condition
builder, which loads the selected source entity metadata and renders the
condition value editor according to the observed field type.

### Reference Field Components

Reference fields should use the existing Sapling field components instead of raw Vuetify selects:

| Use case                       | Component                                                            |
| ------------------------------ | -------------------------------------------------------------------- |
| one related record             | `frontend/src/components/dialog/fields/SaplingFieldSingleSelect.vue` |
| multiple related records       | `frontend/src/components/dialog/fields/SaplingFieldSelect.vue`       |
| select and add to a collection | `SaplingFieldSingleSelectAdd.vue` or `SaplingFieldSelectAdd.vue`     |

These components open a Sapling table inside the menu and derive display labels from the target entity's `isValue` templates. Do not guess label fields such as `title`, `name`, or `displayName` in custom code. If a selected reference value displays only its handle, the target entity metadata has not been loaded early enough; fix the field/component lifecycle so the metadata loads, then let `getEntityValueLabel()` use the templates.

When a source entity marks a many-to-one or one-to-one reference itself with
`isValue`, the shared single- and multi-select fields resolve the referenced
record through the target entity's own `isValue` metadata. Scalar values stay
on the first line and each value reference is displayed on a following line.
If an existing single-select value contains such a nested reference only as a
handle, the field hydrates that selected record for display without changing
the form model.
Generated table reference cells request the same nested value relations and
render them as a compact secondary line without increasing the normal row
height. Circular back-references to the current row reuse that already loaded
record instead of falling back to its handle.

The generic table search also includes scalar `isValue` fields of readable,
projected many-to-one and one-to-one references. Search terms may therefore
match a company's account manager or a person's company. This search stops at
the direct reference and does not follow nested value references.

Single-record references rendered inside `SaplingDialogEdit` also expose an
open-record action. It loads the complete referenced record and opens another
`SaplingDialogEdit` above the current dialog. The nested dialog uses edit mode
when the target entity grants update access and read-only mode otherwise.
Saving refreshes the selected reference object without changing its identity;
deleting the referenced record clears the field. The outer draft remains open
throughout the nested workflow.

When a custom workflow needs an initial selected reference, pass the full item when available and ensure the target entity metadata can load before the user opens the menu. The fallback to handles is intentional for unknown metadata and should not be hidden with hard-coded field-name guesses.

Static option lists should use `frontend/src/components/common/SaplingStaticSelect.vue`
instead of repeating raw `v-select` defaults in each feature component. Keep this
component for literal option arrays such as modes, intervals, providers already
loaded by a service, or display preferences. Do not use it for entity
references; entity relations should continue to use the Sapling reference field
components so labels, metadata, filtering, and table-menu behavior remain
consistent.

Active custom field definitions are appended to the same template metadata as
generated fields named `customFields.<fieldKey>`. The edit dialog renders the
supported primitive/select custom field types with the normal field renderer
pipeline and saves them back as a nested `customFields` payload. The definition
itself selects its type through the `customFieldType` reference entity, so users
choose from seeded type records instead of entering raw type strings. Generic
table rows receive flattened hydrated values for display.

## Field Permission UI

The role/entity permission matrix exposes a **Fields** action and the number of
restricted fields. Its detail dialog loads the atomic permission-admin catalog,
groups and searches static and custom fields, supports per-column all/none and
inheritance reset, and warns for primary, display, required, reference,
security, system, and read-only fields. Stale overrides are diagnosed rather
than treated as active fields.

All dynamic consumers use `fieldAccess`: desktop/mobile columns and filter
catalogs require read access; create/edit dialogs use the matching write action;
relation tabs become read-only without update access. Primary keys are not a
projection exception. If a saved route or favorite contains fields no longer
readable, only those clauses are removed from the active view and an
informational message is shown; the saved favorite itself remains unchanged.

Markdown fields can reference stored Sapling documents without new upload logic.
Use `sapling-document:<handle>` as a normal markdown link or image URL, or embed
media inline with `{{sapling-image:123|Screenshot}}`,
`{{sapling-audio:123|Audio note}}`, `{{sapling-video:123|Demo video}}`, or
`{{sapling-document:123|Open document}}`. The handle is the existing
`document` record handle and permissions are enforced by the document API.

## Tables

Table behavior is split across composables in:

```text
frontend/src/composables/table/
```

Table orchestration regression coverage is split into a shared harness plus
initialization/loading and route/filter suites; add scenarios to the matching
suite rather than rebuilding the harness.

Only route-level primary tables, including generic table and partner views,
synchronize their edit dialog with the `open` query parameter. Tables embedded
in relation tabs or selector menus keep their edit dialogs local, so opening a
related record does not replace the parent record encoded by `open`. The
calendar owns equivalent synchronization for its primary Event dialog.

Common responsibilities:

- loading pages
- filters
- column filters
- multi-select
- row actions
- chips
- upload behavior
- table component state

The shared table refresh action opens a menu with an immediate refresh and
temporary automatic refresh intervals of one, five, or ten minutes. Automatic
refresh belongs to the mounted table instance, pauses while the browser tab is
hidden or the table has an open create/edit dialog, refreshes once when a hidden
tab becomes visible again, and is discarded when the user leaves the page or
closes the containing dialog. Closing a create/edit dialog resumes the selected
interval from the beginning so an in-progress draft is never refreshed out
from under the user. While active, the toolbar button shows a compact,
tabular-numeric seconds countdown and the open menu shows the same remaining
time as a full localized label.

Table columns are driven by template metadata and translations.
Visible non-persistent read-only getters that mirror a direct reference field
follow the `<reference><TargetField>` naming convention, for example
`creatorPersonEmail` for `creatorPerson.email`. The table projection resolves
that dependency through readable reference metadata, requests only the nested
target field, and still renders the computed getter as the configured column.
Desktop headers expose drag handles only after the user starts **Edit view**
from the current-view menu. Reordering remains temporary and instance-local;
finishing editing keeps it for the current visit, while leaving the table or
changing its entity/view discards it. Route-level generic and partner tables can
open the column selection while editing. Its fixed-height drop area overlays the
lower-right table corner so it does not cover the headers, and its search field
filters every readable, table-capable entity field that is not currently
visible. Fields can be dragged from there onto an exact header position (or
appended with the plus action), while visible headers can be dragged back into
the drop area to hide them. At least one data column remains visible. Newly shown fields extend the
list projection immediately, so their values load without changing the active
form configuration. Route-level generic and partner tables can explicitly save
the resulting visibility and order while editing; the backend creates a named
person-scoped form configuration for the authenticated user and activates it.
Available table views are limited to global, matching role, and the current
person's scope. The effective default is marked with a star; users can promote
one of their own person-scoped views to their personal default, which takes
precedence over role and global defaults on subsequent table visits.
The saved overlay preserves the selected view's form/mobile settings while
replacing desktop `tableVisible` and `tableOrder` values.
Reference columns marked with `isChip` project readable `isColor` and `isIcon`
fields from the referenced entity in addition to its value fields. The shared
desktop and mobile chip renderer therefore receives the persisted appearance
metadata without loading full reference records.
`useSaplingTable` owns the entity lifecycle, paging, server loading, and event
coordination. Form-configuration catalog loading, selection, and overlay state
live in `useSaplingTableFormConfig`; parsing and replacing query-string state
live in `saplingTableRouteState.ts`. Keep new form-view and URL rules in those
focused modules instead of growing the table orchestrator.
Table page-size values from configuration, user events, and old URLs are clamped
to the generic API maximum of `100`.
Column-filter cloning/template normalization, filter-tree restoration, and
individual relation/range/date clause parsing live in the focused
`saplingTableColumnFilterState`, `saplingTableFilterRestore`, and
`saplingTableFilterClauseRestore` modules. The legacy helper path is a
compatibility barrel.
`SaplingForm` metadata carries explicit defaults for form, desktop table, and
mobile table rendering. Desktop columns use `tableVisible` and `tableOrder`.
Mobile table cards use separate `mobileVisible` and `mobileOrder` metadata.
The switch between desktop rows and mobile cards follows the browser viewport
width, not the width of the table's immediate container. Embedded tables
therefore keep the desktop row layout on desktop screens even when they appear
inside a narrow dialog or field menu.
The current entity convention sets `mobileVisible: true` only for fields marked
with `isValue`, but this is stored in the decorator and not inferred in the
frontend. Hiding a field from the desktop table does not automatically hide a
mobile-visible field.

### Table Onboarding Tutorial

The standalone `/table/:entity` workspace enables `SaplingTableTutorial.vue`.
It is intentionally not enabled for embedded tables or the table inside the
Partner workspace. Stable `data-tutorial` attributes identify toolbar actions,
the filter row, representative contact/reference cells, row actions, the record
dialog, and pagination; keep these hooks when restructuring the table UI.

The tutorial is remembered per browser by `useSaplingTutorial` and can be
forced independently from the command palette through
`feature-tutorial.service.ts`. The Add and row-action steps permit interaction
and advance only after the highlighted control is clicked. Optional targets are
skipped when permissions, table metadata, or an empty result set make them
unavailable.

### Selection Bulk Update

When at least one row is selected and update access is effective, the selection
action menu exposes **Change data**. The bulk-update dialog uses the complete
template catalog, independent of current form or table visibility, and filters
it to persistent writable scalar, custom-field, and readable many-to-one
reference values. Primary keys, auto-increment, read-only, system, security,
non-persistent, collection, inline-collection, one-to-one, and generic-reference
templates are excluded. Unique fields are always excluded because a shared
value would violate their uniqueness contract as soon as multiple records are
targeted.

Each draft field explicitly chooses **Set value** or **Clear value**. Clear is
available only for nullable/non-required fields and serializes to `null`;
`false`, `0`, and empty multi-select values remain valid set values. Dependent
references use the parent value from another field in the same draft for their
existing reference filter. The parent must be set before a dependent reference
can be set, while clearing the dependent reference needs no parent value.

`SaplingTemplateValueField.vue` is the neutral value-editor adapter shared by
bulk update and import strategies. It delegates rendering to
`SaplingDialogEditFieldRenderer`, resolves reference display values, and owns
boolean/date/time/API normalization plus the formatted value used in summaries.
After a successful bulk request the dialog closes, selection clears, and the
table reloads. An error retains both dialog draft and selection.

The Form Configuration administration groups form fields into draggable group
containers. Group order and visibility are persisted centrally in
`config.groups`; moving a field updates only its group membership and form
order. The effective-template and edit-dialog overlays apply the same group
rules, so the live preview and generated forms stay aligned.
Entity/config/scope selection is rendered by
`SaplingFormConfigContextControls`. Pure draft construction and group/field
reordering live in `formConfigAdminDraft.utils.ts`, keeping the administration
component focused on remote context, persistence, and composition.
Its preview keeps form, desktop-table, and mobile-table tabs mounted through
entity reloads, renders the configured form groups explicitly, and emphasizes
translated field names plus renderer types instead of fabricated sample data.
The administration uses a viewport-filling workspace without an outer page
scrollbar. The editor and preview are independent scrolling panels; editor
context controls scroll away while field search and group actions remain sticky.
The compact form preview is also the primary ordering surface: fields and
groups expose drag handles, render an insertion preview at the exact target,
and use proportional edge scrolling while a drag is active. Ordering is
available exclusively in that preview; the detailed editor remains focused on
visibility and field options. A hidden field can be shown temporarily when it
needs to be repositioned and hidden again afterward.

## Dialogs

Dialog files live under:

```text
frontend/src/components/dialog/
frontend/src/composables/dialog/
frontend/src/components/actions/
frontend/src/components/common/SaplingDialogShell.vue
frontend/src/components/dialog/SaplingDialogCard.vue
```

Dialogs use:

- template metadata for fields
- translation keys for labels
- generic API for create/update/delete
- reference metadata for relation selectors
- Sapling options for specialized fields

Custom dialogs should follow the shared shell pattern:

1. `v-dialog` with one of the size classes such as `sapling-dialog-small`, `sapling-dialog-medium`, or `sapling-dialog-large`.
2. `SaplingDialogCard` as the card surface.
3. `SaplingDialogShell` with `#hero`, `#body`, and `#actions` slots.
4. `SaplingDialogHero` for dialog title/stats/loading states when a hero is needed.
5. Framework scroll classes for constrained content: `sapling-dialog-fill-body`, `sapling-dialog-fill-content`, and `sapling-scrollable`.
6. Existing action components from `frontend/src/components/actions/` in the `#actions` slot.

Shared dialog body classes reserve the framework's floating-label clearance above their content.
Keep the first outlined field inside `sapling-dialog-form-body`,
`sapling-dialog-fill-body`, or `sapling-account-dialog__body`; do not add
feature-specific top padding to compensate for a clipped Vuetify field label.

Do not hand-roll dialog footers with ad hoc `<div class="sapling-dialog-actions">` blocks. Use the action components so spacing, mobile behavior, icons, and button ordering stay consistent:

| Dialog action pattern    | Component                                      |
| ------------------------ | ---------------------------------------------- |
| close only               | `SaplingActionClose`                           |
| cancel + save            | `SaplingActionSave`                            |
| account/preferences save | `SaplingActionAccount`                         |
| password change          | `SaplingActionChangePassword`                  |
| delete confirmation      | `SaplingActionDelete`                          |
| upload                   | `SaplingActionUpload`                          |
| custom action grouping   | `SaplingActionBar` with leading/trailing slots |

If none of the existing action components fit, add or extend an action component first and then use it from the dialog. This keeps footer behavior centralized instead of duplicating button layout in each custom dialog.

### Shared Tab And Dialog Navigation Contract

Horizontal tabs, vertical dialog navigation, and tab-like view switches use
the framework contract in `SaplingFrameworkTabs.css`. Feature classes such as
dashboard, note, permission, AI-agent, account, inbox, and record-dialog tabs
may add domain layout such as minimum label width, but they must not redefine
the shared height, gap, radius, selected fill, typography, or active inset.
Compact `v-btn-toggle` controls use `sapling-segmented-toggle`; only the shared
`--small` and `--field` modifiers may change their height to match a compact
helper row or a full-height form control.

Values that are only nearly equal are duplicates too. A two-pixel height or
radius difference, a small alpha/percentage variation, or a decimal-only color
change is not a separate design unless the state or constraint is documented.
Use the semantic tokens from `SaplingTokens.css` so desktop and responsive
variants keep the same visual rhythm. Constrained dialogs keep the hero and
action bar fixed while their body owns scrolling; compact dialogs use the same
viewport inset tokens as large and special dialogs.

## Context Menus And Script Buttons

Context and action components connect UI actions to generic records and backend script-button behavior.

Important areas:

```text
frontend/src/components/context/
frontend/src/components/actions/
frontend/src/services/api.script.service.ts
backend/src/script/
```

## Permissions In UI

Frontend permissions are loaded from current metadata and permission stores.
The permission administration composable owns loading, selection, save state,
and member mutations. Reusable permission-record projection, cloning, dirty
state inputs, and role-membership transformations live in
`saplingPermission.utils.ts`.

The account dialog follows the same composition boundary: `SaplingAccount.vue`
assembles account tabs, while active-session presentation and Songbird runtime
preferences live in reusable account panel components. Account formatting,
catalog options, and shared contracts live in `saplingAccount.utils.ts`; the
account composable owns remote loading and mutations.

Important files:

```text
frontend/src/stores/currentPermissionStore.ts
frontend/src/stores/currentPersonStore.ts
frontend/src/utils/entityAccess.ts
backend/src/api/current/
```

The frontend should hide or disable actions based on permissions, but backend guards remain authoritative.

## Message Center

API errors may provide a translation key plus `descriptionParams`. Entity
parameters use the stable `entityHandle`; the message center resolves them
through `navigation.<handle>` before interpolation. It loads the `global`,
`navigation`, `exception`, and `messageCenter` namespaces before rendering.

Missing translation keys and generic HTTP-client errors must not be shown as
user text. They fall back to localized generic wording while the original
payload remains available in the technical log export. Raw database table,
constraint, stack, and request details are diagnostic data only.

## Adding A Generic Entity To The UI

Usually no frontend route is needed.

Backend/seed requirements:

1. Entity registered in `ENTITY_REGISTRY`.
2. Entity seeded in `entityData_XXX.json`.
3. Route seeded in `entityRouteData_XXX.json`.
4. Navigation group exists.
5. Translations exist.
6. Permissions allow show/read for relevant roles.

`entityRoute.group` can override the entity's default navigation group for a
single route entry. Leave it empty to render the route under `entity.group`; set
it when the same entity route should appear in additional menu areas.

Frontend changes are needed only when:

- the entity needs a custom workflow view
- a new field option/renderer is required
- an existing table/dialog behavior does not support the desired relation or field type

For generic Kanban boards, seed an `entityRoute` such as
`kanban/ticket` and add `@SaplingKanban(...)` to the entity. The configured
`columnField` should point to a reference entity that exposes value, color, icon,
and optional open/closed metadata.

## Design Guidance

- Prefer metadata-driven behavior.
- Avoid one-off entity checks when a generic option would solve the problem.
- Keep translations loaded explicitly per feature.
- Keep fields responsive through template `formWidth`.
- Keep custom views for workflow-heavy features, not basic CRUD.
