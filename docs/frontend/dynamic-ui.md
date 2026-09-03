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

Generated forms also treat `isDateStart` and `isDateEnd` as a range contract.
Markers are paired within their declared form group and the dialog blocks save
when the end is before the start. The generic backend enforces the same rule for
non-UI clients; equal values and incomplete nullable ranges remain valid.
Changing a complete range's start in a writable generated form shifts the paired
end by the same delta, preserving the existing interval. An end before its start
is highlighted immediately on the paired end field.

Generated fields render contextual help through the shared
`SaplingHelpTooltip` control. The renderer first uses
`formConfig.helpText`; when it is empty, it checks the translation convention
`<entityHandle>.<fieldName>Tooltip` and then the shared fallback
`global.<fieldName>Tooltip`. Use the global fallback only for fields with
genuinely identical semantics across entities, such as `handle`, `sortOrder`,
`icon`, `color`, or `isActive`. The control opens on hover, keyboard focus, or
click/touch. Edit-dialog fields reserve a fixed, vertically centered help slot
even when no help text exists, so neighboring controls keep equal widths. A
reference selector places that slot between its dropdown and open-record action.
Generated desktop table headers and mobile card labels use the same resolution.
The Form Configuration administration can set `helpText` for
ordinary metadata fields, while custom-field definitions populate it from their
`tooltip` property.

The shared icon picker renders `isIcon` fields as a searchable, paginated icon
grid. Keep icon-selection behavior in `SaplingFieldIcon.vue` so every dynamic
entity dialog receives the same visual picker.

Fields marked with `isDuplicateCheck` remain normal writable inputs during
record creation. They show a persistent duplicate-check hint and mark their
result menu as a review list of possible duplicates. Selecting a result opens
the existing record; it is not required to complete the new value. The picker
searches only the field currently being entered and does not apply a table's
default open-status filter, so long titles stay within the generic API query
limit and closed records remain available as possible duplicates.

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

Relation tabs use translated business labels and entity icons only. Technical
ORM cardinalities such as `1:m` and `m:n` are intentionally not exposed as
visible, hover, or accessibility text.

### Reference Field Components

Reference fields should use the existing Sapling field components instead of raw Vuetify selects:

| Use case                       | Component                                                            |
| ------------------------------ | -------------------------------------------------------------------- |
| one related record             | `frontend/src/components/dialog/fields/SaplingFieldSingleSelect.vue` |
| multiple related records       | `frontend/src/components/dialog/fields/SaplingFieldSelect.vue`       |
| select and add to a collection | `SaplingFieldSingleSelectAdd.vue` or `SaplingFieldSelectAdd.vue`     |

These components open a Sapling table inside the menu and derive display labels from the target entity's `isValue` templates. Do not guess label fields such as `title`, `name`, or `displayName` in custom code. If a selected reference value displays only its handle, the target entity metadata has not been loaded early enough; fix the field/component lifecycle so the metadata loads, then let `getEntityValueLabel()` use the templates.
This also applies to database defaults that initially contain only a reference
handle: hydrate the selected item as soon as the entity metadata is available so
the closed field shows its configured value label before the dropdown is opened.

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

Unsaved edit-dialog values are also mirrored into a bounded browser-local draft
store. Recovery requires an exact match for the signed-in person, route, entity,
mode, record handle and version, plus parent context for create dialogs. The
same bounded store covers the supplemental internal-information editor and the
phone-call note. Only the latest draft per surface is retained; save, reset,
discard, duplicate selection, or an explicit close removes the matching draft.
Navigation or browser teardown leaves it available so reopening the exact same
context restores the values as normal dirty changes.

When a custom workflow needs an initial selected reference, pass the full item when available and ensure the target entity metadata can load before the user opens the menu. The fallback to handles is intentional for unknown metadata and should not be hidden with hard-coded field-name guesses.

