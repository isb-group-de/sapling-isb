# KPI And Dashboard System

Sapling KPIs are persisted definitions that aggregate any registered entity through the generic metadata model. Dashboards and favorites arrange those definitions into user-facing work surfaces.

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
backend/src/database/seeder/json-production/kpi/
backend/src/database/seeder/json-production/dashboardTemplate/
backend/src/database/seeder/json-production/favoriteTemplate/
backend/src/database/seeder/json-demonstration/kpi/
```

## KPI Model

`KpiItem` describes what should be measured, how it should be aggregated, and which entity it targets.

Important fields:

| Field               | Meaning                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `name`              | Human-readable KPI name                                                                                       |
| `description`       | Optional explanatory text                                                                                     |
| `targetEntity`      | `EntityItem` that resolves through `ENTITY_MAP`                                                               |
| `aggregation`       | Aggregation handle such as `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`                                                |
| `field`             | Field path to aggregate; relation paths such as `type.handle` are supported                                   |
| `type`              | Rendering/execution shape, including scalar, grouped, formula, target, funnel, trend, and calendar variants  |
| `timeframeField`    | Date field for time-based KPIs; defaults to `created_at` in executor logic                                    |
| `timeframe`         | Current period such as `DAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR`                                              |
| `timeframeInterval` | Sparkline bucket interval, for example `MONTH` within `YEAR`                                                  |
| `filter`            | Persisted generic filter JSON                                                                                 |
| `groupBy`           | Optional list of field paths used for grouped output                                                          |
| `relation`          | Optional relation entity context                                                                              |
| `relationField`     | Field used for relation drilldowns/grouping                                                                   |
| `secondary*`        | Optional independently filtered aggregation/entity/field used as the second formula operand                  |
| `durationStartField`| Start/comparison column for duration and field-to-field aggregations                                           |
| `formula*`          | Operation, scale, and display unit for calculated KPIs                                                         |
| `target*`           | Plan value, direction, warning boundary, and critical boundary for target/progress KPIs                        |

Reference handles are seeded in:

```text
backend/src/database/seeder/json-production/kpiType/kpiTypeData_001.json
backend/src/database/seeder/json-production/kpiType/kpiTypeData_002.json
backend/src/database/seeder/json-production/kpiAggregation/kpiAggregationData_001.json
backend/src/database/seeder/json-production/kpiTimeframe/kpiTimeframeData_001.json
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

| Type         | Runtime method                       | Typical frontend component |
| ------------ | ------------------------------------ | -------------------------- |
| `ITEM`       | `executeItemOrList()`                | `SaplingKpiItem.vue`       |
| `LIST`       | `executeItemOrList()`                | `SaplingKpiList.vue`       |
| `BREAKDOWN`  | `executeItemOrList()` with grouping  | `SaplingKpiBreakdown.vue`  |
| `TREND`      | `executeTrend()`                     | `SaplingKpiTrend.vue`      |
| `COMPARISON` | `executeTrend()`                     | `SaplingKpiComparison.vue` |
| `SPARKLINE`  | `executeSparkline()`                 | `SaplingKpiSparkline.vue`  |
| `CALENDAR`   | permission-aware generic Event query | `SaplingKpiCalendar.vue`   |
| `RATIO`      | `executeFormula()`                   | `SaplingKpiPerformance.vue`|
| `FORMULA`    | `executeFormula()`                   | `SaplingKpiPerformance.vue`|
| `TARGET`     | `executeTarget()`                    | `SaplingKpiPerformance.vue`|
| `PROGRESS`   | `executeTarget()`                    | `SaplingKpiPerformance.vue`|
| `FUNNEL`     | `executeItemOrList()` with grouping  | `SaplingKpiFunnel.vue`     |

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

Production and demonstration seed `kpiData_003.json` provide three reusable
calendar definitions: the next open appointments, the next confirmed
appointments, and the next online appointments for the signed-in participant.
They are intentionally not assigned to a dashboard template automatically.

### Appointment Worklist Versus Calendar KPI

Sapling provides two separate appointment surfaces on the dashboard:

- **Meine heutigen Termine** is a worklist (`FavoriteTemplateItem`). Select the
  matching quick link on the dashboard to open the Event table filtered to the
  signed-in participant, today's start range, and non-canceled/non-completed
  statuses.
- **Meine nächsten Termine** is a calendar KPI (`KpiItem` with type `CALENDAR`).
  Select **KPI hinzufügen** on the target dashboard, choose this KPI, and save.
  The card shows the next five open appointments within 90 days. The confirmed
  and online variants can be added in the same way.

Worklists are therefore intentionally not offered in the **KPI hinzufügen**
dialog. A KPI already assigned to the current dashboard is also excluded from
that dialog; it remains available for assignment to another dashboard.

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

`DashboardItem` stores a person-owned dashboard with a many-to-many list of KPIs.
Its `sortOrder` defines the dashboard position in the tab strip and its
`kpiOrder` JSON array stores the KPI handles in card order. Consumers append
assigned KPI handles that are missing from `kpiOrder`, which keeps migrated or
partially configured records usable.

The dashboard page keeps its normal read-only presentation until the user
opens layout editing. During editing, dashboard tabs and KPI cards are reordered
locally with drag-and-drop, and the removal controls for dashboards and KPI cards
are shown only in this mode. Cancel restores the previous ordering while keeping
already confirmed removals removed. Save sends all owned dashboards to
`PATCH /api/current/dashboardLayout`; the backend
validates dashboard ownership and the exact KPI assignments and persists both
orders atomically. Adding KPIs outside layout editing and removing them during
layout editing also update `kpiOrder`, so there is one ordering model rather than
a separate legacy path. An add-KPI request is scoped to the dashboard from which
it was started and consumed only once, so changing dashboard tabs cannot replay a
completed or cancelled dialog.
The dashboard tab strip keeps the shared tab height for each two-line label and
adds a dedicated scrollbar row to Vuetify's horizontal slide container. The
native scrollbar therefore stays below the title and KPI-count lines instead of
reducing their usable height.

The first-visit dashboard tutorial is the second group orchestrated by
`SaplingDashboardTutorials.vue`. It explains the KPI workspace, creation and
template actions, permission-aware quick links, dashboard tabs, KPI cards, and
layout editing. Its final step temporarily enters the existing layout editor so
the user sees draggable/resizable cards; finishing or dismissing the tutorial
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

| Component                                  | Responsibility            |
| ------------------------------------------ | ------------------------- |
| `SaplingDashboard.vue`                     | Main dashboard surface    |
| `SaplingDashboardTabs.vue`                 | Tab switching and sorting |
| `SaplingKpis.vue`                          | KPI rendering and sorting |
| `SaplingFavorites.vue`                     | Favorite list renderer    |
| `SaplingDashboardTemplateLoadDialog.vue`   | Load dashboard templates  |
| `SaplingFavoriteTemplateLoadDialog.vue`    | Load favorite templates   |
| `SaplingDashboardRecommendedFavorites.vue` | Suggested favorites       |

## Extension Checklist

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
