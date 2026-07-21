import { Migration } from '@mikro-orm/migrations';

export class Migration20260721163000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "ai_agent_run_item" add column "created_at" timestamptz null;`,
    );
    this.addSql(
      `update "ai_agent_run_item" set "created_at" = coalesce("started_at", "updated_at", now()) where "created_at" is null;`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" alter column "created_at" set not null;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "ai_agent_run_item" drop column if exists "created_at";`,
    );
  }
}