Static option lists should use `frontend/src/components/common/SaplingStaticSelect.vue`
instead of repeating raw Vuetify select defaults in each feature component. The
shared component renders a searchable autocomplete while preserving the supplied
order for deliberately ordered values such as intervals or workflow modes.
Growing catalogs should also use searchable autocompletes and sort a copied
option array by its localized display label; `sortSelectOptions()` provides the
shared case-insensitive, natural ordering. Do not use static selects for entity
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
Their optional `tooltip` is included in the derived template as
`formConfig.helpText`, so custom and built-in fields share the same accessible
interaction and visual treatment.

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

Markdown fields can reference stored Sapling documents through the shared document API.
Use `sapling-document:<handle>` as a normal markdown link or image URL, or embed
media inline with `{{sapling-image:123|Screenshot}}`,
`{{sapling-audio:123|Audio note}}`, `{{sapling-video:123|Demo video}}`, or
`{{sapling-document:123|Open document}}`. The handle is the existing
`document` record handle and permissions are enforced by the document API.

For persisted records, the shared Markdown toolbar offers an inline image upload.
It stores selected images through the existing document API, links them to the
current record, and inserts `{{sapling-image:<handle>|<label>}}` at the cursor.
Multiple selected images keep their selection order. During record creation the
action remains disabled until the record has been saved once, because document
links require a stable record handle.

Pasting one or more clipboard images into an eligible Markdown editor follows
the same scoped upload path. The editor intercepts the paste only when image
files are present and the record already has a stable handle, uploads them in
clipboard order, and inserts their inline image embeds at the current cursor.
Text and non-image clipboard content retain the browser's normal paste behavior.

The Markdown toolbar is presented as a responsive work palette instead of one
undifferentiated action row. Actions are grouped and labeled as structure, text,
lists, insert, and code tools; upload and record-scoped image selection remain
together in the insert group. Those two document actions are added only when the
field receives an entity handle, and become enabled once a stable item handle is
available. Context-free editors such as the GitHub issue composer omit the actions
entirely without reserving toolbar space. GitHub's documented issue-creation API
has no attachment upload field, so Sapling does not offer clipboard images or
document uploads in this composer. The issue page explains that screenshots must
be added in GitHub and links directly to GitHub's new-issue form. Issues created
from Sapling include a sanitized backlink to the page from which the report action
was opened; automatic message-center reports capture their current page directly.

A neighboring toolbar action opens a searchable, multi-select image gallery for
documents already linked to the current record. The gallery uses the dedicated
`GET /api/document/referenced-images/:entityHandle/:reference` endpoint rather
than an unrestricted document list. The backend fixes both scope values from the
route, filters non-image documents, checks read access to the referenced entity,
and returns no internal storage paths. The UI therefore cannot accidentally
offer images attached to another record.
Selected images are inserted in the order in which the user selected them.
The picker owns and loads the `markdownImagePicker` translation namespace so
its title, privacy explanation, empty states, and actions do not depend on the
already cached global namespace. It renders dialog and action skeletons while
those translations are loading instead of briefly showing empty labels.

The shared Markdown editor also exposes `Mit AI aufbereiten` / `Refine with AI`.
It sends the current draft to the focused, non-persisting AI Markdown endpoint,
uses the user's preferred chat runtime when configured, and replaces the draft
only after the professionalized Markdown has returned. Saved runtime preferences
are validated against the current configured provider/model catalog; stale
preferences fall back to the configured default runtime. The transformation is
instructed to correct grammar, spelling, punctuation, and awkward wording and to
make unnecessarily emotional wording calm and professional. It preserves the
original language and document type, including email salutations, forms of
address, greetings, sign-offs, signatures, structure, order, and level of
detail, without adding, removing, shortening, or summarizing content.

Bounded Markdown properties use the entity template's `length` as their input
limit. The shared editor truncates typed, pasted, dictated, toolbar-generated,
and AI-prepared content at that limit and shows the remaining character count
inside the existing formatting toolbar. The generic mutation pipeline enforces
the same metadata length for direct API clients before persistence. Markdown
properties backed by an unbounded database `text` column intentionally do not
show a counter or receive an artificial frontend limit.

