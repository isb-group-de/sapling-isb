import { Migration } from '@mikro-orm/migrations';
export class Migration20260908150000 extends Migration {
  override up(): void {
    this.addSql(
      'alter table "favorite_item" add column "grouping" jsonb null;',
    );
  }
  override down(): void {
    this.addSql('alter table "favorite_item" drop column "grouping";');
  }
}
