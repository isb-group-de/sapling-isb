import { Migration } from '@mikro-orm/migrations';

export class Migration20260910103733 extends Migration {

  override name = 'Migration20260910103733';

  override up(): void | Promise<void> {
    this.addSql(`alter table "ai_chat_message_item" drop constraint "ai_chat_message_item_rating_check";`);
    this.addSql(`alter table "ai_chat_message_item" alter column "rating" type boolean using (case when "rating" = 1 then true when "rating" = -1 then false else null end);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "ai_chat_message_item" alter column "rating" type int using (case when "rating" is true then 1 when "rating" is false then -1 else null end);`);
    this.addSql(`alter table "ai_chat_message_item" add constraint "ai_chat_message_item_rating_check" check (rating in (-1, 1));`);
  }

}