When an active transcription provider and model are configured, the editor also
shows `Diktieren und mit AI aufbereiten` / `Dictate and refine with AI`. It uses
the same microphone capture and silence detection as Songbird voice input,
appends the transcript to the current draft, and immediately runs the normal
Markdown preparation. The action is not rendered when no usable transcription
target is available. If preparation fails after a successful transcription,
the raw transcript remains in the draft so the recording is not lost.

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
Record actions that need form data, including copy from a row menu or context
menu, reload the complete record without the table projection before opening the
dialog. This keeps hidden scalar, long-text, Markdown, and custom-field values
available regardless of which table action entry point was used.
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
At mobile widths, the table toolbar reserves usable width for its search field.
Refresh, automatic refresh, worklists, the active/default view, and transfer
actions live in one nested overflow menu; only the optional entity-context
toggle, overflow button, and create button remain directly visible. Users can
continue to switch views, but current-view editing and its column editing
actions are omitted below the same small-window breakpoint. Mobile record
fields render as divider rows inside one card surface rather than as
rounded panels nested inside another rounded card.
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
entity reloads, renders the configured form groups explicitly, and shows only
translated group and field names instead of internal metadata or fabricated
sample data.
The administration uses a viewport-filling workspace without an outer page
scrollbar. The editor and preview are independent scrolling panels; editor
context controls scroll away while field search and group actions remain sticky.
The compact form preview is also the primary ordering surface: fields and
groups expose drag handles, render an insertion preview at the exact target,
and use proportional edge scrolling while a drag is active. Ordering is
available exclusively in that preview; the detailed editor remains focused on
visibility and field options. A hidden field can be shown temporarily when it
needs to be repositioned and hidden again afterward.

## Responsive Rhythm

Responsive breakpoints may change layout topology, such as stacking columns,
switching a table to mobile cards, or replacing action labels with accessible
icon buttons. They must not silently change the visual rhythm of the same
component. Shared control heights, panel padding, section gaps, radii, and
semantic type sizes stay token-based across viewport widths.

Avoid viewport-based `font-size` and spacing values for application chrome,
headings, counters, cards, and controls. In particular, do not use `vw`-driven
`clamp()` values for these elements: resizing the window must not continuously
grow or shrink them. A breakpoint-specific size is allowed only when the
component changes semantic density and the reason is documented with the
component contract.

`sapling-page-shell--uniform-inset` keeps the same uniform inset on desktop and
mobile. Responsive page and workspace rules may reflow content but should not
increase an inset or introduce an extra vertical gap at a narrower breakpoint.
Verify responsive changes immediately above and below every affected breakpoint
and at 360px, including horizontal-overflow checks.

The mobile command palette is a viewport-docked surface: it keeps the shared
viewport inset on the left, right, and bottom and starts below the application
header so the Songbird action never covers its search field. Dashboard hero
actions stay on one row at mobile widths and hide action labels while preserving
their accessible names. Starting dashboard layout editing is unavailable below
the mobile-table breakpoint; save and cancel remain available if a desktop edit
was already active when the viewport became narrow. Horizontally paged knowledge article previews and their
loading skeletons share the same fixed-height list viewport so page changes do
not move the reader or pagination controls.

Mobile density reductions keep the information itself available. Generic record
heroes hide the repeated timestamp prefixes while retaining the dates, and show
the selected form configuration as an icon-only chip. The complete timestamp and
view descriptions remain available through `title` and accessible names. Account
tabs and form-configuration hero actions follow the same icon-only contract on
phone widths. Inactive permission save/cancel actions are omitted until a draft
change exists. Monitoring keeps the active platform, version, and refresh state
visible while omitting architecture and server time from the compact phone
summary. Songbird uses a two-row composer and omits its desktop keyboard hint on
phones so message history retains the available height.

## Button Geometry

