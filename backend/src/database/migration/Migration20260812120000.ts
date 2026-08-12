import { Migration } from '@mikro-orm/migrations';

export class Migration20260812120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "contract_item"
       add column "contract_number" varchar(128) null;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "contract_item"
       drop column if exists "contract_number";`,
    );
  }
}
