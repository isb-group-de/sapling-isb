import { Migration } from '@mikro-orm/migrations';

export class Migration20260909150000 extends Migration {
  override up(): void {
    this.addSql(
      'alter table "internal_case_item" add column "sales_opportunity_handle" int null, add column "ticket_handle" int null;',
    );
    this.addSql(
      'alter table "internal_case_item" add constraint "internal_case_item_sales_opportunity_handle_foreign" foreign key ("sales_opportunity_handle") references "sales_opportunity_item" ("handle") on delete set null;',
    );
    this.addSql(
      'alter table "internal_case_item" add constraint "internal_case_item_ticket_handle_foreign" foreign key ("ticket_handle") references "ticket_item" ("handle") on delete set null;',
    );
    this.addSql(
      'create index "internal_case_item_sales_opportunity_handle_updated_at_index" on "internal_case_item" ("sales_opportunity_handle", "updated_at");',
    );
    this.addSql(
      'create index "internal_case_item_ticket_handle_updated_at_index" on "internal_case_item" ("ticket_handle", "updated_at");',
    );
  }

  override down(): void {
    this.addSql(
      'drop index "internal_case_item_sales_opportunity_handle_updated_at_index";',
    );
    this.addSql(
      'drop index "internal_case_item_ticket_handle_updated_at_index";',
    );
    this.addSql(
      'alter table "internal_case_item" drop constraint "internal_case_item_sales_opportunity_handle_foreign";',
    );
    this.addSql(
      'alter table "internal_case_item" drop constraint "internal_case_item_ticket_handle_foreign";',
    );
    this.addSql(
      'alter table "internal_case_item" drop column "sales_opportunity_handle", drop column "ticket_handle";',
    );
  }
}
