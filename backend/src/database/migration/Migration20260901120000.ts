import { Migration } from '@mikro-orm/migrations';

/** Add customer-specific persons that should be suggested as email CC recipients. */
export class Migration20260901120000 extends Migration {
  override up(): void {
    this.addSql(
      `create table "company_item_automatic_cc_persons" ("company_item_handle" int not null, "person_item_handle" int not null, primary key ("company_item_handle", "person_item_handle"));`,
    );
    this.addSql(
      `alter table "company_item_automatic_cc_persons" add constraint "company_item_automatic_cc_persons_company_item_handle_foreign" foreign key ("company_item_handle") references "company_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "company_item_automatic_cc_persons" add constraint "company_item_automatic_cc_persons_person_item_handle_foreign" foreign key ("person_item_handle") references "person_item" ("handle") on update cascade on delete cascade;`,
    );
  }

  override down(): void {
    this.addSql(
      `drop table if exists "company_item_automatic_cc_persons" cascade;`,
    );
  }
}
