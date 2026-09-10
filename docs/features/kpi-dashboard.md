# KPI And Dashboard System

The Sapling workspace arranges KPIs, agendas, native entity tables, and website/link widgets into personal dashboards. KPI definitions still aggregate registered entities through the generic metadata model.

## Main Files

```text
backend/src/entity/KpiItem.ts
backend/src/entity/KpiTypeItem.ts
backend/src/entity/KpiAggregationItem.ts
backend/src/entity/KpiTimeframeItem.ts
backend/src/entity/DashboardItem.ts
backend/src/entity/DashboardTemplateItem.ts
backend/src/entity/FavoriteItem.ts
backend/src/entity/FavoriteTemplateItem.ts
backend/src/api/kpi/kpi.controller.ts
backend/src/api/kpi/kpi.service.ts
backend/src/api/kpi/kpi.executor.ts
backend/src/api/kpi/dto/
backend/src/api/current/current.service.ts
backend/src/api/current/dto/dashboard-layout.dto.ts
frontend/src/components/kpi/
frontend/src/components/dashboard/
frontend/src/composables/kpi/
backend/src/database/seeder/json-default/kpi/
backend/src/database/seeder/json-default/dashboardTemplate/
backend/src/database/seeder/json-default/favoriteTemplate/
```

## KPI Model

`KpiItem` describes what should be measured, how it should be aggregated, and which entity it targets.

Important fields:

| Field                | Meaning                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `name`               | Human-readable KPI name                                                                                     |
| `description`        | Optional explanatory text                                                                                   |
| `targetEntity`       | `EntityItem` that resolves through `ENTITY_MAP`                                                             |
| `aggregation`        | Aggregation handle such as `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`                                              |
| `field`              | Field path to aggregate; relation paths such as `type.handle` are supported                                 |
| `type`               | Rendering/execution shape, including scalar, grouped, formula, target, funnel, trend, and calendar variants |
| `timeframeField`     | Date field for time-based KPIs; defaults to `created_at` in executor logic                                  |
| `timeframe`          | Current period such as `DAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR`                                            |
| `timeframeInterval`  | Sparkline bucket interval, for example `MONTH` within `YEAR`                                                |
| `filter`             | Persisted generic filter JSON                                                                               |
| `groupBy`            | Optional list of field paths used for grouped output                                                        |
| `relation`           | Optional relation entity context                                                                            |
| `relationField`      | Field used for relation drilldowns/grouping                                                                 |
| `secondary*`         | Optional independently filtered aggregation/entity/field used as the second formula operand                 |
| `durationStartField` | Start/comparison column for duration and field-to-field aggregations                                        |
| `formula*`           | Operation, scale, and display unit for calculated KPIs                                                      |
| `target*`            | Plan value, direction, warning boundary, and critical boundary for target/progress KPIs                     |

Reference handles are seeded in:

```text
backend/src/database/seeder/json-default/kpiType/kpiTypeData_0001_insert.json
backend/src/database/seeder/json-default/kpiAggregation/kpiAggregationData_0001_insert.json
backend/src/database/seeder/json-default/kpiTimeframe/kpiTimeframeData_0001_insert.json
```

The demonstration seed files can add richer examples, but the reference handles should stay stable because KPI execution switches on them.

## Execution Flow

KPI execution starts in `KpiService.executeKPIById(id, currentUser)`.

The batch endpoint `POST /api/kpi/execute-batch` is also a query-only operation.
It is explicitly marked with `@ImpersonationReadOnly()`, so dashboards continue
to load while an administrator views the application as another user. The
batch service still applies each target entity's read permission and scope.

1. The KPI is loaded with its primary and optional secondary aggregation/entity plus presentation references.
2. `targetEntity.handle` is resolved against `ENTITY_MAP`.
3. The persisted filter is prepared through `GenericFilterService.prepareReadCriteria()`.
4. Runtime placeholders such as `{{currentUser.handle}}`, `{{currentUser.company.handle}}`, and date placeholders are resolved.
5. `GenericPermissionService.setTopLevelFilter()` applies the current user's entity scope independently to both operands.
6. `KPIExecutor` builds SQL through MikroORM query builders.
7. The service returns a KPI response with value data and drilldown metadata.

