import { Migration } from '@mikro-orm/migrations';

export class Migration20260819120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "kpi_item"
       add column "secondary_aggregation_handle" varchar(64) null,
       add column "secondary_target_entity_handle" varchar(64) null,
       add column "secondary_field" varchar(128) null,
       add column "secondary_filter" jsonb null,
       add column "duration_start_field" varchar(128) null,
       add column "formula_operation" varchar(32) null,
       add column "formula_scale" real null,
       add column "unit" varchar(32) null,
       add column "target_value" real null,
       add column "target_direction" varchar(32) null,
       add column "warning_threshold" real null,
       add column "critical_threshold" real null;`,
    );
    this.addSql(
      `alter table "kpi_item" add constraint "kpi_item_secondary_aggregation_handle_foreign" foreign key ("secondary_aggregation_handle") references "kpi_aggregation_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "kpi_item" add constraint "kpi_item_secondary_target_entity_handle_foreign" foreign key ("secondary_target_entity_handle") references "entity_item" ("handle") on delete set null;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "kpi_item" drop constraint if exists "kpi_item_secondary_aggregation_handle_foreign";`,
    );
    this.addSql(
      `alter table "kpi_item" drop constraint if exists "kpi_item_secondary_target_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "kpi_item"
       drop column if exists "secondary_aggregation_handle",
       drop column if exists "secondary_target_entity_handle",
       drop column if exists "secondary_field",
       drop column if exists "secondary_filter",
       drop column if exists "duration_start_field",
       drop column if exists "formula_operation",
       drop column if exists "formula_scale",
       drop column if exists "unit",
       drop column if exists "target_value",
       drop column if exists "target_direction",
       drop column if exists "warning_threshold",
       drop column if exists "critical_threshold";`,
    );
  }
}
