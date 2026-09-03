import { Migration } from '@mikro-orm/migrations';

export class Migration20260903130000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "person_session_item" drop constraint if exists "person_session_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_session_item" add constraint "person_session_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );
    this.addSql(
      `alter table "session_store_item" drop constraint if exists "session_store_person_fk";`,
    );
    this.addSql(
      `alter table "session_store_item" add constraint "session_store_person_fk" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "person_session_item" drop constraint if exists "person_session_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_session_item" add constraint "person_session_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "session_store_item" drop constraint if exists "session_store_person_fk";`,
    );
    this.addSql(
      `alter table "session_store_item" add constraint "session_store_person_fk" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );
  }
}