This means KPI results are not a bypass around normal entity permissions. If a user cannot read the underlying records, the permission filter must also limit the KPI result.

## KPI Types

| Type         | Runtime method                       | Typical frontend component  |
| ------------ | ------------------------------------ | --------------------------- |
| `ITEM`       | `executeItemOrList()`                | `SaplingKpiItem.vue`        |
| `LIST`       | `executeItemOrList()`                | `SaplingKpiList.vue`        |
| `BREAKDOWN`  | `executeItemOrList()` with grouping  | `SaplingKpiBreakdown.vue`   |
| `TREND`      | `executeTrend()`                     | `SaplingKpiTrend.vue`       |
| `COMPARISON` | `executeTrend()`                     | `SaplingKpiComparison.vue`  |
| `SPARKLINE`  | `executeSparkline()`                 | `SaplingKpiSparkline.vue`   |
| `CALENDAR`   | permission-aware generic Event query | `SaplingKpiCalendar.vue`    |
| `RATIO`      | `executeFormula()`                   | `SaplingKpiPerformance.vue` |
| `FORMULA`    | `executeFormula()`                   | `SaplingKpiPerformance.vue` |
| `TARGET`     | `executeTarget()`                    | `SaplingKpiPerformance.vue` |
| `PROGRESS`   | `executeTarget()`                    | `SaplingKpiPerformance.vue` |
| `FUNNEL`     | `executeItemOrList()` with grouping  | `SaplingKpiFunnel.vue`      |

`TREND` and `COMPARISON` compare the current timeframe with the previous equivalent timeframe. `SPARKLINE` creates bucketed values inside a timeframe, for example months within a year or days within a month.

`RATIO` and `FORMULA` return the calculated value together with both operand
values, operation, scale, and unit. Division by zero deliberately produces no
value. The optional second operand can target another entity; its filter, field
permissions, entity permission, and person/company scope are checked separately.
`TARGET` and `PROGRESS` build on the same calculation and add the target value,
attainment percentage, target direction, and a `good`, `warning`, or `critical`
status. The warning threshold is the configurable boundary into `good` (falling
back to the target), while the critical threshold is the boundary into
`critical`; values between those boundaries are warnings.

`FUNNEL` uses the same grouped backend result as `BREAKDOWN`, but renders stages
with relative widths and step-to-step conversion. The add-KPI autocomplete shows
the translated KPI type next to every name, so paired Breakdown and Funnel KPIs
do not need technical type suffixes in their business names.

`CALENDAR` is a frontend agenda rather than an aggregation payload. It requires
`targetEntity=event`, combines the persisted KPI filter with the signed-in
person as participant, and uses the permission-enforced generic Event API. The
card expands recurring events locally and displays the next five occurrences
within 90 days. Its required `aggregation` and `field` values remain persisted
for compatibility with the shared KPI model but are not evaluated by this
renderer.

Production and demonstration seed `kpiData_0001_insert.json` provide three reusable
calendar definitions: the next open appointments, the next confirmed
appointments, and the next online appointments for the signed-in participant.
They are intentionally not assigned to a dashboard template automatically.

### Appointment Worklists And Agenda Widgets

**Meine heutigen Termine** remains a saved Event worklist. New agenda cards are
added through **Widget hinzufügen → Agenda** and have their own title, date
horizon, appointment limit, optional status, and copied worklist filter.
Existing CALENDAR KPI assignments are rendered as equivalent agenda widgets.
They retain the original filter, the current participant, and the 90-day/five-entry
limits. Other KPI definitions are selected through the KPI widget type.

## Aggregation And Grouping

