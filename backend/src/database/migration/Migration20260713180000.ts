import { Migration } from '@mikro-orm/migrations';

export class Migration20260713180000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "sales_opportunity_item" add column "number" varchar(32) null;`,
    );
    this.addSql(
      `update "sales_opportunity_item" set "number" = 'SO-' || extract(year from "created_at")::int::text || '-' || lpad("handle"::text, 5, '0') where "number" is null;`,
    );

    this.addSql(
      `create table "inbound_email_status_item" ("handle" varchar(64) not null, "description" varchar(128) not null, "icon" varchar(64) not null default 'mdi-email-outline', "color" varchar(32) not null default '#607D8B', "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "inbound_email_status_item_pkey" primary key ("handle"));`,
    );
    this.addSql(
      `create table "email_inbox_processing_mode_item" ("handle" varchar(64) not null, "description" varchar(128) not null, "icon" varchar(64) not null default 'mdi-email-outline', "color" varchar(32) not null default '#1976D2', "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "email_inbox_processing_mode_item_pkey" primary key ("handle"));`,
    );

    this.addSql(
      `create table "email_inbox_subscription_item" ("handle" serial primary key, "description" varchar(128) not null, "mailbox_handle" int not null, "processing_person_handle" int not null, "agent_handle" varchar(64) null, "processing_mode_handle" varchar(64) not null, "context_markdown" text null, "automatic_processing" boolean not null default true, "is_active" boolean not null default true, "interval_minutes" int not null default 1, "import_existing_on_first_run" boolean not null default false, "last_run_at" timestamptz null, "last_success_at" timestamptz null, "last_received_at" timestamptz null, "last_error" varchar(1024) null, "imported_count" int not null default 0, "processed_count" int not null default 0, "manual_review_count" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `create index "email_inbox_subscription_due_index" on "email_inbox_subscription_item" ("is_active", "last_run_at");`,
    );
    this.addSql(
      `create index "email_inbox_subscription_mailbox_index" on "email_inbox_subscription_item" ("mailbox_handle");`,
    );
    this.addSql(
      `create index "email_inbox_subscription_person_index" on "email_inbox_subscription_item" ("processing_person_handle");`,
    );

    this.addSql(
      `create table "inbound_email_item" ("handle" serial primary key, "status_handle" varchar(64) not null default 'pending', "subject" varchar(512) not null, "from_address" varchar(320) not null, "from_name" varchar(256) null, "to_recipients" jsonb not null, "cc_recipients" jsonb null, "body_text" text null, "body_html" text null, "mailbox_handle" int not null, "subscription_handle" int not null, "person_handle" int null, "company_handle" int null, "ticket_handle" int null, "sales_opportunity_handle" int null, "office_task_handle" int null, "source_document_handle" int null, "provider" varchar(32) not null, "provider_message_id" varchar(512) not null, "internet_message_id" varchar(512) null, "conversation_id" varchar(512) null, "in_reply_to" varchar(512) null, "references" jsonb null, "headers" jsonb null, "received_at" timestamptz not null, "processing_attempts" int not null default 0, "processing_message" varchar(1024) null, "processing_log" jsonb null, "agent_handle" varchar(64) null, "ai_session_handle" int null, "ai_message_handle" int null, "processed_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "inbound_email_item_mailbox_provider_message_unique" unique ("mailbox_handle", "provider_message_id"), constraint "inbound_email_item_source_document_unique" unique ("source_document_handle"));`,
    );
    this.addSql(
      `create index "inbound_email_status_received_index" on "inbound_email_item" ("status_handle", "received_at");`,
    );
    this.addSql(
      `create index "inbound_email_person_received_index" on "inbound_email_item" ("person_handle", "received_at");`,
    );
    this.addSql(
      `create index "inbound_email_company_received_index" on "inbound_email_item" ("company_handle", "received_at");`,
    );
    this.addSql(
      `create index "inbound_email_conversation_index" on "inbound_email_item" ("provider", "conversation_id");`,
    );
    this.addSql(
      `create index "inbound_email_subscription_received_index" on "inbound_email_item" ("subscription_handle", "received_at");`,
    );
    this.addSql(
      `create index "inbound_email_ticket_received_index" on "inbound_email_item" ("ticket_handle", "received_at");`,
    );
    this.addSql(
      `create index "inbound_email_sales_opportunity_received_index" on "inbound_email_item" ("sales_opportunity_handle", "received_at");`,
    );
    this.addSql(
      `create index "inbound_email_office_task_received_index" on "inbound_email_item" ("office_task_handle", "received_at");`,
    );

    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_mailbox_foreign" foreign key ("mailbox_handle") references "shared_mailbox_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_person_foreign" foreign key ("processing_person_handle") references "person_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_agent_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_processing_mode_foreign" foreign key ("processing_mode_handle") references "email_inbox_processing_mode_item" ("handle") on update cascade;`,
    );

    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_status_foreign" foreign key ("status_handle") references "inbound_email_status_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_mailbox_foreign" foreign key ("mailbox_handle") references "shared_mailbox_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_subscription_foreign" foreign key ("subscription_handle") references "email_inbox_subscription_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_person_foreign" foreign key ("person_handle") references "person_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_company_foreign" foreign key ("company_handle") references "company_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_ticket_foreign" foreign key ("ticket_handle") references "ticket_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_sales_opportunity_foreign" foreign key ("sales_opportunity_handle") references "sales_opportunity_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_office_task_foreign" foreign key ("office_task_handle") references "event_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_source_document_foreign" foreign key ("source_document_handle") references "document_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_agent_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_ai_session_foreign" foreign key ("ai_session_handle") references "ai_chat_session_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_ai_message_foreign" foreign key ("ai_message_handle") references "ai_chat_message_item" ("handle") on update cascade on delete set null;`,
    );
  }

  override down(): void {
    this.addSql(`drop table if exists "inbound_email_item" cascade;`);
    this.addSql(
      `drop table if exists "email_inbox_subscription_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "email_inbox_processing_mode_item" cascade;`,
    );
    this.addSql(`drop table if exists "inbound_email_status_item" cascade;`);
    this.addSql(
      `alter table "sales_opportunity_item" drop column if exists "number";`,
    );
  }
}
