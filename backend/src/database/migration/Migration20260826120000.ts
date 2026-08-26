import { Migration } from '@mikro-orm/migrations';

export class Migration20260826120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "ai_provider_model_item" add column "supports_web_search" boolean not null default false, add column "is_default_web_search" boolean not null default false;`,
    );
    this.addSql(
      `alter table "ai_agent_item" add column "web_search_provider_handle" varchar(64) null, add column "web_search_model_handle" varchar(64) null;`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" add column "web_search_provider_handle" varchar(64) null, add column "web_search_model_handle" varchar(64) null;`,
    );
    this.addSql(
      `alter table "ai_agent_item" add constraint "ai_agent_item_web_search_provider_handle_foreign" foreign key ("web_search_provider_handle") references "ai_provider_type_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_agent_item" add constraint "ai_agent_item_web_search_model_handle_foreign" foreign key ("web_search_model_handle") references "ai_provider_model_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" add constraint "ai_agent_version_item_web_search_provider_handle_foreign" foreign key ("web_search_provider_handle") references "ai_provider_type_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" add constraint "ai_agent_version_item_web_search_model_handle_foreign" foreign key ("web_search_model_handle") references "ai_provider_model_item" ("handle") on delete set null;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "ai_agent_item" drop constraint if exists "ai_agent_item_web_search_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_item" drop constraint if exists "ai_agent_item_web_search_model_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" drop constraint if exists "ai_agent_version_item_web_search_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" drop constraint if exists "ai_agent_version_item_web_search_model_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_item" drop column if exists "web_search_provider_handle", drop column if exists "web_search_model_handle";`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" drop column if exists "web_search_provider_handle", drop column if exists "web_search_model_handle";`,
    );
    this.addSql(
      `alter table "ai_provider_model_item" drop column if exists "supports_web_search", drop column if exists "is_default_web_search";`,
    );
  }
}