`KPIExecutor` resolves field paths before building SQL. This allows KPIs to aggregate on direct columns and relation fields.

Examples:

```json
{
  "aggregation": "COUNT",
  "field": "handle",
  "targetEntity": "ticket",
  "type": "ITEM"
}
```

```json
{
  "aggregation": "COUNT",
  "field": "type.handle",
  "targetEntity": "salesOpportunity",
  "type": "BREAKDOWN",
  "groupBy": ["type.handle"]
}
```

Use relation paths intentionally. Every additional relation affects query shape and must still match the entity metadata and database naming.

Duration aggregations `DURATION_AVG` and `DURATION_SUM` return hours and require
`durationStartField`. `COUNT_LTE_FIELD` counts rows whose primary field is less
than or equal to the comparison field and is used for SLA compliance. Formula
scales can convert hours to days or ratios to percentages.

## Drilldowns

KPI responses include drilldown context so cards can open the underlying generic entity view with the same semantic filter.

The service builds different drilldown variants:

| KPI shape           | Drilldown behavior                  |
| ------------------- | ----------------------------------- |
| Item/list/breakdown | Base entity filter                  |
| Trend/comparison    | Current and previous period filters |
| Sparkline           | Bucket-level filters                |

Drilldowns should always carry enough context to reproduce the KPI subset in the generic table without leaking records outside the user's permission scope.

## Dashboard And Favorites

The page is named **Sapling Arbeitsbereich**. Each person-owned DashboardItem
and reusable DashboardTemplateItem has an ordered nullable JSON widgets array.
Each instance stores a stable ID, title, columns (1–4), rows (1–4), kind, and config:

| Kind    | Persisted configuration                                                                  |
| ------- | ---------------------------------------------------------------------------------------- |
| KPI     | Existing KPI handle; its definition remains centrally managed                            |
| AGENDA  | Generic filter, days ahead, occurrence limit; always scoped to the viewer as participant |
| TABLE   | Entity handle, copied filter, visible columns in order, sorting, search, page size       |
| WEBSITE | HTTPS URL and link/embed display mode                                                    |
| NOTE    | Markdown content (up to 20,000 characters), shared editor and safe Markdown renderer      |
| ACTIONS | One to twelve labelled buttons opening generic create dialogs for configured entities   |

Notes can be edited directly with the card's pencil; outside layout editing,
save persists immediately. In layout editing, changes remain in the draft.
Quick actions require read and insert permission plus the entity's `canInsert`
capability. Clicking loads metadata and opens the existing record dialog; no
record is created until the user saves. The standard table save workflow handles
pending relations, save-and-close, subsequent edits and concurrency conflicts.
Actions are disabled during layout editing. Both types are copied with templates
and restored when cancelling a layout draft. No additional schema migration is
needed because their configuration uses the existing widgets JSON column.

Website widgets open their URL in a new tab from both the header action and
the link button, preserving the CRM tab. The iframe stays embedded in embed mode.

The worklist picker for table and agenda widgets explicitly loads `filter`,
`search`, and `sortBy`, even though those fields are hidden in the list. It
defaults its `isPerson` column filter to the signed-in person; users can change
or clear that column filter. Imported widget filters retain dynamic user tokens
so they continue to resolve for the viewer when copied through templates.

Null or absent widgets denotes a legacy dashboard. The frontend converts its
KPI relations in kpiOrder order, with CALENDAR definitions becoming agendas.
An explicit empty array stays empty. Existing KPI relations remain for legacy
seed/provisioning compatibility; new workspace saves use the complete widget
array. Migration20260907120000 adds the JSON columns without rewriting old data.

Adding a widget saves immediately. Layout editing allows reordering, resizing,
configuration changes and widget removal in a local draft. Cancel restores the
widget snapshot, including removed widgets and their settings. Confirmed whole
dashboard deletions remain deleted. Save sends all owned dashboards to
PATCH /api/current/dashboardLayout; ownership, completeness, IDs, dimensions and
kind-specific settings are validated and persisted in one transaction. The
legacy exact-KPI-order payload is still accepted. ORM hooks apply the same widget
validation to generic dashboard and template writes.

