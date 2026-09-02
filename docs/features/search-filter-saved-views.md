# Search, Filters, And Saved Views

Sapling tables combine generic API filters, frontend column filters, free-text search, entity routes, and favorites. The backend remains the authority for permission-scoped reads; the frontend serializes user intent into query parameters and persisted favorite records.

## Main Files

```text
backend/src/api/generic/generic.controller.ts
backend/src/api/generic/generic-filter.service.ts
backend/src/api/generic/generic-read.service.ts
backend/src/api/generic/generic-permission.service.ts
backend/src/entity/FavoriteItem.ts
backend/src/entity/FavoriteTemplateItem.ts
backend/src/entity/EntityRouteItem.ts
frontend/src/components/table/filter/
frontend/src/composables/table/useSaplingTableFilters.ts
frontend/src/composables/table/useSaplingTableColumnFilter.ts
frontend/src/composables/table/useSaplingTableFilterHelpers.ts
frontend/src/utils/saplingTableUtil.ts
frontend/src/utils/saplingDynamicFilter.ts
frontend/src/utils/saplingFavoriteNavigation.ts
frontend/src/components/table/SaplingTableFavoriteDialog.vue
frontend/src/composables/dialog/useSaplingDialogFavorite.ts
frontend/src/composables/dashboard/useSaplingFavorites.ts
frontend/src/components/dashboard/SaplingFavorites.vue
frontend/src/composables/system/useSaplingCommandPalette.ts
frontend/src/services/api.search.service.ts
backend/src/api/generic/global-search.controller.ts
backend/src/api/generic/global-search.service.ts
```

Seed files:

```text
backend/src/database/seeder/json-production/favoriteTemplate/
backend/src/database/seeder/json-production/roleStarterFavorite/
backend/src/database/seeder/json-production/entityRoute/
backend/src/database/seeder/json-demonstration/favoriteTemplate/
backend/src/database/seeder/json-demonstration/roleStarterFavorite/
backend/src/database/seeder/json-demonstration/entityRoute/
```

## Generic Filter Contract

Generic read endpoints accept a JSON filter. The format follows MikroORM-style where clauses.

Common operators:

```text
$eq
$ne
$in
$nin
$gt
$gte
$lt
$lte
$ilike
$like
$and
$or
```

`GenericFilterService` normalizes `$like` to `$ilike`. `$ilike` is only allowed on string-like fields from the entity template.

Logical operators must be non-empty arrays:

```json
{
  "$and": [
    { "status": { "handle": { "$nin": ["closed"] } } },
    { "deadlineDate": { "$lt": "{{tomorrow.start}}" } }
  ]
}
```

Date strings on date/datetime fields are converted to `Date` instances before querying.

## Dynamic Filter Placeholders

Backend-supported placeholders:

| Placeholder                      | Meaning                         |
| -------------------------------- | ------------------------------- |
| `{{currentUser.handle}}`         | Current user person handle      |
| `{{currentUser.company.handle}}` | Current user's company handle   |
| `{{today.start}}`                | Start of today                  |
| `{{tomorrow.start}}`             | Start of tomorrow               |
| `{{dayAfterTomorrow.start}}`     | Start of the day after tomorrow |
| `{{week.start}}`                 | Start of current week           |
| `{{week.end}}`                   | Start of next week              |
| `{{month.start}}`                | Start of current month          |
| `{{month.end}}`                  | Start of next month             |
| `{{now}}`                        | Current timestamp               |

Frontend utilities also understand older UI token names such as `{{currentPerson.handle}}` and `{{currentCompany.handle}}`. When persisting filters for backend execution, prefer the backend token names.

## Frontend Table Filtering

The frontend builds filters from:

- URL query `filter`
- URL query `search`
- URL query `sortBy`
- column filter menu state
- table-specific default filters
- drilldown filters from KPI/timeline views

`saplingTableUtil.ts` turns user-visible filter choices into backend where clauses. Column filter components choose the input shape by field type: single value, relation selection, ranges, boolean values, and icon values.

Free-text search builds an `$or` across searchable/value fields from the entity template.

## Command Palette Record Search

The command palette includes a global record search backed by:

```text
GET /api/command-palette/records?query=<term>
```

This search is separate from AI vectorization. It is a classic, permission-filtered
text search intended for fast navigation and opening records from `Ctrl/⌘+K`.
The backend derives searchable fields from entity metadata:

- only entities the current user may read and show are searched
- visible entities are included unless `EntityItem.canRead` is explicitly `false`
- string-like, persistent, non-security, non-system fields are searched
- fields marked with `isSearchExcluded` are omitted from metadata-driven
  free-text search, including direct `isValue` fields of readable references
- entities without any remaining searchable fields produce no record results
- fields marked with `isValue` are preferred for labels and ranking
- many-to-one and one-to-one references marked with `isValue` contribute the
  readable `isValue` fields of their target entity to search and labels
- multi-word queries are matched both as a full phrase and as terms across fields

Results return entity handle, record handle, label, icon, a compact preview, and
a fallback table path. The frontend renders them in the `Datensätze` / `Records`
group and opens the matching record through the global generic record dialog.
Scalar value fields form the first label line; each value reference is rendered
on its own following line.

With `GLOBAL_SEARCH_INDEX_ENABLED=true`, candidate discovery uses the
`globalSearchIndex` entity instead of issuing one search query per entity.
The index entity is registered as an administrator-only, read-only generic
entity and can be inspected at `/table/globalSearchIndex`. Its table schema
shows the source entity, record, field path, stored value, and source update
timestamp. The entity is excluded from its own indexing and from command-palette
record search to prevent recursive growth and disclosure through the palette.

The same `isSearchExcluded` option is honored by generic table free-text search
and reference selectors. It does not hide the field, remove it from record
labels, or prevent users from applying an explicit column filter.