Button shape is semantic and independent from Vuetify's `text`, `tonal`,
`flat`, or `elevated` variants. Standalone text buttons and icon-only toolbar
or navigation actions use the shared 8px control radius by default. Use
`sapling-button--action` and `sapling-button--icon` when the role should be
explicit in component markup.

Reserve `sapling-button--round` for genuine floating actions and the compact
actions attached to a chat composer. Reserve `sapling-button--pill` for
identity controls such as the signed-in profile trigger. Avatars may remain
circular, while chips and status labels use the pill token through their own
component contract. Tabs and segmented button groups use the shared tab
geometry and must not be assigned standalone button-shape classes.

Do not derive geometry from color, fill, or the presence of an icon. In
particular, Vuetify's `icon` prop does not by itself make an action semantically
round in Sapling.

Icon actions attached directly to a form field use
`sapling-field-action-button`. This keeps reference-record, mapping, and future
field utilities on the same compact square geometry regardless of their
surrounding dialog or field height. Field actions align with the top edge of
their control, including beside multi-line reference values. Empty help
affordances must not reserve a second control-height row. When help text exists,
its action shares the field's row; otherwise the generated control uses the full
field-shell width. This compact field rhythm applies at every viewport width.

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

1. `SaplingDialog` with a semantic `size` from `xs` through `3xl`; use the smallest size that fits the workflow.
2. `SaplingDialogCard` as the card surface.
3. `SaplingDialogShell` with `#hero`, `#body`, and `#actions` slots.
4. `SaplingDialogHero` for dialog title/stats/loading states when a hero is needed.
5. Framework scroll classes for constrained content: `sapling-dialog-fill-body`, `sapling-dialog-fill-content`, and `sapling-scrollable`.
6. Existing action components from `frontend/src/components/actions/` in the `#actions` slot.

General-purpose form controls are framework components too. Use
`SaplingTextField`, `SaplingTextarea`, `SaplingAutocomplete`,
`SaplingCombobox`, `SaplingSwitch`, and `SaplingCheckbox` in application and
feature components. They centralize outlined geometry, comfortable density,
validation-detail spacing, and dropdown focus behavior. Metadata-driven
renderers such as `SaplingFieldSingleSelect` remain the higher-level choice for
entity references. Raw Vuetify controls belong only inside these shared
primitives; table boolean cells are the documented exception because they are
read/selection affordances rather than form fields. Songbird likewise keeps its
positioned `v-dialog` because it is a floating overlay rather than a standard
dialog card.

Shared dialog body classes reserve the framework's floating-label clearance above their content.
Keep the first outlined field inside `sapling-dialog-form-body`,
`sapling-dialog-fill-body`, or `sapling-account-dialog__body`; do not add
feature-specific top padding to compensate for a clipped Vuetify field label.
On mobile, standard Sapling dialogs share one viewport-docked shell: the surface
starts directly below the application header, touches the left, right, and
bottom viewport edges, keeps only its top corner radii, and owns the remaining
viewport height. Workflows that switch to a mobile dialog above the standard
phone breakpoint use the `docked` `SaplingDialog` option. Songbird follows the
same mobile geometry while retaining its positioned overlay implementation.
Field-permission editing is a documented exception to the desktop table layout:
small and medium viewports render grouped field cards with simultaneous read,
insert, and update controls. Column-wide all, none, and inheritance operations
remain available as accessible icon actions, avoiding horizontal scrolling.

Do not hand-roll dialog footers with ad hoc `<div class="sapling-dialog-actions">` blocks. Use the action components so spacing, mobile behavior, icons, and button ordering stay consistent:

`SaplingActionBar` measures its own footer width rather than relying only on
the viewport breakpoint. When the expanded action labels would wrap, every
eligible icon action in that footer keeps its accessible label but switches to
an icon-only visual presentation; action groups must remain on one line.
The unsaved-changes confirmation uses the standard `lg` width so its three
actions retain their labels on wide screens before that compact fallback applies.

