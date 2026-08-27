# Entity And Metadata System

Sapling's central architecture is a metadata-driven entity system. Entities describe persistence, permissions, form layout, field behavior, references, and generic UI behavior.

## Core Flow

```text
MikroORM entity
  -> ENTITY_REGISTRY handle
  -> TemplateService metadata
  -> GenericController / GenericService
  -> Frontend table, dialog, references, filters
```

Important files:

```text
backend/src/entity/*Item.ts
backend/src/entity/global/entity.registry.ts
backend/src/entity/global/entity.decorator.ts
backend/src/api/template/template.service.ts
backend/src/api/template/dto/entity-template.dto.ts
backend/src/api/generic/
frontend/src/entity/structure.ts
frontend/src/components/dialog/SaplingDialogEditFieldRenderer.vue
frontend/src/composables/table/
```

## Entity Handles

An entity handle is the stable string name for an entity.

Examples:

```text
ticket
event
salesOpportunity
effortEstimate
person
company
translation
```

The handle is used in:

- `ENTITY_REGISTRY`
- seed folder names
- generic API URLs
- permissions
- translations
- frontend routes
- MCP generic tools
- vectorization entity handles when supported

Changing a handle is a breaking cross-layer change.

## ENTITY_REGISTRY

`backend/src/entity/global/entity.registry.ts` registers entity handles.

It exports:

- `ENTITY_REGISTRY`: sorted registry entries.
- `ENTITY_HANDLES`: list of handles.
- `ENTITY_MAP`: map from handle to entity class.

When adding a new entity, register it here or the generic API/template system will not know it exists.

## Sapling Decorators

Sapling decorators live in:

```text
backend/src/entity/global/entity.decorator.ts
```

They attach metadata to entity properties through `reflect-metadata`. `TemplateService` reads that metadata and sends it to the frontend as `EntityTemplateDto`.

### `@Sapling([...])`

Describes field semantics.

Common options:

| Option | Meaning |
| --- | --- |
| `isValue` | Primary human-readable value for lists/references |
| `isSecurity` | Sensitive field; omitted from MCP schemas and handled as protected UI |
| `isSearchExcluded` | Excludes a field from metadata-driven free-text searches while keeping it available for display and explicit column filters |
| `isReadOnly` | Display-only/system-controlled field |
| `isRecommended` | Non-blocking completeness guidance for fields that should be filled when applicable |
| `isSystem` | System metadata such as timestamps |
| `isMarkdown` | Markdown editor/preview field |
| `isLink` | Link field |
| `isMail` | Email field |
| `isPhone` | Phone field |
| `isColor` | Color picker |
| `isIcon` | Icon selector |
| `isChip` | Chip-like status/type display |
| `isMoney` | Money input |
| `isPercent` | Percent input |
| `isNumeric` | Plain numeric input with step controls |
| `isDuplicateCheck` | Duplicate check during create |
| `isCompany` | Company reference semantics |
| `isPerson` | Person reference semantics |
| `isCurrentPerson` | Current-user default/filter behavior |
| `isCurrentCompany` | Current-company default/filter behavior |
| `isOrderASC` / `isOrderDESC` | Preferred ordering field |
| `isDeadline` / `isToday` | Date semantics for work filters |
| `isDateStart` / `isDateEnd` | Start/end date pairing |
| `isAutoKey` | Auto-key editor |

### `@SaplingForm(...)`

Controls generated edit dialog layout.

Example:

```ts
@SaplingForm({
  order: 100,
  group: 'ticket.groupBasics',
  groupOrder: 100,
  width: 2,
  visible: true,
  tableOrder: 100,
  tableVisible: true,
  mobileOrder: 100,
  mobileVisible: true,
})
```

Fields are sorted by group order and field order. Width is a 1-4 grid span.
`visible` controls generated edit-dialog fields. Table and mobile options
independently control generated table columns and mobile card fields. These
values are explicit initial metadata on `SaplingForm`; saved form-configuration
overlays can override them per entity, role, or person. The current mobile
convention is to set `mobileVisible: true` only on `isValue` fields.

Saved form configurations treat groups as first-class layout objects. A group
entry under `config.groups` can set `order`, `visible`, and an optional custom
`label` once for every field in that group. Field-level `groupOrder` values and
the decorator metadata remain backward-compatible defaults, while the central
group entry wins when an overlay is active. Setting a group to invisible hides
all of its fields without rewriting each field configuration.

### `@SaplingDependsOn(...)`

Defines dependent reference filtering.

Common pattern:

```ts
@SaplingDependsOn({
  parentField: 'company',
  targetField: 'company',
  requireParent: true,
  clearOnParentChange: true,
})
```

The frontend uses this metadata to filter a child relation by the selected parent relation.
When `requireParent` is omitted or false, the child selector remains enabled and
shows the complete catalog while no parent is selected. Selecting a child that
contains `targetField` then synchronizes that referenced value back into
`parentField`. `clearOnParentChange` still clears an existing child when the
parent is changed or removed. This makes suitable reference pairs bidirectional
without entity-specific frontend logic.

Use `requireParent: true` only when the parent cannot safely be derived from a
child selection, for example when `parentField` is the current record's scalar
handle rather than another selectable reference. Relation-to-relation pairs
should normally leave it unset so either field can be selected first.

After a parent change, generated edit dialogs also query each dependent
reference with a two-record limit. Exactly one permitted result is selected
automatically; zero or multiple results leave the child empty for manual input.
When the child also has `isRecommended`, the same query drives a non-blocking
warning while permitted matching records exist and the child remains empty.
No warning is shown without a parent, without matches, without read permission,
or when availability cannot be determined.
Create-dialog defaults such as `isCurrentCompany`, `isCurrentPerson`, and
configured reference placeholders trigger the same lookup after form hydration.
The lookup is tied to the current parent value so a slower response for an older
selection cannot overwrite the form. Clearing a child manually does not trigger
the lookup again until its own parent changes.

