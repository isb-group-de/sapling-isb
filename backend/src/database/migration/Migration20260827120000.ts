import { Migration } from '@mikro-orm/migrations';

export class Migration20260827120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "ai_provider_model_item" add column "supports_reasoning_summary" boolean not null default false;`,
    );
    this.addSql(
      `create table "ai_chat_queued_input_item" ("handle" serial primary key, "session_handle" int not null, "person_handle" int not null, "mode" varchar(16) not null default 'queue', "status" varchar(16) not null default 'queued', "content" varchar(16384) not null, "request_payload" jsonb null, "user_message_handle" int null, "assistant_message_handle" int null, "error_payload" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "started_at" timestamptz null, "completed_at" timestamptz null);`,
    );
    this.addSql(
      `create index "ai_chat_queued_input_item_session_handle_status_mode_created_at_index" on "ai_chat_queued_input_item" ("session_handle", "status", "mode", "created_at");`,
    );
    this.addSql(
      `alter table "ai_chat_queued_input_item" add constraint "ai_chat_queued_input_item_session_handle_foreign" foreign key ("session_handle") references "ai_chat_session_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_chat_queued_input_item" add constraint "ai_chat_queued_input_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_chat_queued_input_item" add constraint "ai_chat_queued_input_item_user_message_handle_foreign" foreign key ("user_message_handle") references "ai_chat_message_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_queued_input_item" add constraint "ai_chat_queued_input_item_assistant_message_handle_foreign" foreign key ("assistant_message_handle") references "ai_chat_message_item" ("handle") on delete set null;`,
    );
  }

  override down(): void {
    this.addSql(`drop table if exists "ai_chat_queued_input_item" cascade;`);
    this.addSql(
      `alter table "ai_provider_model_item" drop column if exists "supports_reasoning_summary";`,
    );
  }
}
