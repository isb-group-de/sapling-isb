import { Migration } from '@mikro-orm/migrations';

export class Migration20260909120000 extends Migration {
  override up(): void {
    this.addSql(
      'alter table "ai_provider_model_item" add column "supports_vision" boolean not null default false;',
    );
  }
  override down(): void {
    this.addSql(
      'alter table "ai_provider_model_item" drop column "supports_vision";',
    );
  }
}
