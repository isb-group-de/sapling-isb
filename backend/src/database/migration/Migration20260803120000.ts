import { Migration } from '@mikro-orm/migrations';

export class Migration20260803120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "dashboard_item"
       add column "sort_order" int not null default 100,
       add column "kpi_order" jsonb not null default '[]'::jsonb;`,
    );
    this.addSql(
      `with ranked_dashboards as (
         select "handle",
                row_number() over (
                  partition by "person_handle"
                  order by "handle"
                ) * 100 as "sort_order"
         from "dashboard_item"
       )
       update "dashboard_item" as dashboard
       set "sort_order" = ranked."sort_order"
       from ranked_dashboards as ranked
       where dashboard."handle" = ranked."handle";`,
    );
    this.addSql(
      `update "dashboard_item" as dashboard
       set "kpi_order" = coalesce(
         (
           select jsonb_agg(link."kpi_item_handle" order by link."kpi_item_handle")
           from "dashboard_item_kpis" as link
           where link."dashboard_item_handle" = dashboard."handle"
         ),
         '[]'::jsonb
       );`,
    );
    this.addSql(
      `create index "dashboard_item_person_sort_order_index"
       on "dashboard_item" ("person_handle", "sort_order", "handle");`,
    );
  }

  override down(): void {
    this.addSql(
      'drop index if exists "dashboard_item_person_sort_order_index";',
    );
    this.addSql(
      `alter table "dashboard_item"
       drop column if exists "sort_order",
       drop column if exists "kpi_order";`,
    );
  }
}
