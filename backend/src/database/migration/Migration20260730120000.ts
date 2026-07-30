import { Migration } from '@mikro-orm/migrations';

export class Migration20260730120000 extends Migration {
  override up(): void {
    this.addSql(
      `create table "shared_mailbox_context_item" (
        "handle" serial primary key,
        "entity_handle" varchar(64) not null,
        "mailbox_handle" int not null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null
      );`,
    );
    this.addSql(
      `alter table "shared_mailbox_context_item"
       add constraint "shared_mailbox_context_item_entity_handle_unique"
       unique ("entity_handle");`,
    );
    this.addSql(
      `create index "shared_mailbox_context_item_mailbox_handle_index"
       on "shared_mailbox_context_item" ("mailbox_handle");`,
    );
    this.addSql(
      `alter table "shared_mailbox_context_item"
       add constraint "shared_mailbox_context_item_entity_handle_foreign"
       foreign key ("entity_handle") references "entity_item" ("handle")
       on update cascade;`,
    );
    this.addSql(
      `alter table "shared_mailbox_context_item"
       add constraint "shared_mailbox_context_item_mailbox_handle_foreign"
       foreign key ("mailbox_handle") references "shared_mailbox_item" ("handle")
       on update cascade;`,
    );
  }

  override down(): void {
    this.addSql('drop table if exists "shared_mailbox_context_item" cascade;');
  }
}
