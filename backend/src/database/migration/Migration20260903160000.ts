import { Migration } from '@mikro-orm/migrations';

export class Migration20260903160000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "email_subscription_condition_item" add column "group_order" int not null default 0;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "email_subscription_condition_item" drop column "group_order";`,
    );
  }
}