Use AI semantic search instead when the user asks natural-language questions
over long text such as ticket problems, solutions, knowledge articles, effort
estimate requirements, or sales opportunity pain points.

## Saved Views

`FavoriteItem` stores a personal saved view.

| Field         | Meaning                                       |
| ------------- | --------------------------------------------- |
| `title`       | Visible name                                  |
| `search`      | Persisted free-text search                    |
| `sortBy`      | Persisted table sort configuration            |
| `filter`      | Persisted generic filter JSON                 |
| `person`      | Owner                                         |
| `entity`      | Target entity                                 |
| `entityRoute` | Optional route used when opening the favorite |

`FavoriteTemplateItem` stores reusable favorite definitions.

| Field           | Meaning                                              |
| --------------- | ---------------------------------------------------- |
| `name`          | Template name                                        |
| `entity`        | Target entity                                        |
| `entityRoute`   | Optional route                                       |
| `filter`        | Reusable filter JSON                                 |
| `isRecommended` | Highlights the template in dashboard recommendations |

`RoleStarterSeeder` can assign favorite templates to roles through `roleStarterFavorite` seed files.

Personal worklists can be deleted directly from the table toolbar. The frontend
always asks for confirmation first and removes the `FavoriteItem` through the
generic API. Because the toolbar query is already restricted to the authenticated
person, only that person's worklists are offered there.

The worklist menu also offers a synthetic **Default worklist**. It does not create
or select a `FavoriteItem` and is separate from table-column views. Selecting it
clears worklist search, sorting, paging, and filters, then reapplies the same
metadata defaults as direct navigation: open chip values in generic tables and,
in the Partner workspace, the current person plus the default open chip values.
The currently selected table-column view remains unchanged.

Personal table-column views are deleted through the dedicated
`DELETE /api/form-config/:entityHandle/personal-table-view/:handle` endpoint.
The backend verifies that the saved configuration has `scope = person` and that
its `scopeHandle` matches the authenticated person. The synthetic standard view,
global views, role views, and views owned by another person are never deletable
through this path. The table toolbar uses the shared `SaplingDialogDelete`
confirmation UI for both personal worklists and personal table views; the
dedicated endpoint remains responsible for the table-view ownership check.

## Favorite Navigation

`buildFavoritePath()` resolves favorites to an application route:

1. Use `favorite.entityRoute.route` when present.
2. Resolve numeric `entityRoute` through the loaded entity route list when needed.
3. Fall back to `table/<entityHandle>`.
4. Append `search`, `sortBy`, and `filter` as encoded query parameters.

This means favorite filters should be route-safe and JSON-serializable. Avoid functions, dates as `Date` objects, or values that require client-only state.

New favorites created from a route-level table persist the matching current
entity route, so a favorite created in `partner/ticket` returns to the Partner
workspace while one created in `table/ticket` returns to the generic table.
Existing favorites without `entityRoute` remain compatible and continue to use
the `table/<entityHandle>` fallback.

The default seeded route for worklists of `effortEstimate`, `internalCase`,
`salesOpportunity`, and `ticket` is the Partner workspace. A Partner workspace
opened with an explicit `filter` query treats that saved filter as authoritative
and does not additionally select the current person. Direct Partner navigation
without an explicit filter still starts with the current person selected.
This also applies to client-side navigation from an already open Partner table:
asynchronously loaded chip metadata must not reapply the previous person filter.

## Entity Routes

`EntityRouteItem` lets one entity open through different views. Favorites can point to the default table route or a more specific route such as partner/file views.

When adding routes:

1. Add an `entityRouteData_XXX.json` seed file.
2. Link it to the entity.
3. Use the same route path that the frontend router expects.
4. Update favorite templates when the new route should be the preferred target.

## Extension Checklist

The Partner ticket workspace has a focused first-visit tutorial for its
additional person, company, and attribute filters. It does not repeat the full
generic-table tutorial. The tutorial opens the responsive filter panel when
necessary and can be restarted independently from the command palette. Keep the
`data-tutorial` hooks in `SaplingPartner.vue` and
`SaplingWorkFilterPanel.vue` aligned with that flow when filter groups change.

When adding a saved view:

1. Test the filter in the generic table URL first.
2. Persist the filter as object JSON, not escaped string JSON, unless an existing seeder requires string compatibility.
3. Use dynamic placeholders for user-relative filters.
4. Add the favorite template in a new numbered seed file.
5. Add role starter data if the view should be preloaded for roles.
6. Verify navigation from `SaplingFavorites.vue` and dashboard recommendations.

When adding a new filter UI behavior:

1. Add the UI state in `useSaplingTableColumnFilter.ts`.
2. Convert it to backend filter JSON in `saplingTableUtil.ts`.
3. Add helper parsing in `useSaplingTableFilterHelpers.ts` if existing filters should hydrate back into UI state.
4. Update frontend tests for serialization and hydration.
5. Confirm the backend accepts the produced operators through `GenericFilterService`.

## Verification

Useful targeted commands:

```powershell
npm test --prefix backend -- generic-filter.service.spec.ts generic-read.service.spec.ts --runInBand
npm run type-check:backend
npm run type-check:frontend
.\node_modules\.bin\vitest.cmd run src\composables\table\__tests__\useSaplingTableFilterHelpers.test.ts
.\node_modules\.bin\vitest.cmd run src\composables\table\__tests__\useSaplingTableColumnFilter.test.ts
.\node_modules\.bin\vitest.cmd run src\utils\__tests__\saplingDynamicFilter.test.ts
.\node_modules\.bin\vitest.cmd run src\utils\__tests__\saplingFavoriteNavigation.test.ts
```

Run a browser check for saved views because route/query behavior is easiest to break at the integration level.