Saving a template captures the originating dashboard's complete widget array.
Loading it creates a new dashboard with a deep copy in one create request;
role-based starter provisioning also copies widgets. Configurations, sizes and
order are independent after copying. KPI definitions remain referenced, so their
central definition changes still apply to every KPI widget. Worklist filters are
copied, rather than dynamically linked to later favorite edits.

Tables reuse SaplingTable and the generic permission-enforced API, with separate
pagination, search and filter state for each widget and no URL-state syncing.
The widget editor defines the saved initial view. Interactive table changes are
local to that rendered view; edit the widget to change its saved defaults.
Agendas use the same generic Event API and recurrence expansion as calendar KPIs.
Website embeds use a sandboxed iframe with no referrer. The destination's
frame-ancestors/X-Frame-Options policy and browser login/cookie restrictions can
prevent embedding; the card always provides a direct link. Only HTTPS URLs
without embedded credentials are accepted. Sapling does not proxy external pages.

The add dialog request is consumed once and scoped to the originating dashboard.
The tab scrollbar has a dedicated row beneath tab titles and widget counts.

### KPI Grid Geometry

`SaplingKpiGrid.vue` and `SaplingKpiTile.vue` provide the shared dashboard,
loading-placeholder, and playground layout. The grid uses the available content
width (container queries), with one column below 600px, two from 600px, three
from 960px, and four from 1280px. It never stretches a partial row to fill the
remaining columns. A two-row tile is **square**. One row has height
`(column width - row gap) / 2`, so two one-row tiles and their intervening gap
align exactly with a two-row tile. Content cannot enlarge a row.
The KPI header and its actions stay outside the
card's scrollable body. Lists use that body instead of a separate 190px limit.

Current value KPIs (`ITEM`) use `columns=1` and `rows=1`; all other KPI types
use the square tile defaults `columns=1` and `rows=2`. The shared
`getKpiTileRows` resolver also sizes the playground. Compact value cards reduce
header/body spacing so their value remains usable in a half-height tile.
Widgets
can span one to four columns and rows, for example:

```vue
<SaplingKpiGrid>
  <SaplingKpiTile :columns="2" :rows="2">...</SaplingKpiTile>
  <SaplingKpiTile :columns="3" :rows="1">...</SaplingKpiTile>
</SaplingKpiGrid>
```

Spanning sizes include the gaps between their cells, so adjacent tiles stay
aligned. CSS Grid uses dense row placement to fill half-height holes with later
tiles, allowing two value KPIs to stack alongside a calendar. Saved order and
DOM/keyboard order remain unchanged; visual order can differ when filling gaps.
A tile wider than the available
column count is hidden instead of compressed or creating implicit columns; it
reappears when enough width is available. Height spans remain scrollable with
the dashboard page. Widget size is edited in the shared widget dialog and persisted with its configuration. Layout editing
keeps the same tile dimensions and reserves drag-handle space inside the card.
Native drag previews preserve both source dimensions and the pointer's actual
position inside the source bounds. Preview transforms are disabled to keep the
grab point stable, including when a tile is picked up in a right-hand column.

The first-visit dashboard tutorial is the second group orchestrated by
`SaplingDashboardTutorials.vue`. It explains the Sapling workspace, creation and
template actions, permission-aware quick links, dashboard tabs, widgets, and
layout editing. Its final step temporarily enters the existing layout editor so
the user sees draggable cards; finishing or dismissing the tutorial
cancels that tutorial-started edit and restores the previous local layout.

`Migration20260803120000` adds both fields, backfills existing dashboards in a
stable handle order, and creates the person/order lookup index. Role-based
starter provisioning writes `sortOrder` and `kpiOrder` at creation time, so new
databases and existing databases use the same runtime logic.