| Dialog action pattern      | Component                                      |
| -------------------------- | ---------------------------------------------- |
| close only                 | `SaplingActionClose`                           |
| cancel + save              | `SaplingActionSave`                            |
| account/preferences save   | `SaplingActionAccount`                         |
| password change            | `SaplingActionChangePassword`                  |
| simple delete confirmation | `SaplingActionDelete`                          |
| generic record deletion    | `SaplingDialogDelete` with `SaplingActionBar`  |
| upload                     | `SaplingActionUpload`                          |
| custom action grouping     | `SaplingActionBar` with leading/trailing slots |

If none of the existing action components fit, add or extend an action component first and then use it from the dialog. This keeps footer behavior centralized instead of duplicating button layout in each custom dialog.

Generic single-record deletion loads `/generic/:entity/delete-impact` when the
confirmation dialog opens. A normal record uses one height-stable confirmation
dialog. When owned `1:m` groups exist, their checkboxes appear directly in a
scrollable list. Optional groups use a safe unselected default, while database
delete cascades are shown selected and disabled so unavoidable side effects stay
visible. **Select all** and **Select none** affect optional groups only. The delete
action passes only the selected optional relation groups rather than individual
records. Synchronized Events use the same dialog shell but present **Cancel
event**, because the backend retains the record and changes its status to
`canceled`. Bulk deletion keeps optional reference cascades unavailable, but
shows mandatory database cascades from the selected entity as locked choices.

### Shared Tab And Dialog Navigation Contract

