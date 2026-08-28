import { Migration } from '@mikro-orm/migrations';

export class Migration20260828120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "change_log_detail_item" drop constraint if exists "change_log_detail_item_log_handle_foreign";`,
    );
    this.addSql(
      `alter table "change_log_detail_item" add constraint "change_log_detail_item_log_handle_foreign" foreign key ("log_handle") references "change_log_item" ("handle") on delete cascade;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "change_log_detail_item" drop constraint if exists "change_log_detail_item_log_handle_foreign";`,
    );
    this.addSql(
      `alter table "change_log_detail_item" add constraint "change_log_detail_item_log_handle_foreign" foreign key ("log_handle") references "change_log_item" ("handle");`,
    );
  }
}
