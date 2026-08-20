import { Migration } from '@mikro-orm/migrations';

export class Migration20260820120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "shared_mailbox_context_item"
       add column "template_handle" int null;`,
    );
    this.addSql(
      `create index "shared_mailbox_context_item_template_handle_index"
       on "shared_mailbox_context_item" ("template_handle");`,
    );
    this.addSql(
      `alter table "shared_mailbox_context_item"
       add constraint "shared_mailbox_context_item_template_handle_foreign"
       foreign key ("template_handle") references "email_template_item" ("handle")
       on update cascade on delete set null;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "shared_mailbox_context_item"
       drop constraint if exists "shared_mailbox_context_item_template_handle_foreign";`,
    );
    this.addSql(
      `drop index if exists "shared_mailbox_context_item_template_handle_index";`,
    );
    this.addSql(
      `alter table "shared_mailbox_context_item"
       drop column if exists "template_handle";`,
    );
  }
}