Horizontal tabs, vertical dialog navigation, and tab-like view switches use
the framework contract in `SaplingFrameworkTabs.css`. Feature classes such as
dashboard, note, permission, AI-agent, account, inbox, and record-dialog tabs
may add domain layout such as minimum label width, but they must not redefine
the shared height, gap, radius, selected fill, typography, or active inset.
Relation entries in `SaplingDialogEdit` use the icon from their referenced
entity metadata. A restrained semantic icon color distinguishes one-to-many
(`1:m`) from many-to-many (`m:n`, including inverse `n:m`) relations. The
technical relation notation remains available to assistive technology and as a
tooltip, but is hidden visually because it is not meaningful to most users.
Persisted records append **Information**, **Documents**, **Emails**, and
**Phone Calls** to the same dialog navigation after the relation entries.
Below the small-window breakpoint used by mobile table cards, these supplemental
tabs and the form-configuration action are omitted from the embedded record
dialog. The corresponding record actions remain available through context
menus and their dedicated dialogs or pages.
Information uses the existing generic information record and permission
contract in a large Markdown workspace. Documents preserve the d.velop Cloud
overlay; local document storage renders the filtered document browser and
preview directly in the dialog, with the existing upload workflow available
from the tab. Emails filter `EmailDeliveryItem` by `entity + referenceHandle`;
phone calls filter `PhoneCallItem` by `entity + reference`. The email header
action opens a menu of the record's populated `isMail` fields and launches the
shared composer with exactly the selected address. The phone-call header action
reuses the shared phone-call dialog. Both embedded tables refresh when the
launched dialog closes. Available entries remain visible but locked until a
new record has been saved for the first time. Entries without effective read
permission on `information`, `document`, `emailDelivery`, or `phoneCall` are
omitted entirely; `allowShow` does not affect these record-level tabs. Email and
phone-call entries are metadata-conditional: each
appears only when at least one populated `isMail` or `isPhone` template exists,
including non-persistent projected assistant fields. Communication dialog
record labels come from `isValue` metadata through the shared value-label
resolver, without entity-specific field-name fallbacks. Reference-based
`isValue` entries are intentionally omitted from communication heroes so raw
reference handles are never appended to the name. A direct contact field
uses the edited record's label. A named assistant such as
`creatorPersonPhone` instead resolves its owner reference (`creatorPerson`) and
uses the referenced target entity's `isValue` templates and projected values.
Failed record validation returns the dialog to the form tab, expands the group
containing the first invalid field, scrolls that field into view, and focuses it.
The invoked save action pulses twice in the error color; reduced-motion clients
receive the same feedback as a temporary static highlight.
Recommended fields are distinct from required fields. An empty recommended
scalar field receives non-blocking warning styling. Recommended references warn
only when the current effective dependency filter has selectable records. The
warning clears after a value is selected and never prevents saving. Form
configuration can override the decorator default with its `recommended` field;
required semantics always take precedence.
Changed form fields use a content-sized warning ring around the complete field
surface, including attached actions. The ring follows the control radius and
must not stretch to a taller neighbor in the same grid row or tint the field's
transparent text surface. Numeric, money, and percent steppers reserve detail
height only while a validation message is present, keeping their normal dirty
ring flush with the visible control.
Unsaved Information Markdown drafts participate in the same dialog dirty state.
The Information tab and panel use warning styling, and save or discard persists
or resets the separate `information` record before the record dialog closes.
Reference and static-select dropdowns close when keyboard focus leaves their
field, including Tab navigation, while focus moving into a teleported dropdown
surface keeps the menu open. Record and relation navigation follows the tablist
keyboard pattern: arrow keys change tabs, Home selects the record tab, and End
selects the last available relation.
Reference selectors derive their one- or multi-line control height from the
target entity's `isValue` metadata. Scalar value parts share the first line and
each value reference adds a line; that geometry is reserved even while the
selection is empty, so selecting or clearing a record never shifts the form.
Tabular reference dropdowns move focus from the input to their first result with
Arrow Down. Arrow Up/Down then traverses result rows, Space selects the focused
row, and Escape closes the dropdown before the dialog itself handles Escape.
The shared tabular field picker measures the usable viewport space above and
below its activator. It opens on a side that can contain the result table and
caps its height to that side, so viewport repositioning never moves the result
surface across its input. At mobile widths, or when neither side has a usable
result height, the same picker opens as a full-screen Sapling dialog with its
own search field. Single references, multi references, and duplicate checking
must use this shared picker rather than configuring independent `v-menu`
geometry.
At effective viewport widths up to 1600 CSS pixels (including browser zoom),
`SaplingDialogEdit` moves its relation navigation above the content and reduces
workspace spacing. Narrower relation views stack add/remove controls, and
tabular reference dropdowns use viewport-relative width and height limits.
Relation tabs expose the shared table create workflow when the target entity
and current user allow inserts. A separate header action opens the target
entity's configured table route, with `/table/<entity>` as fallback.
Embedded relation tables consume the remaining dialog-body height. When their
smallest useful height no longer fits, the relation content scrolls vertically
so the table's horizontal scrollbar and pagination stay reachable. The compact
desktop layout also keeps only one small gap between relation actions and the
table search toolbar.
Their initial sort comes from the first readable `isOrderASC` or `isOrderDESC`
field on the referenced entity, matching the metadata-driven default used by a
standalone generic table. A sort selected in the relation table remains active
while its dialog state is retained.
Relation tabs are also available while the parent record is being created.
Selections remain local until the parent save succeeds. Owning many-to-many
relations (`m:n` and `n:m`) are included in the initial create payload; inverse
one-to-many relations (`1:m`) are attached with minimal child updates after the
new parent handle is known. For `1:m`, users may also open the standard create
dialog for a new child record. Its payload remains a local draft and is created
with the real parent handle only after the parent save succeeds. Relation tabs
inside that deferred child dialog stay locked until the child itself has been
persisted; this prevents recursively nested draft trees. A failed child update
or create keeps the parent record and returns the failed selection to the edit
dialog for retry, so retrying cannot create a duplicate parent. Resetting or
discarding the create form clears all staged relation selections and child
drafts.
Initial relation selections that contain only record handles are hydrated when
their relation tab opens. This keeps copied, defaulted, and workflow-provided
rows readable without issuing relation-list queries for an unsaved parent.
Handle-less edit drafts use the same local relation staging. This is required
for workflows such as detaching one recurring Event occurrence: the draft is
presented as an edit, but its standalone parent record does not exist until the
workflow save succeeds. Relation tables must never issue an unfiltered lookup
when that parent handle is absent.
For persisted records, relation actions remain immediate. When an owning
many-to-many action advances the parent record's concurrency version, the dialog
adopts the returned persisted version without rehydrating or discarding other
unsaved form fields. A later field save therefore compares against the relation
mutation instead of reporting it as a change by another user.
Relation navigation marks tabs that contain staged create-time changes. Embedded
relation tables keep edit and double-click workflows, but must not expose the
target record's destructive delete action: unlinking a relation is performed
explicitly through row selection and the relation tab's remove action.
Reference dropdown tables hide the complete table toolbar explicitly while keeping
their configured row-selection mode. They also disable row double-click actions because
opening a nested record dialog conflicts with the picker's focus-driven close behavior.
`SaplingTable` keeps both its toolbar and row double-click actions enabled by default so
full table views and other existing consumers do not opt out accidentally.
Glass dialog cards and reference dropdown surfaces paint their outer blur on a sibling
underlay. This avoids creating an ancestor Backdrop Root, allowing sticky table headers
and action columns to blur scrolling rows consistently inside overlays as well as pages.
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

