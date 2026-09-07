import { Migration } from '@mikro-orm/migrations';

export class Migration20260907150000 extends Migration {
  override up(): void {
    this.addSql(`create table "email_signature_item" (
      "handle" serial primary key, "name" varchar(128) not null,
      "body_markdown" varchar(8192) not null, "is_active" boolean not null default true,
      "use_in_rotation" boolean not null default true, "person_handle" int not null,
      "last_used_at" timestamptz null, "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      constraint "email_signature_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on update cascade on delete cascade
    );`);
    this.addSql(
      'create index "email_signature_rotation_idx" on "email_signature_item" ("person_handle", "is_active", "use_in_rotation", "last_used_at", "handle");',
    );
    this.addSql(
      'alter table "person_item" add column "email_signature_rotation" boolean not null default true, add column "default_email_signature_handle" int null;',
    );
    this.addSql(
      'alter table "person_item" add constraint "person_item_default_email_signature_handle_foreign" foreign key ("default_email_signature_handle") references "email_signature_item" ("handle") on update cascade on delete set null;',
    );
  }

  override down(): void {
    this.addSql(
      'alter table "person_item" drop column "default_email_signature_handle", drop column "email_signature_rotation";',
    );
    this.addSql('drop table "email_signature_item";');
  }
}
