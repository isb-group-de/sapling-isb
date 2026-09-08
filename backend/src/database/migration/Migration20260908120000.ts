import { Migration } from '@mikro-orm/migrations';

export class Migration20260908120000 extends Migration {
  override up(): void {
    this.addSql(
      'alter table email_delivery_item add column rule_snapshot jsonb null;',
    );
    this.addSql(
      'alter table event_delivery_item add column queue_wait_ms integer null, add column provider_duration_ms integer null;',
    );
    this.addSql(
      'alter table inbound_email_item add column prompt_manifest jsonb null;',
    );
    this.addSql(
      'alter table ai_agent_run_item add column purpose varchar(128) null;',
    );
    this.addSql(
      'alter table ai_provider_model_item add column is_default_markdown boolean not null default false;',
    );
    this.addSql(
      `create table ai_prompt_template_item (handle varchar(190) primary key, title varchar(256) not null, description text null, purpose varchar(128) not null, draft text not null, variables jsonb not null, published_version_handle integer null, updated_at timestamptz(6) not null);`,
    );
    this.addSql(
      `create table ai_prompt_version_item (handle serial primary key, template_handle varchar(190) not null constraint ai_prompt_version_item_template_handle_foreign references ai_prompt_template_item(handle) on delete restrict, version integer not null, content text not null, variables jsonb not null, change_note text null, author_handle integer null constraint ai_prompt_version_item_author_handle_foreign references person_item(handle) on delete set null, checksum varchar(64) not null, published_at timestamptz(6) not null, constraint ai_prompt_version_item_template_handle_version_unique unique(template_handle, version));`,
    );
    this.addSql(
      `alter table ai_prompt_template_item add constraint ai_prompt_template_item_published_version_handle_foreign foreign key (published_version_handle) references ai_prompt_version_item(handle) on delete restrict;`,
    );
    this.addSql(
      `alter table ai_chat_session_item add column prompt_manifest jsonb null;`,
    );
    this.addSql(
      `alter table ai_agent_run_item add column prompt_manifest jsonb null, add column evaluation_result jsonb null;`,
    );
    this.addSql(
      `alter table ai_agent_evaluation_item add column expectations jsonb null, add column tool_fixtures jsonb null;`,
    );
    this.addSql(
      `alter table automation_execution_item add column rule_snapshot jsonb null;`,
    );
    this.addSql(
      `create function sapling_immutable_prompt_version() returns trigger language plpgsql as $$ begin if TG_OP = 'DELETE' or NEW.handle is distinct from OLD.handle or NEW.change_note is distinct from OLD.change_note or (NEW.author_handle is not null and NEW.author_handle is distinct from OLD.author_handle) or NEW.content is distinct from OLD.content or NEW.variables is distinct from OLD.variables or NEW.template_handle is distinct from OLD.template_handle or NEW.version is distinct from OLD.version or NEW.checksum is distinct from OLD.checksum or NEW.published_at is distinct from OLD.published_at then raise exception 'Published prompt versions are immutable'; end if; return NEW; end $$;`,
    );
    this.addSql(
      `create trigger immutable_prompt_version before update or delete on ai_prompt_version_item for each row execute function sapling_immutable_prompt_version();`,
    );
  }

  override down(): void {
    this.addSql('alter table email_delivery_item drop column rule_snapshot;');
    this.addSql(
      'alter table event_delivery_item drop column queue_wait_ms, drop column provider_duration_ms;',
    );
    this.addSql('alter table inbound_email_item drop column prompt_manifest;');
    this.addSql('alter table ai_agent_run_item drop column purpose;');
    this.addSql(
      'alter table ai_provider_model_item drop column is_default_markdown;',
    );
    this.addSql(
      'alter table automation_execution_item drop column rule_snapshot;',
    );
    this.addSql(
      'alter table ai_agent_evaluation_item drop column expectations, drop column tool_fixtures;',
    );
    this.addSql(
      'alter table ai_agent_run_item drop column prompt_manifest, drop column evaluation_result;',
    );
    this.addSql(
      'alter table ai_chat_session_item drop column prompt_manifest;',
    );
    this.addSql(
      'alter table ai_prompt_template_item drop constraint ai_prompt_template_item_published_version_handle_foreign;',
    );
    this.addSql(
      'drop table ai_prompt_version_item; drop function sapling_immutable_prompt_version(); drop table ai_prompt_template_item;',
    );
  }
}
