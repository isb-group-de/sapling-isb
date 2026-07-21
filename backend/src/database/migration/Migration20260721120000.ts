import { Migration } from '@mikro-orm/migrations';

export class Migration20260721120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "ai_chat_session_item" add column "response_status" varchar(32) not null default 'idle', add column "response_activity_at" timestamptz null, add column "last_response_at" timestamptz null, add column "last_read_at" timestamptz null;`,
    );
    this.addSql(
      `create index "ai_chat_session_item_response_status_index" on "ai_chat_session_item" ("response_status");`,
    );
  }

  override down(): void {
    this.addSql(
      `drop index if exists "ai_chat_session_item_response_status_index";`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" drop column if exists "response_status", drop column if exists "response_activity_at", drop column if exists "last_response_at", drop column if exists "last_read_at";`,
    );
  }
}
