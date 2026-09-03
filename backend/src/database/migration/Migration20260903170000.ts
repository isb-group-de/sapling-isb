import { Migration } from '@mikro-orm/migrations';

export class Migration20260903170000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "favorite_item" drop constraint if exists "favorite_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "favorite_item" add constraint "favorite_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "favorite_item" drop constraint if exists "favorite_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "favorite_item" add constraint "favorite_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
  }
}