## Link Navigation

User-facing links use native anchors (or Vue Router links for internal routes) without a forced
`target`. This preserves the browser navigation contract globally: a normal click opens the link
in the current tab, while Ctrl-click on Windows/Linux, Cmd-click on macOS, and middle-click open a
new tab. `frontend/src/utils/linkNavigation.ts` additionally enforces modified-click behavior for
embedded browser shells that do not implement the native anchor behavior themselves. Route
destinations in navigation surfaces must still render as anchors or Vue Router links; buttons are
reserved for commands without a destination URL. Do not replace normal link navigation with an
unconditional `window.open(..., '_blank')` call. Explicit actions whose documented purpose is to
launch a separate window or external workspace are the exception.

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

General operational feedback belongs exclusively in the message center. Pages,
dialogs, panels, KPI widgets, and system cards must not render their own HTTP,
network, loading, saving, or action-result alerts/snackbars. API services report
these failures through `pushApiErrorMessage`; non-HTTP workflows use
`useSaplingMessageCenter` directly. Local feedback remains inline only when it is
part of the edited or inspected content itself, such as field validation,
oversized-file selection, dependency guidance, persisted tool-action errors, or
destructive-action consequences.

This rule changes the presentation of feedback that was already user-visible; it
must not make previously silent background failures visible. Automatic bootstrap,
translation, metadata, session, permission, and skeleton-backed retry requests
use the API services' `suppressErrorMessage` option. A temporarily unavailable
backend during deployment remains represented by the existing loading state.
User-triggered requests and failures that were already shown in the page continue
to report through the message center.

API errors may provide a translation key plus `descriptionParams`. Entity
parameters use the stable `entityHandle`; the message center resolves them
through `navigation.<handle>` before interpolation. It loads the `global`,
`navigation`, `exception`, and `messageCenter` namespaces before rendering.
Reference-dependency errors additionally provide `fieldName` and
`parentFieldName`; when an `entityHandle` is present, the message center resolves
both through `<entityHandle>.<fieldName>` and falls back to a humanized field
name. Entity views already load their own namespace, so dependency errors can
identify both fields in the user's language.

Missing translation keys and generic HTTP-client errors must not be shown as
user text. They fall back to localized generic wording while the original
payload remains available in the technical log export. Raw database table,
constraint, stack, request details, and reverse-proxy HTML error pages are
diagnostic data only.

Client network failures identify the unavailable connection and tell the user
to check it and retry. Repeated identical failures remain counted as occurrences,
but their identical technical payload is stored only once so issue reports stay
compact.

Error entries expose the same **Report error** action in both the temporary
floating alert and the persistent message-center list. Both surfaces share the
same per-message loading and reported state, so an error cannot be submitted
twice from the two entry points.

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
