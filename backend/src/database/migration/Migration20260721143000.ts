import { Migration } from '@mikro-orm/migrations';

export class Migration20260721143000 extends Migration {
  override up(): void {
    this.makeReferenceOptional(
      'event_item',
      'type_handle',
      'event_item_type_handle_foreign',
      'event_type_item',
    );
    this.makeReferenceOptional(
      'event_item',
      'status_handle',
      'event_item_status_handle_foreign',
      'event_status_item',
    );
    this.makeReferenceOptional(
      'ticket_item',
      'status_handle',
      'ticket_item_status_handle_foreign',
      'ticket_status_item',
    );
    this.makeReferenceOptional(
      'ticket_item',
      'priority_handle',
      'ticket_item_priority_handle_foreign',
      'ticket_priority_item',
    );
    this.makeReferenceOptional(
      'effort_estimate_item',
      'status_handle',
      'effort_estimate_item_status_handle_foreign',
      'effort_estimate_status_item',
    );
    this.makeReferenceOptional(
      'internal_case_item',
      'status_handle',
      'internal_case_item_status_handle_foreign',
      'internal_case_status_item',
    );
    this.makeReferenceOptional(
      'knowledge_article_item',
      'status_handle',
      'knowledge_article_item_status_handle_foreign',
      'knowledge_article_status_item',
    );
    this.makeReferenceOptional(
      'knowledge_article_item',
      'visibility_handle',
      'knowledge_article_item_visibility_handle_foreign',
      'knowledge_article_visibility_item',
    );
  }

  override down(): void {
    this.addSql(
      `insert into "event_type_item" ("handle", "title", "icon", "color", "show_in_default_calendar", "created_at", "updated_at") values ('internal', 'Internal', 'mdi-calendar', '#4CAF50', true, now(), now()) on conflict ("handle") do nothing;`,
    );
    this.addSql(
      `insert into "event_status_item" ("handle", "description", "color", "is_open", "created_at", "updated_at") values ('scheduled', 'Scheduled', '#4CAF50', true, now(), now()) on conflict ("handle") do nothing;`,
    );
    this.addSql(
      `insert into "ticket_status_item" ("handle", "description", "color", "icon", "is_open", "created_at", "updated_at") values ('open', 'Open', '#4CAF50', 'mdi-new-box', true, now(), now()) on conflict ("handle") do nothing;`,
    );
    this.addSql(
      `insert into "ticket_priority_item" ("handle", "description", "color", "icon", "created_at", "updated_at") values ('normal', 'Normal', '#4CAF50', 'mdi-chevron-down', now(), now()) on conflict ("handle") do nothing;`,
    );
    this.addSql(
      `insert into "effort_estimate_status_item" ("handle", "description", "color", "icon", "created_at", "updated_at") values ('new', 'New', '#4CAF50', 'mdi-new-box', now(), now()) on conflict ("handle") do nothing;`,
    );
    this.addSql(
      `insert into "internal_case_status_item" ("handle", "description", "color", "icon", "is_open", "created_at", "updated_at") values ('open', 'Open', '#4CAF50', 'mdi-clipboard-text-outline', true, now(), now()) on conflict ("handle") do nothing;`,
    );
    this.addSql(
      `insert into "knowledge_article_status_item" ("handle", "description", "color", "icon", "sort_order", "is_published", "is_archived", "created_at", "updated_at") values ('draft', 'Draft', '#607D8B', 'mdi-file-document-outline', 100, false, false, now(), now()) on conflict ("handle") do nothing;`,
    );
    this.addSql(
      `insert into "knowledge_article_visibility_item" ("handle", "description", "color", "icon", "sort_order", "created_at", "updated_at") values ('internal', 'Internal', '#607D8B', 'mdi-eye-outline', 100, now(), now()) on conflict ("handle") do nothing;`,
    );

    this.restoreRequiredReference(
      'event_item',
      'type_handle',
      'internal',
      'event_item_type_handle_foreign',
      'event_type_item',
    );
    this.restoreRequiredReference(
      'event_item',
      'status_handle',
      'scheduled',
      'event_item_status_handle_foreign',
      'event_status_item',
    );
    this.restoreRequiredReference(
      'ticket_item',
      'status_handle',
      'open',
      'ticket_item_status_handle_foreign',
      'ticket_status_item',
    );
    this.restoreRequiredReference(
      'ticket_item',
      'priority_handle',
      'normal',
      'ticket_item_priority_handle_foreign',
      'ticket_priority_item',
    );
    this.restoreRequiredReference(
      'effort_estimate_item',
      'status_handle',
      'new',
      'effort_estimate_item_status_handle_foreign',
      'effort_estimate_status_item',
    );
    this.restoreRequiredReference(
      'internal_case_item',
      'status_handle',
      'open',
      'internal_case_item_status_handle_foreign',
      'internal_case_status_item',
    );
    this.restoreRequiredReference(
      'knowledge_article_item',
      'status_handle',
      'draft',
      'knowledge_article_item_status_handle_foreign',
      'knowledge_article_status_item',
    );
    this.restoreRequiredReference(
      'knowledge_article_item',
      'visibility_handle',
      'internal',
      'knowledge_article_item_visibility_handle_foreign',
      'knowledge_article_visibility_item',
    );
  }

  private makeReferenceOptional(
    table: string,
    column: string,
    constraint: string,
    targetTable: string,
  ): void {
    this.addSql(
      `alter table "${table}" drop constraint if exists "${constraint}";`,
    );
    this.addSql(
      `alter table "${table}" alter column "${column}" drop not null, alter column "${column}" drop default;`,
    );
    this.addSql(
      `alter table "${table}" add constraint "${constraint}" foreign key ("${column}") references "${targetTable}" ("handle") on delete set null;`,
    );
  }

  private restoreRequiredReference(
    table: string,
    column: string,
    defaultHandle: string,
    constraint: string,
    targetTable: string,
  ): void {
    this.addSql(
      `alter table "${table}" drop constraint if exists "${constraint}";`,
    );
    this.addSql(
      `update "${table}" set "${column}" = '${defaultHandle}' where "${column}" is null;`,
    );
    this.addSql(
      `alter table "${table}" alter column "${column}" set default '${defaultHandle}', alter column "${column}" set not null;`,
    );
    this.addSql(
      `alter table "${table}" add constraint "${constraint}" foreign key ("${column}") references "${targetTable}" ("handle");`,
    );
  }
}
