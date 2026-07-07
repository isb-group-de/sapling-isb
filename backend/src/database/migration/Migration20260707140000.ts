import { Migration } from '@mikro-orm/migrations';

export class Migration20260707140000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "company_item" alter column "street" drop not null;`,
    );
  }

  override down(): void {
    this.addSql(
      `update "company_item" set "street" = '' where "street" is null;`,
    );
    this.addSql(
      `alter table "company_item" alter column "street" set not null;`,
    );
  }
}