### `@SaplingGenericReference(...)`

Models polymorphic references with an entity field and a handle field.

Use when one record can point to different entity types.

### `@SaplingReferenceTemplate(...)`

Copies values from a selected reference/template into the current record.

Example use case:

- `EffortEstimatePositionItem.template`
- copies `offerTextMarkdown`
- optionally copies `estimatedHours`

### `@SaplingInlineCollection(...)`

Marks a collection relation that should be edited inside the main dialog
instead of being shown as a separate relation tab.

Current use:

- `EmailSubscriptionItem.conditions`
- renderer: `conditionBuilder`
- source entity field: `entity`

Inline collections must be explicit because normal `1:m` relations are
derived from the owning side and are otherwise managed in relation tabs. The
generic mutation path synchronizes only decorated inline collections: submitted
rows with handles are updated, new rows are inserted, and omitted existing rows
are deleted.

### `@SaplingKanban(...)`

Marks an entity as renderable in the generic `/kanban/:entity` board.
Place the decorator on one stable field, usually an `isValue` field, and point
`columnField` at the many-to-one reference that forms board columns.

Example:

```ts
@SaplingKanban({
  columnField: 'status',
  scopeOpenField: 'isOpen',
  scopeOpenValue: true,
  cardSubtitleFields: ['assigneeCompany'],
  cardMetaFields: ['priority'],
  cardFooterFields: ['assigneePerson', 'deadlineDate'],
})
```

The frontend loads the column reference entity, groups records by that relation,
and updates the configured field through the generic PATCH API on drag-and-drop.
`scopeOpenField` is read from the column record; `recordScopeOpenField` can be
used when the row itself also has an open/active flag.

## TemplateService

`backend/src/api/template/template.service.ts` reads MikroORM metadata and Sapling decorator metadata.

Every Sapling entity must define exactly one primary key named `handle`.
`TemplateService` validates this invariant. Generic reference metadata never
exposes an alternate or composite identifier contract; all generic consumers
address related records through `handle`.

It returns `EntityTemplateDto[]` with:

- field name and type
- relation kind and reference target
- auto-increment flag
- nullable/required/default values
- Sapling options
- form layout
- dependency metadata
- generic reference metadata
- reference template metadata
- inline collection metadata
- Kanban board metadata

The frontend should rely on template metadata instead of duplicating backend rules.

Static MikroORM and Sapling-decorator templates are calculated once per entity
handle and reused across requests. Callers receive a separate array so local
array operations do not alter the cached template. Derived custom-field
templates use a separate shared cache because their definitions are stored in
the database; successful generic mutations of `customFieldDefinition` or
`customFieldType` invalidate that dynamic cache. The direct template endpoint
also emits a private ETag and supports conditional `If-None-Match` requests.

## Frontend Field Rendering

`frontend/src/components/dialog/SaplingDialogEditFieldRenderer.vue` selects field components from template metadata.

Examples:

| Template signal | Renderer |
| --- | --- |
| `genericReference` | `SaplingFieldGenericReference` |
| relation field | `SaplingSingleSelectField` |
| `isPhone` | `SaplingPhoneField` |
| `isMail` | `SaplingMailField` |
| `isLink` | `SaplingLinkField` |
| `isColor` | `SaplingColorField` |
| `isIcon` | `SaplingIconField` |
| `isPercent` | `SaplingFieldPercent` |
| `isMoney` | `SaplingFieldMoney` |
| `isNumeric` or numeric type | `SaplingNumberField` |
| `boolean` | `SaplingBooleanField` |
| `datetime` | `SaplingDateTimeField` |
| `DateType` | `SaplingDateTypeField` |
| `isMarkdown` | `SaplingMarkdownField` |
| `JsonType` | `SaplingJsonField` |
| `isSecurity` | `SaplingPasswordField` |
| short strings | `SaplingShortTextField` |
| fallback | `SaplingLongTextField` |

## Adding A New Entity Checklist

Backend:

1. Create `backend/src/entity/NewThingItem.ts`.
2. Add MikroORM decorators and Sapling metadata.
3. Register in `ENTITY_REGISTRY`.
4. Add migration.
5. Add seed files:
   - `entityData_XXX.json`
   - `entityRouteData_XXX.json`
   - `translationData_XXX.json`
   - entity-specific reference/demo files
6. Update permission matrices if access should differ from defaults.
7. Add script-button controller only if entity-specific actions are needed.

Frontend:

1. Use generic table route if possible.
2. Add custom field renderer only for a new Sapling option or special entity field.
3. Add custom view only for workflows that cannot be expressed generically.
4. Ensure translations are loaded by the relevant view/composable.

AI/MCP:

1. Entity is automatically available to generic MCP tools if registered and permitted.
2. Add semantic vectorization only if long-text semantic search is valuable.
3. Update AI docs/tool guidance when adding new AI-visible behavior.

## Common Mistakes

- Adding an entity class but not registering it.
- Adding a route but forgetting navigation/entity seed data.
- Editing old seed files when a new numbered seed file is expected.
- Adding frontend-only field behavior instead of using Sapling metadata.
- Forgetting that permissions are role/entity based and can block generic API and MCP tools.

## Deletable Reference Catalogs

User-managed status and badge catalogs must not leave business records behind
with invalid foreign keys. When a catalog value may be deleted, model the
owning many-to-one relation as nullable with `deleteRule: 'set null'`. Remove
database and metadata defaults that point to a particular seeded handle; code
that needs a conventional handle must load it explicitly and skip its optional
side effect when the value is absent.