`DashboardTemplateItem` stores reusable dashboard layouts. It is usually seeded so roles or users can start with sensible KPI collections.

New dashboard-template seed files should reference seeded KPIs by name. The
generic seeder resolves those names to persisted KPI records and fails the seed
when a name is unknown. Numeric KPI handles are deliberately rejected because
auto-increment values can differ between databases. All production and
demonstration dashboard-template seeds use the same name-based contract.

```json
{
  "name": "My Support Operations",
  "kpis": ["Meine offene Tickets", "Meine Tickets nach Priorität"]
}
```

`FavoriteItem` stores person-owned saved generic views:

| Field         | Meaning                             |
| ------------- | ----------------------------------- |
| `title`       | Visible favorite name               |
| `search`      | Optional persisted free-text search |
| `sortBy`      | Optional persisted sorting          |
| `filter`      | Generic filter JSON                 |
| `person`      | Owner                               |
| `entity`      | Target entity                       |
| `entityRoute` | Optional route configuration        |

`FavoriteTemplateItem` stores reusable favorite definitions. Starter data can assign dashboard/favorite templates to roles so new users get a useful workspace without manual setup.

Frontend dashboard components:

| Component                                  | Responsibility                          |
| ------------------------------------------ | --------------------------------------- |
| `SaplingDashboard.vue`                     | Main dashboard surface                  |
| `SaplingDashboardTabs.vue`                 | Tab switching and sorting               |
| `SaplingDashboardWidgets.vue`              | Widget rendering, editing, and sorting  |
| `SaplingWidgetDialog.vue`                  | Kind-specific settings and grid sizes   |
| `SaplingTableWidget.vue`                   | Independent native entity table         |
| `SaplingAgendaWidget.vue`                  | Participant-scoped upcoming occurrences |
| `SaplingFavorites.vue`                     | Favorite list renderer                  |
| `SaplingDashboardTemplateLoadDialog.vue`   | Load dashboard templates                |
| `SaplingFavoriteTemplateLoadDialog.vue`    | Load favorite templates                 |
| `SaplingDashboardRecommendedFavorites.vue` | Suggested favorites                     |

## Extension Checklist

For a new widget kind, extend both widget unions and backend validation, add its
renderer and editor, and verify generic writes, layout save/cancel, template
copying and starter provisioning. Widget configuration must remain serializable
and must never bypass entity or field permissions.

When adding a new KPI:

1. Confirm the target entity exists in `ENTITY_REGISTRY` and `ENTITY_MAP`.
2. Pick the narrowest aggregation/type combination that answers the business question.
3. Use `filter` placeholders instead of hard-coded user handles when the KPI should be user-relative.
4. Set `timeframeField`, `timeframe`, and `timeframeInterval` only for time-aware KPIs.
5. Add seed data in a new numbered file when the KPI should ship with production or demo data.
6. Add dashboard template or role starter data when the KPI should be visible by default.
7. Verify drilldown behavior in the generic table.

When adding a new KPI type:

1. Add or seed the `KpiTypeItem` handle.
2. Extend `KpiService` dispatch when the type uses the KPI execution endpoint;
   frontend-only widgets such as `CALENDAR` instead document and test their
   permission-enforced data source.
3. Extend `KPIExecutor` if the server-side data shape is new.
4. Add DTOs when the response shape changes.
5. Add frontend component/composable rendering.
6. Add translations and seed permissions as needed.
7. Add backend tests for execution and frontend tests for rendering behavior.

## Verification

Dedicated frontend KPI tests cover rendering, navigation, refresh behavior, and
calendar agenda normalization. Continue to add backend tests when changing
executor behavior.

Useful commands:

```powershell
npm run type-check:backend
npm run type-check:frontend
```

For executor changes, prefer adding backend tests around `KpiService`/`KPIExecutor` with seeded entities and filters. For dashboard UI changes, add focused frontend tests around the affected KPI component or dashboard component.
