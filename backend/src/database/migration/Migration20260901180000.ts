import { Migration } from '@mikro-orm/migrations';

/** Persist positive or negative user ratings on Songbird responses. */
export class Migration20260901180000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "ai_chat_message_item" add column "rating" int null;`,
    );
    this.addSql(
      `alter table "ai_chat_message_item" add constraint "ai_chat_message_item_rating_check" check ("rating" in (-1, 1));`,
    );
    this.addSql(
      `alter table "ticket_item" alter column "title" type varchar(256) using ("title"::varchar(256));`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "ai_chat_message_item" drop constraint if exists "ai_chat_message_item_rating_check";`,
    );
    this.addSql(
      `alter table "ai_chat_message_item" drop column if exists "rating";`,
    );
    this.addSql(
      `alter table "ticket_item" alter column "title" type varchar(128) using ("title"::varchar(128));`,
    );
  }
}
