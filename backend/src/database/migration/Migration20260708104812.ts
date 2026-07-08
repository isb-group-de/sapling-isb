import { Migration } from '@mikro-orm/migrations';

export class Migration20260708104812 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`CREATE EXTENSION IF NOT EXISTS vector;`);

    this.addSql(
      `create table "address_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-map-marker-outline', "color" varchar(32) not null default '#546E7A', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "ai_provider_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-robot-outline', "color" varchar(32) not null default '#546E7A', "credential_types" jsonb null, "credentials" jsonb null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "ai_provider_model_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" varchar(512) null, "provider_handle" varchar(64) not null, "provider_model" varchar(128) not null, "supports_streaming" boolean not null default true, "supports_tools" boolean not null default false, "supports_embeddings" boolean not null default false, "supports_transcription" boolean not null default false, "embedding_batch_size" int not null default 32, "vector_chunk_length" int not null default 1200, "vector_chunk_overlap" int not null default 200, "vector_search_candidate_multiplier" int not null default 6, "vector_search_max_candidate_limit" int not null default 60, "vector_search_max_results" int not null default 10, "supports_speech" boolean not null default false, "speech_voice" varchar(64) not null default 'nova', "speech_speed" real not null default 1, "speech_mime_type" varchar(128) not null default 'audio/mpeg', "speech_file_extension" varchar(16) not null default 'mp3', "speech_max_input_length" int not null default 4000, "max_tool_call_iterations" int not null default 100, "is_default" boolean not null default false, "is_active" boolean not null default true, "sort_order" int null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "ai_agent_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" text null, "icon" varchar(64) null, "color" varchar(32) null, "prompt_markdown" text not null, "welcome_message" text null, "conversation_starters" jsonb null, "provider_handle" varchar(64) null, "model_handle" varchar(64) null, "allowed_entity_handles" jsonb null, "allowed_knowledge_entity_handles" jsonb null, "allowed_internal_tools" jsonb null, "allowed_external_tools" jsonb null, "mutation_mode" varchar(16) not null default 'confirm', "is_active" boolean not null default true, "is_default" boolean not null default false, "sort_order" int not null default 100, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "ai_agent_version_item" ("handle" serial primary key, "agent_handle" varchar(64) not null, "version" int not null default 1, "status" varchar(16) not null default 'draft', "prompt_markdown" text not null, "changelog" text null, "provider_handle" varchar(64) null, "model_handle" varchar(64) null, "allowed_entity_handles" jsonb null, "allowed_knowledge_entity_handles" jsonb null, "allowed_internal_tools" jsonb null, "allowed_external_tools" jsonb null, "activated_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ai_agent_playbook_item" ("handle" varchar(64) not null, "agent_handle" varchar(64) not null, "title" varchar(160) not null, "description" text null, "trigger_entity_handles" jsonb null, "steps" jsonb not null, "expected_output" text null, "is_active" boolean not null default true, "sort_order" int not null default 100, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "ai_agent_memory_item" ("handle" serial primary key, "agent_handle" varchar(64) not null, "type" varchar(32) not null, "title" varchar(160) not null, "content_markdown" text not null, "entity_scope_handles" jsonb null, "is_active" boolean not null default true, "sort_order" int not null default 100, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ai_agent_evaluation_item" ("handle" serial primary key, "agent_handle" varchar(64) not null, "agent_version_handle" int null, "title" varchar(160) not null, "prompt" text not null, "expected_criteria" text null, "target_entity_handle" varchar(64) null, "target_record_handle" varchar(128) null, "status" varchar(32) not null default 'needsReview', "rating" varchar(255) null, "comment" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ai_vector_document_item" ("handle" serial primary key, "source_entity_handle" varchar(64) not null, "source_record_handle" varchar(128) not null, "source_section" varchar(64) not null, "chunk_index" int not null default 0, "title" varchar(256) null, "content" text not null, "content_hash" varchar(64) not null, "metadata" jsonb null, "provider_handle" varchar(64) not null, "model_handle" varchar(128) not null, "embedding_dimensions" int not null, "embedding" vector not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "ai_vector_document_item" add constraint "ai_vector_document_item_source_entity_handle_sour_09f0c_unique" unique ("source_entity_handle", "source_record_handle", "source_section", "chunk_index");`,
    );

    this.addSql(
      `create table "change_log_action_item" ("handle" varchar(32) not null, "title" varchar(128) not null, "description" varchar(256) null, "icon" varchar(64) not null default 'mdi-pencil-circle-outline', "color" varchar(32) not null default '#546E7A', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "company_annual_revenue_class_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-cash-multiple', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "company_churn_risk_reason_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" varchar(512) null, "icon" varchar(64) not null default 'mdi-alert-outline', "color" varchar(32) not null default '#EF6C00', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "company_industry_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-factory', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "company_relationship_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-family-tree', "color" varchar(32) not null default '#00897B', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "company_segment_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-account-group-outline', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "company_size_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-office-building', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "contract_service_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-shield-check-outline', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "custom_field_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-form-textbox', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "document_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "effort_estimate_position_template_item" ("handle" serial primary key, "title" varchar(128) not null, "description" varchar(256) null, "estimated_hours" real null, "offer_text_markdown" text not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "effort_estimate_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "color" varchar(16) not null, "icon" varchar(64) not null default 'mdi-new-box', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "email_delivery_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "icon" varchar(64) not null default 'mdi-email-outline', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "entity_group_item" ("handle" varchar(64) not null, "icon" varchar(64) not null default 'mdi-folder', "is_expanded" boolean not null default true, "sort_order" int not null default 0, "parent_handle" varchar(64) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "entity_item" ("handle" varchar(64) not null, "icon" varchar(64) not null default 'square-rounded', "sort_order" int not null default 0, "can_read" boolean not null default true, "can_insert" boolean not null default false, "can_update" boolean not null default false, "can_delete" boolean not null default false, "can_show" boolean not null default false, "group_handle" varchar(64) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "email_template_item" ("handle" serial primary key, "name" varchar(128) not null, "description" varchar(256) null, "subject_template" varchar(256) not null, "body_markdown" varchar(8192) not null, "is_default" boolean not null default false, "is_active" boolean not null default true, "entity_handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "email_list_item" ("handle" serial primary key, "title" varchar(128) not null, "mail_template_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "custom_field_definition_item" ("handle" serial primary key, "entity_handle" varchar(64) not null, "field_key" varchar(96) not null, "label" varchar(128) not null, "field_type_handle" varchar(64) not null, "is_required" boolean not null default false, "is_active" boolean not null default true, "field_order" int not null default 0, "form_visible" boolean not null default true, "table_visible" boolean not null default false, "mobile_visible" boolean not null default false, "select_options" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "custom_field_definition_item" add constraint "custom_field_definition_item_entity_handle_field_key_unique" unique ("entity_handle", "field_key");`,
    );

    this.addSql(
      `create table "custom_field_value_item" ("handle" serial primary key, "entity_handle" varchar(64) not null, "definition_handle" int not null, "record_reference" varchar(64) not null, "value_string" text null, "value_number" real null, "value_boolean" boolean null default false, "value_date" date null, "value_date_time" timestamptz null, "value_json" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "custom_field_value_item" add constraint "custom_field_value_item_entity_handle_record_refe_5605f_unique" unique ("entity_handle", "record_reference", "definition_handle");`,
    );

    this.addSql(
      `create table "ai_entity_generation_template_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "action_name" varchar(128) not null, "source_entity_handle" varchar(64) not null, "target_entity_handle" varchar(64) not null, "source_relations" jsonb null, "prompt_markdown" text not null, "field_mapping" jsonb null, "source_field_mapping" jsonb null, "target_defaults" jsonb null, "source_reference_field" varchar(128) null, "user_reference_field" varchar(128) null, "provider_handle" varchar(64) null, "model_handle" varchar(64) null, "is_active" boolean not null default true, "sort_order" int not null default 100, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "entity_route_item" ("handle" serial primary key, "route" varchar(64) not null, "navigation" varchar(128) null, "entity_handle" varchar(64) null, "group_handle" varchar(64) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "event_delivery_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "event_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "color" varchar(16) not null, "is_open" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "event_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "show_in_default_calendar" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "favorite_template_item" ("handle" serial primary key, "name" varchar(128) not null, "entity_handle" varchar(64) not null, "entity_route_handle" int null, "filter" jsonb null, "is_recommended" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "holiday_group_item" ("handle" serial primary key, "title" varchar(128) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "holiday_item" ("handle" serial primary key, "title" varchar(128) not null, "description" varchar(1024) null, "group_handle" int not null, "start_date" timestamptz not null, "end_date" timestamptz not null, "is_all_day" boolean not null default true, "icon" varchar(64) not null default 'mdi-calendar-alert', "color" varchar(32) not null default '#C62828', "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "import_source_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "import_template_item" ("handle" serial primary key, "title" varchar(128) not null, "description" text null, "source_handle" varchar(64) not null, "target_entity_handle" varchar(64) not null, "is_active" boolean not null default true, "mapping" jsonb not null, "external_key_columns" jsonb null, "generic_reference_mapping" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "import_template_value_mapping_item" ("handle" serial primary key, "import_template_handle" int not null, "target_field" varchar(128) not null, "source_value" text not null, "target_value" text not null, "fallback" varchar(16) not null default 'keep', "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "inbox_template_item" ("handle" serial primary key, "name" varchar(128) not null, "description" varchar(256) null, "title_template" varchar(256) not null, "body_markdown" varchar(8192) not null, "is_default" boolean not null default false, "is_active" boolean not null default true, "entity_handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "internal_case_category_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-shape-outline', "color" varchar(32) not null default '#5C6BC0', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "internal_case_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "color" varchar(16) not null, "icon" varchar(64) not null default 'mdi-clipboard-text-outline', "is_open" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "knowledge_article_category_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" varchar(256) null, "icon" varchar(64) not null default 'mdi-shape-outline', "color" varchar(32) not null default '#607D8B', "sort_order" int not null default 100, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "knowledge_article_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "color" varchar(32) not null, "icon" varchar(64) not null default 'mdi-file-document-outline', "sort_order" int not null default 100, "is_published" boolean not null default false, "is_archived" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "knowledge_article_visibility_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "color" varchar(32) not null, "icon" varchar(64) not null default 'mdi-eye-outline', "sort_order" int not null default 100, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "kpi_aggregation_item" ("handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "kpi_timeframe_item" ("handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "kpi_type_item" ("handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "kpi_item" ("handle" serial primary key, "name" varchar(128) not null, "description" varchar(256) null, "aggregation_handle" varchar(64) not null, "field" varchar(128) not null, "type_handle" varchar(64) not null default 'ITEM', "timeframe_field" varchar(128) null, "timeframe_handle" varchar(64) null, "timeframe_interval_handle" varchar(64) null, "filter" jsonb null, "group_by" jsonb null, "relation_field" varchar(128) null, "relation_handle" varchar(64) null, "target_entity_handle" varchar(64) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "language_item" ("handle" varchar(64) not null, "name" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );
    this.addSql(
      `alter table "language_item" add constraint "language_item_name_unique" unique ("name");`,
    );

    this.addSql(
      `create table "marketing_campaign_status_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-calendar-clock', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "marketing_campaign_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-bullhorn-outline', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "mcp_server_config_item" ("handle" serial primary key, "name" varchar(128) not null, "description" varchar(512) null, "transport" varchar(32) not null default 'http', "is_active" boolean not null default true, "endpoint" varchar(512) null, "command" varchar(512) null, "args" jsonb null, "environment" jsonb null, "headers" jsonb null, "auth_config" jsonb null, "allowed_tools" jsonb null, "timeout_ms" varchar(255) null, "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "money_item" ("handle" varchar(16) not null, "name" varchar(64) not null, "symbol" varchar(8) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );
    this.addSql(
      `alter table "money_item" add constraint "money_item_name_unique" unique ("name");`,
    );

    this.addSql(
      `create table "country_item" ("handle" varchar(64) not null, "name" varchar(256) not null, "dialing_code" varchar(8) null, "language_handle" varchar(64) null default 'en', "money_handle" varchar(16) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "note_group_item" ("handle" varchar(64) not null, "icon" varchar(64) not null default 'mdi-folder', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "person_decision_role_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-account-check-outline', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "person_department_item" ("handle" varchar(64) not null, "description" varchar(128) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "person_function_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-account-tie-outline', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "person_job_title_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-briefcase-account-outline', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "person_salutation_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-card-account-details-outline', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "person_title_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-school-outline', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "person_type_item" ("handle" varchar(64) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "product_item" ("handle" serial primary key, "title" varchar(128) not null, "name" varchar(64) not null, "version" varchar(32) null default '1.0.0', "description" varchar(512) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "role_stage_item" ("handle" varchar(64) not null, "title" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "role_item" ("handle" serial primary key, "title" varchar(64) not null, "is_administrator" boolean not null default false, "stage_handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "role_item_starter_favorite_templates" ("role_item_handle" int not null, "favorite_template_item_handle" int not null, primary key ("role_item_handle", "favorite_template_item_handle"));`,
    );

    this.addSql(
      `create table "permission_item" ("handle" serial primary key, "allow_read" boolean not null default true, "allow_insert" boolean not null default true, "allow_update" boolean not null default true, "allow_delete" boolean not null default true, "allow_show" boolean not null default true, "entity_handle" varchar(64) not null, "role_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "permission_item" add constraint "permission_item_entity_handle_role_handle_unique" unique ("entity_handle", "role_handle");`,
    );

    this.addSql(
      `create table "ai_agent_memory_item_roles" ("ai_agent_memory_item_handle" int not null, "role_item_handle" int not null, primary key ("ai_agent_memory_item_handle", "role_item_handle"));`,
    );

    this.addSql(
      `create table "ai_agent_item_roles" ("ai_agent_item_handle" varchar(64) not null, "role_item_handle" int not null, primary key ("ai_agent_item_handle", "role_item_handle"));`,
    );

    this.addSql(
      `create table "sales_opportunity_forecast_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "sales_opportunity_loss_reason_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" varchar(512) null, "icon" varchar(64) not null default 'mdi-close-circle-outline', "color" varchar(32) not null default '#9E9E9E', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "sales_opportunity_result_status_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "is_closed" boolean not null default false, "is_success" boolean not null default false, "is_open" boolean not null default true, "icon" varchar(64) not null default 'mdi-circle-outline', "color" varchar(32) not null default '#546E7A', "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "sales_opportunity_source_item" ("handle" serial primary key, "title" varchar(128) not null, "name" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "sales_opportunity_stage_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" varchar(256) null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "sort_order" int not null default 0, "default_probability" real not null default 0, "is_closed" boolean not null default false, "is_success" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "script_button_item" ("handle" serial primary key, "name" varchar(128) not null, "title" varchar(128) not null, "parameter" jsonb null, "is_multi_select" boolean not null default false, "entity_handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "seed_script_item" ("handle" serial primary key, "script_name" varchar(256) not null, "entity_handle" varchar(64) not null, "executed_at" timestamptz not null, "is_success" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "server_landscape_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-server', "color" varchar(32) not null default '#1565C0', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "server_landscape_type_usage_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-console-network', "color" varchar(32) not null default '#2E7D32', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "session_store_item" ("handle" varchar(255) not null, "payload" jsonb not null, "expires_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );
    this.addSql(
      `create index "session_store_item_expires_at_index" on "session_store_item" ("expires_at");`,
    );

    this.addSql(
      `create table "shared_mailbox_group_item" ("handle" serial primary key, "title" varchar(128) not null, "description" varchar(256) null, "icon" varchar(64) not null default 'mdi-email-lock-outline', "color" varchar(32) not null default '#1565C0', "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "shared_mailbox_item" ("handle" serial primary key, "title" varchar(128) not null, "email" varchar(256) not null, "description" varchar(256) null, "provider_handle" varchar(64) not null default 'azure', "is_active" boolean not null default true, "group_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "sla_policy_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" varchar(256) null, "first_response_hours" int not null default 8, "resolution_hours" int not null default 40, "icon" varchar(64) not null default 'mdi-timer-sand', "color" varchar(32) not null default '#E53935', "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "social_media_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-web', "color" varchar(32) not null default '#1E88E5', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "support_team_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" varchar(256) null, "icon" varchar(64) not null default 'mdi-account-group-outline', "color" varchar(32) not null default '#3949AB', "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "support_queue_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "description" varchar(256) null, "icon" varchar(64) not null default 'mdi-inbox-arrow-down-outline', "color" varchar(32) not null default '#00897B', "is_active" boolean not null default true, "team_handle" varchar(64) not null, "default_sla_policy_handle" varchar(64) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "teams_delivery_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "icon" varchar(64) not null default 'mdi-microsoft-teams', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "teams_template_item" ("handle" serial primary key, "name" varchar(128) not null, "description" varchar(256) null, "body_markdown" varchar(8192) not null, "is_default" boolean not null default false, "is_active" boolean not null default true, "entity_handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ticket_priority_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "color" varchar(16) not null, "icon" varchar(64) not null default 'mdi-chevron-down', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "ticket_source_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-email-outline', "color" varchar(32) not null default '#00897B', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "ticket_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "color" varchar(16) not null, "icon" varchar(64) not null default 'mdi-new-box', "is_open" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "ticket_type_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-alert-circle-outline', "color" varchar(32) not null default '#F44336', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "ticket_category_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-shape-outline', "color" varchar(32) not null default '#5C6BC0', "type_handle" varchar(64) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "translation_item" ("handle" serial primary key, "entity" varchar(64) not null, "property" varchar(64) not null, "value" varchar(1024) not null, "language_handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "translation_item" add constraint "translation_item_entity_property_language_handle_unique" unique ("entity", "property", "language_handle");`,
    );

    this.addSql(
      `create table "webhook_authentication_api_key_item" ("handle" serial primary key, "description" varchar(128) not null, "header_name" varchar(128) not null, "api_key" varchar(256) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "webhook_authentication_basic_item" ("handle" serial primary key, "description" varchar(128) not null, "username" varchar(64) not null, "password" varchar(64) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "webhook_authentication_oauth2item" ("handle" serial primary key, "description" varchar(128) not null, "client_id" varchar(128) not null, "client_secret" varchar(256) null, "token_url" varchar(256) not null, "scope" varchar(256) null, "parameters" jsonb null, "cached_token" varchar(2048) null, "token_expires_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "webhook_authentication_type_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "webhook_delivery_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "webhook_subscription_method_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "webhook_subscription_payload_type" ("handle" varchar(64) not null, "description" varchar(64) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "webhook_subscription_type_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "icon" varchar(64) not null default 'mdi-calendar', "color" varchar(32) not null default '#4CAF50', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("handle"));`,
    );

    this.addSql(
      `create table "webhook_subscription_item" ("handle" serial primary key, "description" varchar(128) not null, "custom_headers" jsonb null, "container_name" varchar(128) null, "relations" jsonb null, "payload_type_handle" varchar(64) not null default 'list', "url" varchar(256) not null, "is_active" boolean not null default true, "authentication_type_handle" varchar(64) null default 'none', "authentication_api_key_handle" int null, "authentication_oauth2_handle" int null, "authentication_basic_handle" int null, "signing_secret" varchar(128) null, "entity_handle" varchar(64) not null, "type_handle" varchar(64) not null default 'afterInsert', "method_handle" varchar(64) not null default 'post', "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "webhook_delivery_item" ("handle" serial primary key, "status_handle" varchar(64) null default 'pending', "subscription_handle" int not null, "payload" jsonb not null, "request_headers" jsonb null, "response_status_code" int null default 200, "response_body" jsonb null, "response_headers" jsonb null, "completed_at" timestamptz null, "attempt_count" int not null default 0, "next_retry_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "teams_subscription_item" ("handle" serial primary key, "description" varchar(128) not null, "recipient_field" varchar(64) not null, "is_active" boolean not null default true, "entity_handle" varchar(64) not null, "type_handle" varchar(64) not null default 'afterInsert', "template_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "inbox_subscription_item" ("handle" serial primary key, "description" varchar(128) not null, "recipient_field" varchar(64) not null, "is_active" boolean not null default true, "entity_handle" varchar(64) not null, "type_handle" varchar(64) not null default 'afterInsert', "template_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "work_hour_item" ("handle" serial primary key, "title" varchar(64) not null, "time_from" time(0) not null, "time_to" time(0) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "work_hour_week_item" ("handle" serial primary key, "title" varchar(64) not null, "monday_handle" int null, "tuesday_handle" int null, "wednesday_handle" int null, "thursday_handle" int null, "friday_handle" int null, "saturday_handle" int null, "sunday_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "company_item" ("handle" serial primary key, "name" varchar(128) not null, "street" varchar(128) null, "zip" varchar(16) null, "city" varchar(64) null, "phone" varchar(32) null, "mobile" varchar(32) null, "email" varchar(128) null, "website" varchar(128) null, "is_active" boolean not null default true, "allow_newsletter" boolean not null default true, "data_privacy_consent_given" boolean not null default false, "data_privacy_consent_at" date null, "employee_count" int null, "contract_value" real null, "annual_recurring_revenue" real null, "monthly_recurring_revenue" real null, "country_handle" varchar(64) not null default 'DE', "account_manager_handle" int null, "customer_success_manager_handle" int null, "industry_handle" varchar(64) null, "segment_handle" varchar(64) null, "size_handle" varchar(64) null, "annual_revenue_class_handle" varchar(64) null, "churn_risk_reason_handle" varchar(64) null, "work_week_handle" int null, "holiday_group_handle" int null, "service_provider_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_name_unique" unique ("name");`,
    );

    this.addSql(
      `create table "server_landscape_item" ("handle" serial primary key, "server_name" varchar(128) not null, "description" varchar(512) null, "allow_remote_access" boolean not null default false, "has_internet_access" boolean not null default true, "type_handle" varchar(64) not null, "usage_handle" varchar(64) not null, "company_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "person_item" ("handle" serial primary key, "first_name" varchar(64) null, "last_name" varchar(64) not null, "login_name" varchar(64) null, "login_password" varchar(128) null, "phone" varchar(32) null, "mobile" varchar(32) null, "email" varchar(128) null, "birth_day" date null, "require_password_change" boolean not null default false, "is_active" boolean not null default true, "send_newsletter" boolean not null default true, "color" varchar(32) not null default '#4CAF50', "company_handle" int null, "salutation_handle" varchar(64) null, "title_handle" varchar(64) null, "job_title_handle" varchar(64) null, "job_function_handle" varchar(64) null, "decision_role_handle" varchar(64) null, "type_handle" varchar(64) null default 'sapling', "department_handle" varchar(64) null, "language_handle" varchar(64) null default 'de', "work_week_handle" int null, "holiday_group_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_login_name_unique" unique ("login_name");`,
    );

    this.addSql(
      `create table "teams_delivery_item" ("handle" serial primary key, "status_handle" varchar(64) null default 'pending', "subscription_handle" int not null, "template_handle" int null, "entity_handle" varchar(64) not null, "created_by_handle" int not null, "recipient_person_handle" int null, "reference_handle" varchar(64) null, "provider" varchar(32) not null default 'azure', "body_markdown" varchar(8192) not null, "body_html" varchar(16384) not null, "request_payload" jsonb null, "response_status_code" int null, "response_body" jsonb null, "provider_message_id" varchar(256) null, "completed_at" timestamptz null, "attempt_count" int not null default 0, "next_retry_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "social_media_item" ("handle" serial primary key, "title" varchar(128) null, "url" varchar(256) not null, "username" varchar(64) null, "external_id" varchar(128) null, "is_primary" boolean not null default false, "is_public" boolean not null default true, "notes" varchar(256) null, "person_handle" int not null, "type_handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "shared_mailbox_group_item_persons" ("shared_mailbox_group_item_handle" int not null, "person_item_handle" int not null, primary key ("shared_mailbox_group_item_handle", "person_item_handle"));`,
    );

    this.addSql(
      `create table "sapling_form_config_item" ("handle" serial primary key, "name" varchar(128) not null, "entity_handle" varchar(64) not null, "scope" varchar(16) not null default 'global', "scope_handle" varchar(64) null, "is_active" boolean not null default true, "is_default" boolean not null default false, "version" int not null default 1, "config" jsonb not null, "person_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "sales_opportunity_item" ("handle" serial primary key, "title" varchar(128) not null, "description" text null, "expected_revenue" real null, "probability" real null, "close_date" date null, "next_step" varchar(256) null, "pain_points" text null, "is_active" boolean not null default true, "type_handle" varchar(64) not null default 'new', "forecast_handle" varchar(64) not null default 'pipeline', "source_handle" int not null, "result_status_handle" varchar(64) not null default 'open', "loss_reason_handle" varchar(64) null, "assignee_company_handle" int null, "assignee_person_handle" int null, "creator_company_handle" int not null, "creator_person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "sales_opportunity_item_competitors" ("sales_opportunity_item_handle" int not null, "company_item_handle" int not null, primary key ("sales_opportunity_item_handle", "company_item_handle"));`,
    );

    this.addSql(
      `create table "phone_call_item" ("handle" serial primary key, "phone_number" varchar(64) not null, "note" text null, "reached" boolean not null default false, "entity_handle" varchar(64) not null, "reference" varchar(128) not null, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "person_session_item" ("handle" serial primary key, "number" varchar(128) not null, "access_token" text not null, "refresh_token" text not null, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "person_session_item" add constraint "person_session_item_person_handle_unique" unique ("person_handle");`,
    );

    this.addSql(
      `create table "person_passkey_item" ("handle" serial primary key, "label" varchar(128) not null, "credential_id" varchar(512) not null, "public_key" text not null, "counter" int not null default 0, "transports" jsonb null, "credential_device_type" varchar(32) null, "credential_backed_up" boolean not null default false, "last_used_at" timestamptz null, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "person_passkey_item" add constraint "person_passkey_item_credential_id_unique" unique ("credential_id");`,
    );

    this.addSql(
      `create table "person_api_token_item" ("handle" serial primary key, "description" varchar(128) not null, "token_prefix" varchar(24) not null, "token_hash" varchar(128) not null, "is_active" boolean not null default true, "expires_at" timestamptz not null, "last_used_at" timestamptz null, "allowed_ips" jsonb null, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "person_api_token_item" add constraint "person_api_token_item_token_hash_unique" unique ("token_hash");`,
    );

    this.addSql(
      `create table "person_item_roles" ("person_item_handle" int not null, "role_item_handle" int not null, primary key ("person_item_handle", "role_item_handle"));`,
    );

    this.addSql(
      `create table "note_item" ("handle" serial primary key, "title" varchar(128) not null, "description" varchar(1024) null, "person_handle" int null, "group_handle" varchar(64) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "marketing_campaign_item" ("handle" serial primary key, "name" varchar(128) not null, "description" text null, "start_date" date null, "end_date" date null, "is_active" boolean not null default true, "status_handle" varchar(64) not null default 'planned', "type_handle" varchar(64) not null default 'newsletter', "target_list_handle" int null, "email_template_handle" int null, "owner_person_handle" int null, "opportunity_source_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "information_item" ("handle" serial primary key, "reference" varchar(64) not null, "content" text not null, "entity_handle" varchar(64) not null, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "information_item" add constraint "information_item_entity_handle_reference_unique" unique ("entity_handle", "reference");`,
    );

    this.addSql(
      `create table "inbox_notification_item" ("handle" serial primary key, "entity_handle" varchar(64) not null, "subscription_handle" int not null, "template_handle" int null, "recipient_person_handle" int not null, "created_by_handle" int not null, "reference_handle" varchar(64) null, "title" varchar(256) not null, "body_markdown" varchar(8192) not null, "body_text" varchar(8192) not null, "request_payload" jsonb null, "is_read" boolean not null default false, "read_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "import_batch_item" ("handle" serial primary key, "source_handle" varchar(64) null, "target_entity_handle" varchar(64) null, "import_template_handle" int null, "created_by_handle" int not null, "filename" varchar(256) not null, "mimetype" varchar(128) null, "file_size" int null, "status" varchar(32) not null default 'analyzed', "current_operation" varchar(32) null, "row_count" int null, "processed_count" int not null default 0, "ready_count" int not null default 0, "error_count" int not null default 0, "created_count" int not null default 0, "updated_count" int not null default 0, "skipped_count" int not null default 0, "failed_count" int not null default 0, "job_id" varchar(128) null, "started_at" timestamptz null, "delimiter" varchar(8) null, "headers" jsonb null, "sample_rows" jsonb null, "mapping" jsonb null, "external_key_columns" jsonb null, "generic_reference_mapping" jsonb null, "executed_at" timestamptz null, "completed_at" timestamptz null, "failed_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "import_batch_row_item" ("handle" serial primary key, "batch_handle" int not null, "row_number" int not null, "status" varchar(32) not null default 'pending', "action" varchar(32) null, "target_reference" varchar(64) null, "external_key_hash" varchar(128) null, "external_key_parts" jsonb null, "raw_data" jsonb not null, "payload" jsonb null, "message" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "external_record_link_item" ("handle" serial primary key, "source_handle" varchar(64) not null, "entity_handle" varchar(64) not null, "reference" varchar(64) not null, "external_key_hash" varchar(128) not null, "external_key_parts" jsonb not null, "first_import_batch_handle" int null, "last_import_batch_handle" int null, "last_seen_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "external_record_link_item" add constraint "external_record_link_item_source_handle_entity_ha_fcda9_unique" unique ("source_handle", "entity_handle", "external_key_hash");`,
    );

    this.addSql(
      `create table "favorite_item" ("handle" serial primary key, "title" varchar(128) not null, "search" varchar(256) null, "sort_by" jsonb null, "filter" jsonb null, "person_handle" int not null, "entity_handle" varchar(64) not null, "entity_route_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "email_subscription_item" ("handle" serial primary key, "description" varchar(128) not null, "recipient_field" varchar(128) not null, "sender_person_handle" int not null, "is_active" boolean not null default true, "entity_handle" varchar(64) not null, "type_handle" varchar(64) not null default 'afterInsert', "template_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "email_subscription_condition_item" ("handle" serial primary key, "subscription_handle" int not null, "observed_field" varchar(128) not null, "old_value" varchar(256) null, "new_value" varchar(256) null, "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "email_delivery_item" ("handle" serial primary key, "status_handle" varchar(64) null default 'pending', "template_handle" int null, "entity_handle" varchar(64) not null, "created_by_handle" int not null, "reference_handle" varchar(64) null, "provider" varchar(32) not null, "to_recipients" jsonb not null, "cc_recipients" jsonb null, "bcc_recipients" jsonb null, "subject" varchar(256) not null, "body_markdown" varchar(8192) not null, "body_html" varchar(16384) not null, "attachment_handles" jsonb null, "request_payload" jsonb null, "response_status_code" int null, "response_body" jsonb null, "response_headers" jsonb null, "provider_message_id" varchar(256) null, "completed_at" timestamptz null, "attempt_count" int not null default 0, "next_retry_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "email_list_item_persons" ("email_list_item_handle" int not null, "person_item_handle" int not null, primary key ("email_list_item_handle", "person_item_handle"));`,
    );

    this.addSql(
      `create table "document_item" ("handle" serial primary key, "path" varchar(128) not null, "filename" varchar(256) not null, "mimetype" varchar(128) not null, "length" int not null, "description" varchar(256) null, "reference" varchar(64) not null, "entity_handle" varchar(64) not null, "type_handle" varchar(64) not null, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "dashboard_template_item" ("handle" serial primary key, "name" varchar(128) not null, "description" varchar(512) null, "is_shared" boolean not null default false, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "role_item_starter_dashboard_templates" ("role_item_handle" int not null, "dashboard_template_item_handle" int not null, primary key ("role_item_handle", "dashboard_template_item_handle"));`,
    );

    this.addSql(
      `create table "dashboard_template_item_kpis" ("dashboard_template_item_handle" int not null, "kpi_item_handle" int not null, primary key ("dashboard_template_item_handle", "kpi_item_handle"));`,
    );

    this.addSql(
      `create table "dashboard_item" ("handle" serial primary key, "name" varchar(128) not null, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "dashboard_item_kpis" ("dashboard_item_handle" int not null, "kpi_item_handle" int not null, primary key ("dashboard_item_handle", "kpi_item_handle"));`,
    );

    this.addSql(
      `create table "change_log_item" ("handle" serial primary key, "action_handle" varchar(32) not null, "reference" varchar(64) not null, "entity_handle" varchar(64) not null, "person_handle" int not null, "old_payload" jsonb null, "new_payload" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "change_log_detail_item" ("handle" serial primary key, "log_handle" int not null, "property" varchar(256) not null, "old_value" jsonb null, "new_value" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "calendar_sync_subscription_item" ("handle" serial primary key, "description" varchar(128) not null default 'Outlook calendar import', "provider" varchar(32) not null default 'azure', "is_active" boolean not null default false, "sync_range" varchar(16) not null default 'week', "interval_minutes" int not null default 60, "last_run_at" timestamptz null, "last_success_at" timestamptz null, "last_error" varchar(512) null, "last_imported_count" int not null default 0, "last_created_count" int not null default 0, "last_updated_count" int not null default 0, "last_skipped_count" int not null default 0, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_person_handle_unique" unique ("person_handle");`,
    );

    this.addSql(
      `create table "ai_chat_session_item" ("handle" serial primary key, "title" varchar(256) not null, "is_archived" boolean not null default false, "provider_handle" varchar(64) null, "model_handle" varchar(64) null, "agent_handle" varchar(64) null, "agent_version_handle" int null, "playbook_handle" varchar(64) null, "context_entity_handle" varchar(64) null, "context_record_handle" varchar(128) null, "last_message_at" timestamptz null, "person_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ai_chat_message_item" ("handle" serial primary key, "session_handle" int not null, "person_handle" int not null, "role" varchar(32) not null, "status" varchar(32) not null default 'completed', "sequence" int not null, "content" varchar(16384) not null, "context_payload" jsonb null, "tool_calls" jsonb null, "request_payload" jsonb null, "response_payload" jsonb null, "provider" varchar(64) null, "model" varchar(128) null, "url" varchar(512) null, "route_name" varchar(128) null, "page_title" varchar(256) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ai_chat_transcription_item" ("handle" serial primary key, "session_handle" int null, "message_handle" int null, "document_handle" int null, "person_handle" int not null, "provider_handle" varchar(64) null, "model_handle" varchar(64) null, "status" varchar(32) not null default 'processing', "transcript" varchar(16384) null, "detected_language" varchar(16) null, "mime_type" varchar(128) not null, "byte_length" int not null, "duration_seconds" real null, "request_payload" jsonb null, "response_payload" jsonb null, "failure_payload" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ai_chat_tool_action_item" ("handle" serial primary key, "session_handle" int not null, "message_handle" int null, "person_handle" int not null, "agent_handle" varchar(64) null, "server_name" varchar(128) not null, "tool_name" varchar(128) not null, "arguments" jsonb null, "status" varchar(32) not null default 'pending', "result_payload" jsonb null, "error_payload" jsonb null, "expires_at" timestamptz null, "executed_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ai_chat_attachment_item" ("handle" serial primary key, "session_handle" int null, "message_handle" int null, "person_handle" int not null, "document_handle" int not null, "import_batch_handle" int null, "purpose" varchar(64) not null default 'importAnalysis', "filename" varchar(256) not null, "mime_type" varchar(128) null, "byte_length" varchar(255) null, "status" varchar(32) not null default 'analyzed', "summary_payload" jsonb null, "error_payload" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ai_agent_run_item" ("handle" serial primary key, "session_handle" int null, "message_handle" int null, "person_handle" int not null, "agent_handle" varchar(64) null, "agent_version_handle" int null, "playbook_handle" varchar(64) null, "status" varchar(32) not null default 'running', "provider" varchar(64) null, "model" varchar(128) null, "context_entity_handle" varchar(64) null, "context_record_handle" varchar(128) null, "duration_ms" varchar(255) null, "tool_calls" jsonb null, "sources" jsonb null, "pending_actions" jsonb null, "usage_payload" jsonb null, "response_text" text null, "error_payload" jsonb null, "started_at" timestamptz not null, "completed_at" timestamptz null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "internal_case_item" ("handle" serial primary key, "number" varchar(32) null, "title" varchar(128) not null, "status_handle" varchar(64) not null default 'open', "category_handle" varchar(64) not null default 'internalRequest', "request_markdown" text null, "internal_information_markdown" text null, "customer_company_handle" int null, "customer_person_handle" int null, "responsible_company_handle" int null, "responsible_person_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "email_list_item_companies" ("email_list_item_handle" int not null, "company_item_handle" int not null, primary key ("email_list_item_handle", "company_item_handle"));`,
    );

    this.addSql(
      `create table "contract_item" ("handle" serial primary key, "title" varchar(128) not null, "description" varchar(512) null, "start_date" timestamptz not null, "end_date" timestamptz null, "last_service_date" timestamptz null, "next_service_date" timestamptz null, "is_active" boolean not null default true, "annual_included_hours" int not null default 0, "has_updateservice" boolean not null default false, "company_handle" int null, "service_level_handle" varchar(64) null, "default_support_team_handle" varchar(64) null, "default_support_queue_handle" varchar(64) null, "sla_policy_handle" varchar(64) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ticket_item" ("handle" serial primary key, "number" varchar(32) null, "title" varchar(128) not null, "status_handle" varchar(64) not null default 'open', "priority_handle" varchar(64) not null default 'normal', "external_number" varchar(128) null, "problem_description" text null, "solution_description" text null, "start_date" timestamptz not null, "end_date" timestamptz null, "deadline_date" timestamptz null, "assignee_company_handle" int null, "assignee_person_handle" int null, "creator_company_handle" int not null, "creator_person_handle" int not null, "sales_opportunity_handle" int null, "sla_policy_handle" varchar(64) null, "first_response_due_at" timestamptz null, "resolution_due_at" timestamptz null, "first_responded_at" timestamptz null, "resolved_at" timestamptz null, "type_handle" varchar(64) not null default 'incident', "category_handle" varchar(64) null, "source_handle" varchar(64) not null default 'email', "support_team_handle" varchar(64) null, "support_queue_handle" varchar(64) null, "contract_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "ticket_time_tracking_item" ("handle" serial primary key, "title" varchar(64) not null, "description" varchar(256) not null, "person_handle" int not null, "ticket_handle" int not null, "start_time" timestamptz not null, "end_time" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "event_item" ("handle" serial primary key, "title" varchar(128) not null, "description" text null, "start_date" timestamptz not null, "end_date" timestamptz not null, "is_all_day" boolean not null default false, "is_private" boolean not null default false, "recurrence_rule" varchar(512) null, "online_meeting_url" varchar(512) null, "type_handle" varchar(64) not null default 'internal', "assignee_company_handle" int null, "assignee_person_handle" int null, "creator_company_handle" int not null, "creator_person_handle" int not null, "ticket_handle" int null, "sales_opportunity_handle" int null, "status_handle" varchar(64) not null default 'scheduled', "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "person_item_events" ("person_item_handle" int not null, "event_item_handle" int not null, primary key ("person_item_handle", "event_item_handle"));`,
    );

    this.addSql(
      `create table "event_google_item" ("handle" serial primary key, "reference_handle" varchar(1024) not null, "event_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "event_google_item" add constraint "event_google_item_event_handle_unique" unique ("event_handle");`,
    );

    this.addSql(
      `create table "event_delivery_item" ("handle" serial primary key, "status_handle" varchar(64) null default 'pending', "event_handle" int not null, "payload" jsonb not null, "request_headers" jsonb null, "response_status_code" int null default 200, "response_body" jsonb null, "response_headers" jsonb null, "completed_at" timestamptz null, "attempt_count" int not null default 0, "next_retry_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "event_azure_item" ("handle" serial primary key, "reference_handle" varchar(1024) not null, "event_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "event_azure_item" add constraint "event_azure_item_event_handle_unique" unique ("event_handle");`,
    );

    this.addSql(
      `create table "effort_estimate_item" ("handle" serial primary key, "title" varchar(128) not null, "status_handle" varchar(64) not null default 'new', "expected_completion_date" date null, "requirements_markdown" text null, "is_active" boolean not null default true, "assignee_company_handle" int null, "assignee_person_handle" int null, "creator_company_handle" int null, "creator_person_handle" int null, "sales_opportunity_handle" int null, "ticket_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "knowledge_article_item" ("handle" serial primary key, "title" varchar(160) not null, "status_handle" varchar(64) not null default 'draft', "visibility_handle" varchar(64) not null default 'internal', "category_handle" varchar(64) null, "product_handle" int null, "summary" text null, "tags" varchar(512) null, "context_key" varchar(128) null, "problem_markdown" text null, "solution_markdown" text null, "documentation_markdown" text null, "is_active" boolean not null default true, "published_at" timestamptz null, "valid_until" date null, "source_ticket_handle" int null, "source_sales_opportunity_handle" int null, "source_effort_estimate_handle" int null, "author_person_handle" int null, "reviewer_person_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "effort_estimate_position_item" ("handle" serial primary key, "title" varchar(128) not null, "estimated_hours" real null, "offer_text_markdown" text null, "sort_order" int not null default 100, "is_optional" boolean not null default false, "estimate_handle" int not null, "template_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create table "contract_item_products" ("contract_item_handle" int not null, "product_item_handle" int not null, primary key ("contract_item_handle", "product_item_handle"));`,
    );

    this.addSql(
      `create table "company_relationship_item" ("handle" serial primary key, "description" varchar(1024) null, "source_company_handle" int not null, "target_company_handle" int not null, "type_handle" varchar(64) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "company_relationship_item" add constraint "company_relationship_item_source_company_handle_t_92c05_unique" unique ("source_company_handle", "target_company_handle", "type_handle");`,
    );

    this.addSql(
      `create table "address_item" ("handle" serial primary key, "street" varchar(128) not null, "zip" varchar(16) null, "city" varchar(64) null, "phone" varchar(32) null, "mobile" varchar(32) null, "email" varchar(128) null, "website" varchar(128) null, "company_handle" int not null, "type_handle" varchar(64) not null, "country_handle" varchar(64) not null default 'DE', "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `alter table "ai_provider_model_item" add constraint "ai_provider_model_item_provider_handle_foreign" foreign key ("provider_handle") references "ai_provider_type_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_agent_item" add constraint "ai_agent_item_provider_handle_foreign" foreign key ("provider_handle") references "ai_provider_type_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_agent_item" add constraint "ai_agent_item_model_handle_foreign" foreign key ("model_handle") references "ai_provider_model_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "ai_agent_version_item" add constraint "ai_agent_version_item_agent_handle_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" add constraint "ai_agent_version_item_provider_handle_foreign" foreign key ("provider_handle") references "ai_provider_type_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" add constraint "ai_agent_version_item_model_handle_foreign" foreign key ("model_handle") references "ai_provider_model_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "ai_agent_playbook_item" add constraint "ai_agent_playbook_item_agent_handle_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_agent_memory_item" add constraint "ai_agent_memory_item_agent_handle_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_agent_evaluation_item" add constraint "ai_agent_evaluation_item_agent_handle_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_agent_evaluation_item" add constraint "ai_agent_evaluation_item_agent_version_handle_foreign" foreign key ("agent_version_handle") references "ai_agent_version_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "entity_group_item" add constraint "entity_group_item_parent_handle_foreign" foreign key ("parent_handle") references "entity_group_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "entity_item" add constraint "entity_item_group_handle_foreign" foreign key ("group_handle") references "entity_group_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "email_template_item" add constraint "email_template_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );

    this.addSql(
      `alter table "email_list_item" add constraint "email_list_item_mail_template_handle_foreign" foreign key ("mail_template_handle") references "email_template_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "custom_field_definition_item" add constraint "custom_field_definition_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "custom_field_definition_item" add constraint "custom_field_definition_item_field_type_handle_foreign" foreign key ("field_type_handle") references "custom_field_type_item" ("handle");`,
    );

    this.addSql(
      `alter table "custom_field_value_item" add constraint "custom_field_value_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "custom_field_value_item" add constraint "custom_field_value_item_definition_handle_foreign" foreign key ("definition_handle") references "custom_field_definition_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_entity_generation_template_item" add constraint "ai_entity_generation_template_item_source_entity_handle_foreign" foreign key ("source_entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_entity_generation_template_item" add constraint "ai_entity_generation_template_item_target_entity_handle_foreign" foreign key ("target_entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_entity_generation_template_item" add constraint "ai_entity_generation_template_item_provider_handle_foreign" foreign key ("provider_handle") references "ai_provider_type_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_entity_generation_template_item" add constraint "ai_entity_generation_template_item_model_handle_foreign" foreign key ("model_handle") references "ai_provider_model_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "entity_route_item" add constraint "entity_route_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "entity_route_item" add constraint "entity_route_item_group_handle_foreign" foreign key ("group_handle") references "entity_group_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "favorite_template_item" add constraint "favorite_template_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "favorite_template_item" add constraint "favorite_template_item_entity_route_handle_foreign" foreign key ("entity_route_handle") references "entity_route_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "holiday_item" add constraint "holiday_item_group_handle_foreign" foreign key ("group_handle") references "holiday_group_item" ("handle");`,
    );

    this.addSql(
      `alter table "import_template_item" add constraint "import_template_item_source_handle_foreign" foreign key ("source_handle") references "import_source_item" ("handle");`,
    );
    this.addSql(
      `alter table "import_template_item" add constraint "import_template_item_target_entity_handle_foreign" foreign key ("target_entity_handle") references "entity_item" ("handle");`,
    );

    this.addSql(
      `alter table "import_template_value_mapping_item" add constraint "import_template_value_mapping_item_import_templa_39513_foreign" foreign key ("import_template_handle") references "import_template_item" ("handle");`,
    );

    this.addSql(
      `alter table "inbox_template_item" add constraint "inbox_template_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );

    this.addSql(
      `alter table "kpi_item" add constraint "kpi_item_aggregation_handle_foreign" foreign key ("aggregation_handle") references "kpi_aggregation_item" ("handle");`,
    );
    this.addSql(
      `alter table "kpi_item" add constraint "kpi_item_type_handle_foreign" foreign key ("type_handle") references "kpi_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "kpi_item" add constraint "kpi_item_timeframe_handle_foreign" foreign key ("timeframe_handle") references "kpi_timeframe_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "kpi_item" add constraint "kpi_item_timeframe_interval_handle_foreign" foreign key ("timeframe_interval_handle") references "kpi_timeframe_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "kpi_item" add constraint "kpi_item_relation_handle_foreign" foreign key ("relation_handle") references "entity_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "kpi_item" add constraint "kpi_item_target_entity_handle_foreign" foreign key ("target_entity_handle") references "entity_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "country_item" add constraint "country_item_language_handle_foreign" foreign key ("language_handle") references "language_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "country_item" add constraint "country_item_money_handle_foreign" foreign key ("money_handle") references "money_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "role_item" add constraint "role_item_stage_handle_foreign" foreign key ("stage_handle") references "role_stage_item" ("handle");`,
    );

    this.addSql(
      `alter table "role_item_starter_favorite_templates" add constraint "role_item_starter_favorite_templates_role_item_handle_foreign" foreign key ("role_item_handle") references "role_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "role_item_starter_favorite_templates" add constraint "role_item_starter_favorite_templates_favorite_te_3edaa_foreign" foreign key ("favorite_template_item_handle") references "favorite_template_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "permission_item" add constraint "permission_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "permission_item" add constraint "permission_item_role_handle_foreign" foreign key ("role_handle") references "role_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_agent_memory_item_roles" add constraint "ai_agent_memory_item_roles_ai_agent_memory_item_handle_foreign" foreign key ("ai_agent_memory_item_handle") references "ai_agent_memory_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "ai_agent_memory_item_roles" add constraint "ai_agent_memory_item_roles_role_item_handle_foreign" foreign key ("role_item_handle") references "role_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "ai_agent_item_roles" add constraint "ai_agent_item_roles_ai_agent_item_handle_foreign" foreign key ("ai_agent_item_handle") references "ai_agent_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "ai_agent_item_roles" add constraint "ai_agent_item_roles_role_item_handle_foreign" foreign key ("role_item_handle") references "role_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "script_button_item" add constraint "script_button_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );

    this.addSql(
      `alter table "shared_mailbox_item" add constraint "shared_mailbox_item_provider_handle_foreign" foreign key ("provider_handle") references "person_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "shared_mailbox_item" add constraint "shared_mailbox_item_group_handle_foreign" foreign key ("group_handle") references "shared_mailbox_group_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "support_queue_item" add constraint "support_queue_item_team_handle_foreign" foreign key ("team_handle") references "support_team_item" ("handle");`,
    );
    this.addSql(
      `alter table "support_queue_item" add constraint "support_queue_item_default_sla_policy_handle_foreign" foreign key ("default_sla_policy_handle") references "sla_policy_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "teams_template_item" add constraint "teams_template_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );

    this.addSql(
      `alter table "ticket_category_item" add constraint "ticket_category_item_type_handle_foreign" foreign key ("type_handle") references "ticket_type_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "translation_item" add constraint "translation_item_language_handle_foreign" foreign key ("language_handle") references "language_item" ("handle");`,
    );

    this.addSql(
      `alter table "webhook_subscription_item" add constraint "webhook_subscription_item_payload_type_handle_foreign" foreign key ("payload_type_handle") references "webhook_subscription_payload_type" ("handle");`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" add constraint "webhook_subscription_item_authentication_type_handle_foreign" foreign key ("authentication_type_handle") references "webhook_authentication_type_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" add constraint "webhook_subscription_item_authentication_api_key_handle_foreign" foreign key ("authentication_api_key_handle") references "webhook_authentication_api_key_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" add constraint "webhook_subscription_item_authentication_oauth2_handle_foreign" foreign key ("authentication_oauth2_handle") references "webhook_authentication_oauth2item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" add constraint "webhook_subscription_item_authentication_basic_handle_foreign" foreign key ("authentication_basic_handle") references "webhook_authentication_basic_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" add constraint "webhook_subscription_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" add constraint "webhook_subscription_item_type_handle_foreign" foreign key ("type_handle") references "webhook_subscription_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" add constraint "webhook_subscription_item_method_handle_foreign" foreign key ("method_handle") references "webhook_subscription_method_item" ("handle");`,
    );

    this.addSql(
      `alter table "webhook_delivery_item" add constraint "webhook_delivery_item_status_handle_foreign" foreign key ("status_handle") references "webhook_delivery_status_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "webhook_delivery_item" add constraint "webhook_delivery_item_subscription_handle_foreign" foreign key ("subscription_handle") references "webhook_subscription_item" ("handle");`,
    );

    this.addSql(
      `alter table "teams_subscription_item" add constraint "teams_subscription_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "teams_subscription_item" add constraint "teams_subscription_item_type_handle_foreign" foreign key ("type_handle") references "webhook_subscription_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "teams_subscription_item" add constraint "teams_subscription_item_template_handle_foreign" foreign key ("template_handle") references "teams_template_item" ("handle");`,
    );

    this.addSql(
      `alter table "inbox_subscription_item" add constraint "inbox_subscription_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "inbox_subscription_item" add constraint "inbox_subscription_item_type_handle_foreign" foreign key ("type_handle") references "webhook_subscription_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "inbox_subscription_item" add constraint "inbox_subscription_item_template_handle_foreign" foreign key ("template_handle") references "inbox_template_item" ("handle");`,
    );

    this.addSql(
      `alter table "work_hour_week_item" add constraint "work_hour_week_item_monday_handle_foreign" foreign key ("monday_handle") references "work_hour_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "work_hour_week_item" add constraint "work_hour_week_item_tuesday_handle_foreign" foreign key ("tuesday_handle") references "work_hour_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "work_hour_week_item" add constraint "work_hour_week_item_wednesday_handle_foreign" foreign key ("wednesday_handle") references "work_hour_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "work_hour_week_item" add constraint "work_hour_week_item_thursday_handle_foreign" foreign key ("thursday_handle") references "work_hour_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "work_hour_week_item" add constraint "work_hour_week_item_friday_handle_foreign" foreign key ("friday_handle") references "work_hour_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "work_hour_week_item" add constraint "work_hour_week_item_saturday_handle_foreign" foreign key ("saturday_handle") references "work_hour_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "work_hour_week_item" add constraint "work_hour_week_item_sunday_handle_foreign" foreign key ("sunday_handle") references "work_hour_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "company_item" add constraint "company_item_country_handle_foreign" foreign key ("country_handle") references "country_item" ("handle");`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_account_manager_handle_foreign" foreign key ("account_manager_handle") references "person_item" ("handle") on delete set null deferrable initially immediate;`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_customer_success_manager_handle_foreign" foreign key ("customer_success_manager_handle") references "person_item" ("handle") on delete set null deferrable initially immediate;`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_industry_handle_foreign" foreign key ("industry_handle") references "company_industry_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_segment_handle_foreign" foreign key ("segment_handle") references "company_segment_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_size_handle_foreign" foreign key ("size_handle") references "company_size_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_annual_revenue_class_handle_foreign" foreign key ("annual_revenue_class_handle") references "company_annual_revenue_class_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_churn_risk_reason_handle_foreign" foreign key ("churn_risk_reason_handle") references "company_churn_risk_reason_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_work_week_handle_foreign" foreign key ("work_week_handle") references "work_hour_week_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_holiday_group_handle_foreign" foreign key ("holiday_group_handle") references "holiday_group_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "company_item" add constraint "company_item_service_provider_handle_foreign" foreign key ("service_provider_handle") references "company_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "server_landscape_item" add constraint "server_landscape_item_type_handle_foreign" foreign key ("type_handle") references "server_landscape_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "server_landscape_item" add constraint "server_landscape_item_usage_handle_foreign" foreign key ("usage_handle") references "server_landscape_type_usage_item" ("handle");`,
    );
    this.addSql(
      `alter table "server_landscape_item" add constraint "server_landscape_item_company_handle_foreign" foreign key ("company_handle") references "company_item" ("handle");`,
    );

    this.addSql(
      `alter table "person_item" add constraint "person_item_company_handle_foreign" foreign key ("company_handle") references "company_item" ("handle") on delete set null deferrable initially immediate;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_salutation_handle_foreign" foreign key ("salutation_handle") references "person_salutation_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_title_handle_foreign" foreign key ("title_handle") references "person_title_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_job_title_handle_foreign" foreign key ("job_title_handle") references "person_job_title_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_job_function_handle_foreign" foreign key ("job_function_handle") references "person_function_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_decision_role_handle_foreign" foreign key ("decision_role_handle") references "person_decision_role_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_type_handle_foreign" foreign key ("type_handle") references "person_type_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_department_handle_foreign" foreign key ("department_handle") references "person_department_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_language_handle_foreign" foreign key ("language_handle") references "language_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_work_week_handle_foreign" foreign key ("work_week_handle") references "work_hour_week_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "person_item" add constraint "person_item_holiday_group_handle_foreign" foreign key ("holiday_group_handle") references "holiday_group_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "teams_delivery_item" add constraint "teams_delivery_item_status_handle_foreign" foreign key ("status_handle") references "teams_delivery_status_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "teams_delivery_item" add constraint "teams_delivery_item_subscription_handle_foreign" foreign key ("subscription_handle") references "teams_subscription_item" ("handle");`,
    );
    this.addSql(
      `alter table "teams_delivery_item" add constraint "teams_delivery_item_template_handle_foreign" foreign key ("template_handle") references "teams_template_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "teams_delivery_item" add constraint "teams_delivery_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "teams_delivery_item" add constraint "teams_delivery_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "teams_delivery_item" add constraint "teams_delivery_item_recipient_person_handle_foreign" foreign key ("recipient_person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "social_media_item" add constraint "social_media_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "social_media_item" add constraint "social_media_item_type_handle_foreign" foreign key ("type_handle") references "social_media_type_item" ("handle");`,
    );

    this.addSql(
      `alter table "shared_mailbox_group_item_persons" add constraint "shared_mailbox_group_item_persons_shared_mailbox_c547c_foreign" foreign key ("shared_mailbox_group_item_handle") references "shared_mailbox_group_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "shared_mailbox_group_item_persons" add constraint "shared_mailbox_group_item_persons_person_item_handle_foreign" foreign key ("person_item_handle") references "person_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "sapling_form_config_item" add constraint "sapling_form_config_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "sapling_form_config_item" add constraint "sapling_form_config_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_type_handle_foreign" foreign key ("type_handle") references "sales_opportunity_stage_item" ("handle");`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_forecast_handle_foreign" foreign key ("forecast_handle") references "sales_opportunity_forecast_item" ("handle");`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_source_handle_foreign" foreign key ("source_handle") references "sales_opportunity_source_item" ("handle");`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_result_status_handle_foreign" foreign key ("result_status_handle") references "sales_opportunity_result_status_item" ("handle");`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_loss_reason_handle_foreign" foreign key ("loss_reason_handle") references "sales_opportunity_loss_reason_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_assignee_company_handle_foreign" foreign key ("assignee_company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_assignee_person_handle_foreign" foreign key ("assignee_person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_creator_company_handle_foreign" foreign key ("creator_company_handle") references "company_item" ("handle");`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "sales_opportunity_item_competitors" add constraint "sales_opportunity_item_competitors_sales_opportu_fbc76_foreign" foreign key ("sales_opportunity_item_handle") references "sales_opportunity_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "sales_opportunity_item_competitors" add constraint "sales_opportunity_item_competitors_company_item_handle_foreign" foreign key ("company_item_handle") references "company_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "phone_call_item" add constraint "phone_call_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "phone_call_item" add constraint "phone_call_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "person_session_item" add constraint "person_session_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "person_passkey_item" add constraint "person_passkey_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "person_api_token_item" add constraint "person_api_token_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "person_item_roles" add constraint "person_item_roles_person_item_handle_foreign" foreign key ("person_item_handle") references "person_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "person_item_roles" add constraint "person_item_roles_role_item_handle_foreign" foreign key ("role_item_handle") references "role_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "note_item" add constraint "note_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "note_item" add constraint "note_item_group_handle_foreign" foreign key ("group_handle") references "note_group_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "marketing_campaign_item" add constraint "marketing_campaign_item_status_handle_foreign" foreign key ("status_handle") references "marketing_campaign_status_item" ("handle");`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" add constraint "marketing_campaign_item_type_handle_foreign" foreign key ("type_handle") references "marketing_campaign_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" add constraint "marketing_campaign_item_target_list_handle_foreign" foreign key ("target_list_handle") references "email_list_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" add constraint "marketing_campaign_item_email_template_handle_foreign" foreign key ("email_template_handle") references "email_template_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" add constraint "marketing_campaign_item_owner_person_handle_foreign" foreign key ("owner_person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" add constraint "marketing_campaign_item_opportunity_source_handle_foreign" foreign key ("opportunity_source_handle") references "sales_opportunity_source_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "information_item" add constraint "information_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "information_item" add constraint "information_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "inbox_notification_item" add constraint "inbox_notification_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "inbox_notification_item" add constraint "inbox_notification_item_subscription_handle_foreign" foreign key ("subscription_handle") references "inbox_subscription_item" ("handle");`,
    );
    this.addSql(
      `alter table "inbox_notification_item" add constraint "inbox_notification_item_template_handle_foreign" foreign key ("template_handle") references "inbox_template_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "inbox_notification_item" add constraint "inbox_notification_item_recipient_person_handle_foreign" foreign key ("recipient_person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "inbox_notification_item" add constraint "inbox_notification_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "import_batch_item" add constraint "import_batch_item_source_handle_foreign" foreign key ("source_handle") references "import_source_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "import_batch_item" add constraint "import_batch_item_target_entity_handle_foreign" foreign key ("target_entity_handle") references "entity_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "import_batch_item" add constraint "import_batch_item_import_template_handle_foreign" foreign key ("import_template_handle") references "import_template_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "import_batch_item" add constraint "import_batch_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "import_batch_row_item" add constraint "import_batch_row_item_batch_handle_foreign" foreign key ("batch_handle") references "import_batch_item" ("handle");`,
    );

    this.addSql(
      `alter table "external_record_link_item" add constraint "external_record_link_item_source_handle_foreign" foreign key ("source_handle") references "import_source_item" ("handle");`,
    );
    this.addSql(
      `alter table "external_record_link_item" add constraint "external_record_link_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "external_record_link_item" add constraint "external_record_link_item_first_import_batch_handle_foreign" foreign key ("first_import_batch_handle") references "import_batch_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "external_record_link_item" add constraint "external_record_link_item_last_import_batch_handle_foreign" foreign key ("last_import_batch_handle") references "import_batch_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "favorite_item" add constraint "favorite_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "favorite_item" add constraint "favorite_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "favorite_item" add constraint "favorite_item_entity_route_handle_foreign" foreign key ("entity_route_handle") references "entity_route_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_sender_person_handle_foreign" foreign key ("sender_person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_type_handle_foreign" foreign key ("type_handle") references "webhook_subscription_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_template_handle_foreign" foreign key ("template_handle") references "email_template_item" ("handle");`,
    );

    this.addSql(
      `alter table "email_subscription_condition_item" add constraint "email_subscription_condition_item_subscription_handle_foreign" foreign key ("subscription_handle") references "email_subscription_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "email_delivery_item" add constraint "email_delivery_item_status_handle_foreign" foreign key ("status_handle") references "email_delivery_status_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "email_delivery_item" add constraint "email_delivery_item_template_handle_foreign" foreign key ("template_handle") references "email_template_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "email_delivery_item" add constraint "email_delivery_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "email_delivery_item" add constraint "email_delivery_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "email_list_item_persons" add constraint "email_list_item_persons_email_list_item_handle_foreign" foreign key ("email_list_item_handle") references "email_list_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "email_list_item_persons" add constraint "email_list_item_persons_person_item_handle_foreign" foreign key ("person_item_handle") references "person_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "document_item" add constraint "document_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "document_item" add constraint "document_item_type_handle_foreign" foreign key ("type_handle") references "document_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "document_item" add constraint "document_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "dashboard_template_item" add constraint "dashboard_template_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "role_item_starter_dashboard_templates" add constraint "role_item_starter_dashboard_templates_role_item_handle_foreign" foreign key ("role_item_handle") references "role_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "role_item_starter_dashboard_templates" add constraint "role_item_starter_dashboard_templates_dashboard__7942f_foreign" foreign key ("dashboard_template_item_handle") references "dashboard_template_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "dashboard_template_item_kpis" add constraint "dashboard_template_item_kpis_dashboard_template__45778_foreign" foreign key ("dashboard_template_item_handle") references "dashboard_template_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "dashboard_template_item_kpis" add constraint "dashboard_template_item_kpis_kpi_item_handle_foreign" foreign key ("kpi_item_handle") references "kpi_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "dashboard_item" add constraint "dashboard_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "dashboard_item_kpis" add constraint "dashboard_item_kpis_dashboard_item_handle_foreign" foreign key ("dashboard_item_handle") references "dashboard_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "dashboard_item_kpis" add constraint "dashboard_item_kpis_kpi_item_handle_foreign" foreign key ("kpi_item_handle") references "kpi_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "change_log_item" add constraint "change_log_item_action_handle_foreign" foreign key ("action_handle") references "change_log_action_item" ("handle");`,
    );
    this.addSql(
      `alter table "change_log_item" add constraint "change_log_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "change_log_item" add constraint "change_log_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "change_log_detail_item" add constraint "change_log_detail_item_log_handle_foreign" foreign key ("log_handle") references "change_log_item" ("handle");`,
    );

    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_chat_session_item" add constraint "ai_chat_session_item_provider_handle_foreign" foreign key ("provider_handle") references "ai_provider_type_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" add constraint "ai_chat_session_item_model_handle_foreign" foreign key ("model_handle") references "ai_provider_model_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" add constraint "ai_chat_session_item_agent_handle_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" add constraint "ai_chat_session_item_agent_version_handle_foreign" foreign key ("agent_version_handle") references "ai_agent_version_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" add constraint "ai_chat_session_item_playbook_handle_foreign" foreign key ("playbook_handle") references "ai_agent_playbook_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" add constraint "ai_chat_session_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_chat_message_item" add constraint "ai_chat_message_item_session_handle_foreign" foreign key ("session_handle") references "ai_chat_session_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_chat_message_item" add constraint "ai_chat_message_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_chat_transcription_item" add constraint "ai_chat_transcription_item_session_handle_foreign" foreign key ("session_handle") references "ai_chat_session_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" add constraint "ai_chat_transcription_item_message_handle_foreign" foreign key ("message_handle") references "ai_chat_message_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" add constraint "ai_chat_transcription_item_document_handle_foreign" foreign key ("document_handle") references "document_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" add constraint "ai_chat_transcription_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" add constraint "ai_chat_transcription_item_provider_handle_foreign" foreign key ("provider_handle") references "ai_provider_type_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" add constraint "ai_chat_transcription_item_model_handle_foreign" foreign key ("model_handle") references "ai_provider_model_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "ai_chat_tool_action_item" add constraint "ai_chat_tool_action_item_session_handle_foreign" foreign key ("session_handle") references "ai_chat_session_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_chat_tool_action_item" add constraint "ai_chat_tool_action_item_message_handle_foreign" foreign key ("message_handle") references "ai_chat_message_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_tool_action_item" add constraint "ai_chat_tool_action_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_chat_tool_action_item" add constraint "ai_chat_tool_action_item_agent_handle_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "ai_chat_attachment_item" add constraint "ai_chat_attachment_item_session_handle_foreign" foreign key ("session_handle") references "ai_chat_session_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_attachment_item" add constraint "ai_chat_attachment_item_message_handle_foreign" foreign key ("message_handle") references "ai_chat_message_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_chat_attachment_item" add constraint "ai_chat_attachment_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_chat_attachment_item" add constraint "ai_chat_attachment_item_document_handle_foreign" foreign key ("document_handle") references "document_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_chat_attachment_item" add constraint "ai_chat_attachment_item_import_batch_handle_foreign" foreign key ("import_batch_handle") references "import_batch_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "ai_agent_run_item" add constraint "ai_agent_run_item_session_handle_foreign" foreign key ("session_handle") references "ai_chat_session_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" add constraint "ai_agent_run_item_message_handle_foreign" foreign key ("message_handle") references "ai_chat_message_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" add constraint "ai_agent_run_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" add constraint "ai_agent_run_item_agent_handle_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" add constraint "ai_agent_run_item_agent_version_handle_foreign" foreign key ("agent_version_handle") references "ai_agent_version_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" add constraint "ai_agent_run_item_playbook_handle_foreign" foreign key ("playbook_handle") references "ai_agent_playbook_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_status_handle_foreign" foreign key ("status_handle") references "internal_case_status_item" ("handle");`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_category_handle_foreign" foreign key ("category_handle") references "internal_case_category_item" ("handle");`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_customer_company_handle_foreign" foreign key ("customer_company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_customer_person_handle_foreign" foreign key ("customer_person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_responsible_company_handle_foreign" foreign key ("responsible_company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_responsible_person_handle_foreign" foreign key ("responsible_person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "email_list_item_companies" add constraint "email_list_item_companies_email_list_item_handle_foreign" foreign key ("email_list_item_handle") references "email_list_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "email_list_item_companies" add constraint "email_list_item_companies_company_item_handle_foreign" foreign key ("company_item_handle") references "company_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "contract_item" add constraint "contract_item_company_handle_foreign" foreign key ("company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "contract_item" add constraint "contract_item_service_level_handle_foreign" foreign key ("service_level_handle") references "contract_service_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "contract_item" add constraint "contract_item_default_support_team_handle_foreign" foreign key ("default_support_team_handle") references "support_team_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "contract_item" add constraint "contract_item_default_support_queue_handle_foreign" foreign key ("default_support_queue_handle") references "support_queue_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "contract_item" add constraint "contract_item_sla_policy_handle_foreign" foreign key ("sla_policy_handle") references "sla_policy_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_status_handle_foreign" foreign key ("status_handle") references "ticket_status_item" ("handle");`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_priority_handle_foreign" foreign key ("priority_handle") references "ticket_priority_item" ("handle");`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_assignee_company_handle_foreign" foreign key ("assignee_company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_assignee_person_handle_foreign" foreign key ("assignee_person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_creator_company_handle_foreign" foreign key ("creator_company_handle") references "company_item" ("handle");`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_sales_opportunity_handle_foreign" foreign key ("sales_opportunity_handle") references "sales_opportunity_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_sla_policy_handle_foreign" foreign key ("sla_policy_handle") references "sla_policy_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_type_handle_foreign" foreign key ("type_handle") references "ticket_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_category_handle_foreign" foreign key ("category_handle") references "ticket_category_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_source_handle_foreign" foreign key ("source_handle") references "ticket_source_item" ("handle");`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_support_team_handle_foreign" foreign key ("support_team_handle") references "support_team_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_support_queue_handle_foreign" foreign key ("support_queue_handle") references "support_queue_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_contract_handle_foreign" foreign key ("contract_handle") references "contract_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "ticket_time_tracking_item" add constraint "ticket_time_tracking_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "ticket_time_tracking_item" add constraint "ticket_time_tracking_item_ticket_handle_foreign" foreign key ("ticket_handle") references "ticket_item" ("handle");`,
    );

    this.addSql(
      `alter table "event_item" add constraint "event_item_type_handle_foreign" foreign key ("type_handle") references "event_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_assignee_company_handle_foreign" foreign key ("assignee_company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_assignee_person_handle_foreign" foreign key ("assignee_person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_creator_company_handle_foreign" foreign key ("creator_company_handle") references "company_item" ("handle");`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_ticket_handle_foreign" foreign key ("ticket_handle") references "ticket_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_sales_opportunity_handle_foreign" foreign key ("sales_opportunity_handle") references "sales_opportunity_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_status_handle_foreign" foreign key ("status_handle") references "event_status_item" ("handle");`,
    );

    this.addSql(
      `alter table "person_item_events" add constraint "person_item_events_person_item_handle_foreign" foreign key ("person_item_handle") references "person_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "person_item_events" add constraint "person_item_events_event_item_handle_foreign" foreign key ("event_item_handle") references "event_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "event_google_item" add constraint "event_google_item_event_handle_foreign" foreign key ("event_handle") references "event_item" ("handle");`,
    );

    this.addSql(
      `alter table "event_delivery_item" add constraint "event_delivery_item_status_handle_foreign" foreign key ("status_handle") references "event_delivery_status_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "event_delivery_item" add constraint "event_delivery_item_event_handle_foreign" foreign key ("event_handle") references "event_item" ("handle");`,
    );

    this.addSql(
      `alter table "event_azure_item" add constraint "event_azure_item_event_handle_foreign" foreign key ("event_handle") references "event_item" ("handle");`,
    );

    this.addSql(
      `alter table "effort_estimate_item" add constraint "effort_estimate_item_status_handle_foreign" foreign key ("status_handle") references "effort_estimate_status_item" ("handle");`,
    );
    this.addSql(
      `alter table "effort_estimate_item" add constraint "effort_estimate_item_assignee_company_handle_foreign" foreign key ("assignee_company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "effort_estimate_item" add constraint "effort_estimate_item_assignee_person_handle_foreign" foreign key ("assignee_person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "effort_estimate_item" add constraint "effort_estimate_item_creator_company_handle_foreign" foreign key ("creator_company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "effort_estimate_item" add constraint "effort_estimate_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "effort_estimate_item" add constraint "effort_estimate_item_sales_opportunity_handle_foreign" foreign key ("sales_opportunity_handle") references "sales_opportunity_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "effort_estimate_item" add constraint "effort_estimate_item_ticket_handle_foreign" foreign key ("ticket_handle") references "ticket_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "knowledge_article_item" add constraint "knowledge_article_item_status_handle_foreign" foreign key ("status_handle") references "knowledge_article_status_item" ("handle");`,
    );
    this.addSql(
      `alter table "knowledge_article_item" add constraint "knowledge_article_item_visibility_handle_foreign" foreign key ("visibility_handle") references "knowledge_article_visibility_item" ("handle");`,
    );
    this.addSql(
      `alter table "knowledge_article_item" add constraint "knowledge_article_item_category_handle_foreign" foreign key ("category_handle") references "knowledge_article_category_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "knowledge_article_item" add constraint "knowledge_article_item_product_handle_foreign" foreign key ("product_handle") references "product_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "knowledge_article_item" add constraint "knowledge_article_item_source_ticket_handle_foreign" foreign key ("source_ticket_handle") references "ticket_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "knowledge_article_item" add constraint "knowledge_article_item_source_sales_opportunity_handle_foreign" foreign key ("source_sales_opportunity_handle") references "sales_opportunity_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "knowledge_article_item" add constraint "knowledge_article_item_source_effort_estimate_handle_foreign" foreign key ("source_effort_estimate_handle") references "effort_estimate_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "knowledge_article_item" add constraint "knowledge_article_item_author_person_handle_foreign" foreign key ("author_person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "knowledge_article_item" add constraint "knowledge_article_item_reviewer_person_handle_foreign" foreign key ("reviewer_person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "effort_estimate_position_item" add constraint "effort_estimate_position_item_estimate_handle_foreign" foreign key ("estimate_handle") references "effort_estimate_item" ("handle");`,
    );
    this.addSql(
      `alter table "effort_estimate_position_item" add constraint "effort_estimate_position_item_template_handle_foreign" foreign key ("template_handle") references "effort_estimate_position_template_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "contract_item_products" add constraint "contract_item_products_contract_item_handle_foreign" foreign key ("contract_item_handle") references "contract_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "contract_item_products" add constraint "contract_item_products_product_item_handle_foreign" foreign key ("product_item_handle") references "product_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "company_relationship_item" add constraint "company_relationship_item_source_company_handle_foreign" foreign key ("source_company_handle") references "company_item" ("handle");`,
    );
    this.addSql(
      `alter table "company_relationship_item" add constraint "company_relationship_item_target_company_handle_foreign" foreign key ("target_company_handle") references "company_item" ("handle");`,
    );
    this.addSql(
      `alter table "company_relationship_item" add constraint "company_relationship_item_type_handle_foreign" foreign key ("type_handle") references "company_relationship_type_item" ("handle");`,
    );

    this.addSql(
      `alter table "address_item" add constraint "address_item_company_handle_foreign" foreign key ("company_handle") references "company_item" ("handle");`,
    );
    this.addSql(
      `alter table "address_item" add constraint "address_item_type_handle_foreign" foreign key ("type_handle") references "address_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "address_item" add constraint "address_item_country_handle_foreign" foreign key ("country_handle") references "country_item" ("handle");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "address_item" drop constraint "address_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_provider_model_item" drop constraint "ai_provider_model_item_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_item" drop constraint "ai_agent_item_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" drop constraint "ai_agent_version_item_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_entity_generation_template_item" drop constraint "ai_entity_generation_template_item_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" drop constraint "ai_chat_session_item_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" drop constraint "ai_chat_transcription_item_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_item" drop constraint "ai_agent_item_model_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" drop constraint "ai_agent_version_item_model_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_entity_generation_template_item" drop constraint "ai_entity_generation_template_item_model_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" drop constraint "ai_chat_session_item_model_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" drop constraint "ai_chat_transcription_item_model_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_version_item" drop constraint "ai_agent_version_item_agent_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_playbook_item" drop constraint "ai_agent_playbook_item_agent_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_memory_item" drop constraint "ai_agent_memory_item_agent_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_evaluation_item" drop constraint "ai_agent_evaluation_item_agent_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_item_roles" drop constraint "ai_agent_item_roles_ai_agent_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" drop constraint "ai_chat_session_item_agent_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_tool_action_item" drop constraint "ai_chat_tool_action_item_agent_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" drop constraint "ai_agent_run_item_agent_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_evaluation_item" drop constraint "ai_agent_evaluation_item_agent_version_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" drop constraint "ai_chat_session_item_agent_version_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" drop constraint "ai_agent_run_item_agent_version_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" drop constraint "ai_chat_session_item_playbook_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" drop constraint "ai_agent_run_item_playbook_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_memory_item_roles" drop constraint "ai_agent_memory_item_roles_ai_agent_memory_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "change_log_item" drop constraint "change_log_item_action_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_annual_revenue_class_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_churn_risk_reason_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_industry_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_relationship_item" drop constraint "company_relationship_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_segment_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_size_handle_foreign";`,
    );
    this.addSql(
      `alter table "contract_item" drop constraint "contract_item_service_level_handle_foreign";`,
    );
    this.addSql(
      `alter table "custom_field_definition_item" drop constraint "custom_field_definition_item_field_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "document_item" drop constraint "document_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "effort_estimate_position_item" drop constraint "effort_estimate_position_item_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "effort_estimate_item" drop constraint "effort_estimate_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_delivery_item" drop constraint "email_delivery_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "entity_group_item" drop constraint "entity_group_item_parent_handle_foreign";`,
    );
    this.addSql(
      `alter table "entity_item" drop constraint "entity_item_group_handle_foreign";`,
    );
    this.addSql(
      `alter table "entity_route_item" drop constraint "entity_route_item_group_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_template_item" drop constraint "email_template_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "custom_field_definition_item" drop constraint "custom_field_definition_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "custom_field_value_item" drop constraint "custom_field_value_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_entity_generation_template_item" drop constraint "ai_entity_generation_template_item_source_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_entity_generation_template_item" drop constraint "ai_entity_generation_template_item_target_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "entity_route_item" drop constraint "entity_route_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "favorite_template_item" drop constraint "favorite_template_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "import_template_item" drop constraint "import_template_item_target_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbox_template_item" drop constraint "inbox_template_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "kpi_item" drop constraint "kpi_item_relation_handle_foreign";`,
    );
    this.addSql(
      `alter table "kpi_item" drop constraint "kpi_item_target_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "permission_item" drop constraint "permission_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "script_button_item" drop constraint "script_button_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_template_item" drop constraint "teams_template_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" drop constraint "webhook_subscription_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_subscription_item" drop constraint "teams_subscription_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbox_subscription_item" drop constraint "inbox_subscription_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_delivery_item" drop constraint "teams_delivery_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "sapling_form_config_item" drop constraint "sapling_form_config_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "phone_call_item" drop constraint "phone_call_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "information_item" drop constraint "information_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbox_notification_item" drop constraint "inbox_notification_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "import_batch_item" drop constraint "import_batch_item_target_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "external_record_link_item" drop constraint "external_record_link_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "favorite_item" drop constraint "favorite_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_subscription_item" drop constraint "email_subscription_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_delivery_item" drop constraint "email_delivery_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "document_item" drop constraint "document_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "change_log_item" drop constraint "change_log_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_list_item" drop constraint "email_list_item_mail_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" drop constraint "marketing_campaign_item_email_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_subscription_item" drop constraint "email_subscription_item_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_delivery_item" drop constraint "email_delivery_item_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" drop constraint "marketing_campaign_item_target_list_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_list_item_persons" drop constraint "email_list_item_persons_email_list_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_list_item_companies" drop constraint "email_list_item_companies_email_list_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "custom_field_value_item" drop constraint "custom_field_value_item_definition_handle_foreign";`,
    );
    this.addSql(
      `alter table "favorite_template_item" drop constraint "favorite_template_item_entity_route_handle_foreign";`,
    );
    this.addSql(
      `alter table "favorite_item" drop constraint "favorite_item_entity_route_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_delivery_item" drop constraint "event_delivery_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_item" drop constraint "event_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_item" drop constraint "event_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "role_item_starter_favorite_templates" drop constraint "role_item_starter_favorite_templates_favorite_te_3edaa_foreign";`,
    );
    this.addSql(
      `alter table "holiday_item" drop constraint "holiday_item_group_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_holiday_group_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_holiday_group_handle_foreign";`,
    );
    this.addSql(
      `alter table "import_template_item" drop constraint "import_template_item_source_handle_foreign";`,
    );
    this.addSql(
      `alter table "import_batch_item" drop constraint "import_batch_item_source_handle_foreign";`,
    );
    this.addSql(
      `alter table "external_record_link_item" drop constraint "external_record_link_item_source_handle_foreign";`,
    );
    this.addSql(
      `alter table "import_template_value_mapping_item" drop constraint "import_template_value_mapping_item_import_templa_39513_foreign";`,
    );
    this.addSql(
      `alter table "import_batch_item" drop constraint "import_batch_item_import_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbox_subscription_item" drop constraint "inbox_subscription_item_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbox_notification_item" drop constraint "inbox_notification_item_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "internal_case_item" drop constraint "internal_case_item_category_handle_foreign";`,
    );
    this.addSql(
      `alter table "internal_case_item" drop constraint "internal_case_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "knowledge_article_item" drop constraint "knowledge_article_item_category_handle_foreign";`,
    );
    this.addSql(
      `alter table "knowledge_article_item" drop constraint "knowledge_article_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "knowledge_article_item" drop constraint "knowledge_article_item_visibility_handle_foreign";`,
    );
    this.addSql(
      `alter table "kpi_item" drop constraint "kpi_item_aggregation_handle_foreign";`,
    );
    this.addSql(
      `alter table "kpi_item" drop constraint "kpi_item_timeframe_handle_foreign";`,
    );
    this.addSql(
      `alter table "kpi_item" drop constraint "kpi_item_timeframe_interval_handle_foreign";`,
    );
    this.addSql(
      `alter table "kpi_item" drop constraint "kpi_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "dashboard_template_item_kpis" drop constraint "dashboard_template_item_kpis_kpi_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "dashboard_item_kpis" drop constraint "dashboard_item_kpis_kpi_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "country_item" drop constraint "country_item_language_handle_foreign";`,
    );
    this.addSql(
      `alter table "translation_item" drop constraint "translation_item_language_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_language_handle_foreign";`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" drop constraint "marketing_campaign_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" drop constraint "marketing_campaign_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "country_item" drop constraint "country_item_money_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_country_handle_foreign";`,
    );
    this.addSql(
      `alter table "address_item" drop constraint "address_item_country_handle_foreign";`,
    );
    this.addSql(
      `alter table "note_item" drop constraint "note_item_group_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_decision_role_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_department_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_job_function_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_job_title_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_salutation_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_title_handle_foreign";`,
    );
    this.addSql(
      `alter table "shared_mailbox_item" drop constraint "shared_mailbox_item_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "knowledge_article_item" drop constraint "knowledge_article_item_product_handle_foreign";`,
    );
    this.addSql(
      `alter table "contract_item_products" drop constraint "contract_item_products_product_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "role_item" drop constraint "role_item_stage_handle_foreign";`,
    );
    this.addSql(
      `alter table "role_item_starter_favorite_templates" drop constraint "role_item_starter_favorite_templates_role_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "permission_item" drop constraint "permission_item_role_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_memory_item_roles" drop constraint "ai_agent_memory_item_roles_role_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_item_roles" drop constraint "ai_agent_item_roles_role_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item_roles" drop constraint "person_item_roles_role_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "role_item_starter_dashboard_templates" drop constraint "role_item_starter_dashboard_templates_role_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_forecast_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_loss_reason_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_result_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_source_handle_foreign";`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" drop constraint "marketing_campaign_item_opportunity_source_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "server_landscape_item" drop constraint "server_landscape_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "server_landscape_item" drop constraint "server_landscape_item_usage_handle_foreign";`,
    );
    this.addSql(
      `alter table "shared_mailbox_item" drop constraint "shared_mailbox_item_group_handle_foreign";`,
    );
    this.addSql(
      `alter table "shared_mailbox_group_item_persons" drop constraint "shared_mailbox_group_item_persons_shared_mailbox_c547c_foreign";`,
    );
    this.addSql(
      `alter table "support_queue_item" drop constraint "support_queue_item_default_sla_policy_handle_foreign";`,
    );
    this.addSql(
      `alter table "contract_item" drop constraint "contract_item_sla_policy_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_sla_policy_handle_foreign";`,
    );
    this.addSql(
      `alter table "social_media_item" drop constraint "social_media_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "support_queue_item" drop constraint "support_queue_item_team_handle_foreign";`,
    );
    this.addSql(
      `alter table "contract_item" drop constraint "contract_item_default_support_team_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_support_team_handle_foreign";`,
    );
    this.addSql(
      `alter table "contract_item" drop constraint "contract_item_default_support_queue_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_support_queue_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_delivery_item" drop constraint "teams_delivery_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_subscription_item" drop constraint "teams_subscription_item_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_delivery_item" drop constraint "teams_delivery_item_template_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_priority_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_source_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_category_item" drop constraint "ticket_category_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_category_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" drop constraint "webhook_subscription_item_authentication_api_key_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" drop constraint "webhook_subscription_item_authentication_basic_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" drop constraint "webhook_subscription_item_authentication_oauth2_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" drop constraint "webhook_subscription_item_authentication_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_delivery_item" drop constraint "webhook_delivery_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" drop constraint "webhook_subscription_item_method_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" drop constraint "webhook_subscription_item_payload_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_subscription_item" drop constraint "webhook_subscription_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_subscription_item" drop constraint "teams_subscription_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbox_subscription_item" drop constraint "inbox_subscription_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_subscription_item" drop constraint "email_subscription_item_type_handle_foreign";`,
    );
    this.addSql(
      `alter table "webhook_delivery_item" drop constraint "webhook_delivery_item_subscription_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_delivery_item" drop constraint "teams_delivery_item_subscription_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbox_notification_item" drop constraint "inbox_notification_item_subscription_handle_foreign";`,
    );
    this.addSql(
      `alter table "work_hour_week_item" drop constraint "work_hour_week_item_monday_handle_foreign";`,
    );
    this.addSql(
      `alter table "work_hour_week_item" drop constraint "work_hour_week_item_tuesday_handle_foreign";`,
    );
    this.addSql(
      `alter table "work_hour_week_item" drop constraint "work_hour_week_item_wednesday_handle_foreign";`,
    );
    this.addSql(
      `alter table "work_hour_week_item" drop constraint "work_hour_week_item_thursday_handle_foreign";`,
    );
    this.addSql(
      `alter table "work_hour_week_item" drop constraint "work_hour_week_item_friday_handle_foreign";`,
    );
    this.addSql(
      `alter table "work_hour_week_item" drop constraint "work_hour_week_item_saturday_handle_foreign";`,
    );
    this.addSql(
      `alter table "work_hour_week_item" drop constraint "work_hour_week_item_sunday_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_work_week_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_work_week_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_service_provider_handle_foreign";`,
    );
    this.addSql(
      `alter table "server_landscape_item" drop constraint "server_landscape_item_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item" drop constraint "person_item_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_assignee_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_creator_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item_competitors" drop constraint "sales_opportunity_item_competitors_company_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "internal_case_item" drop constraint "internal_case_item_customer_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "internal_case_item" drop constraint "internal_case_item_responsible_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_list_item_companies" drop constraint "email_list_item_companies_company_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "contract_item" drop constraint "contract_item_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_assignee_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_creator_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_item" drop constraint "event_item_assignee_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_item" drop constraint "event_item_creator_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "effort_estimate_item" drop constraint "effort_estimate_item_assignee_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "effort_estimate_item" drop constraint "effort_estimate_item_creator_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_relationship_item" drop constraint "company_relationship_item_source_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_relationship_item" drop constraint "company_relationship_item_target_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "address_item" drop constraint "address_item_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_account_manager_handle_foreign";`,
    );
    this.addSql(
      `alter table "company_item" drop constraint "company_item_customer_success_manager_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_delivery_item" drop constraint "teams_delivery_item_created_by_handle_foreign";`,
    );
    this.addSql(
      `alter table "teams_delivery_item" drop constraint "teams_delivery_item_recipient_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "social_media_item" drop constraint "social_media_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "shared_mailbox_group_item_persons" drop constraint "shared_mailbox_group_item_persons_person_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "sapling_form_config_item" drop constraint "sapling_form_config_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_assignee_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_creator_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "phone_call_item" drop constraint "phone_call_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_session_item" drop constraint "person_session_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_passkey_item" drop constraint "person_passkey_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_api_token_item" drop constraint "person_api_token_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item_roles" drop constraint "person_item_roles_person_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "note_item" drop constraint "note_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "marketing_campaign_item" drop constraint "marketing_campaign_item_owner_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "information_item" drop constraint "information_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbox_notification_item" drop constraint "inbox_notification_item_recipient_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbox_notification_item" drop constraint "inbox_notification_item_created_by_handle_foreign";`,
    );
    this.addSql(
      `alter table "import_batch_item" drop constraint "import_batch_item_created_by_handle_foreign";`,
    );
    this.addSql(
      `alter table "favorite_item" drop constraint "favorite_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_subscription_item" drop constraint "email_subscription_item_sender_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_delivery_item" drop constraint "email_delivery_item_created_by_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_list_item_persons" drop constraint "email_list_item_persons_person_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "document_item" drop constraint "document_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "dashboard_template_item" drop constraint "dashboard_template_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "dashboard_item" drop constraint "dashboard_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "change_log_item" drop constraint "change_log_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item" drop constraint "calendar_sync_subscription_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_session_item" drop constraint "ai_chat_session_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_message_item" drop constraint "ai_chat_message_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" drop constraint "ai_chat_transcription_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_tool_action_item" drop constraint "ai_chat_tool_action_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_attachment_item" drop constraint "ai_chat_attachment_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" drop constraint "ai_agent_run_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "internal_case_item" drop constraint "internal_case_item_customer_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "internal_case_item" drop constraint "internal_case_item_responsible_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_assignee_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_creator_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_time_tracking_item" drop constraint "ticket_time_tracking_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_item" drop constraint "event_item_assignee_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_item" drop constraint "event_item_creator_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item_events" drop constraint "person_item_events_person_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "effort_estimate_item" drop constraint "effort_estimate_item_assignee_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "effort_estimate_item" drop constraint "effort_estimate_item_creator_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "knowledge_article_item" drop constraint "knowledge_article_item_author_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "knowledge_article_item" drop constraint "knowledge_article_item_reviewer_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "sales_opportunity_item_competitors" drop constraint "sales_opportunity_item_competitors_sales_opportu_fbc76_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_sales_opportunity_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_item" drop constraint "event_item_sales_opportunity_handle_foreign";`,
    );
    this.addSql(
      `alter table "effort_estimate_item" drop constraint "effort_estimate_item_sales_opportunity_handle_foreign";`,
    );
    this.addSql(
      `alter table "knowledge_article_item" drop constraint "knowledge_article_item_source_sales_opportunity_handle_foreign";`,
    );
    this.addSql(
      `alter table "import_batch_row_item" drop constraint "import_batch_row_item_batch_handle_foreign";`,
    );
    this.addSql(
      `alter table "external_record_link_item" drop constraint "external_record_link_item_first_import_batch_handle_foreign";`,
    );
    this.addSql(
      `alter table "external_record_link_item" drop constraint "external_record_link_item_last_import_batch_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_attachment_item" drop constraint "ai_chat_attachment_item_import_batch_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_subscription_condition_item" drop constraint "email_subscription_condition_item_subscription_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" drop constraint "ai_chat_transcription_item_document_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_attachment_item" drop constraint "ai_chat_attachment_item_document_handle_foreign";`,
    );
    this.addSql(
      `alter table "role_item_starter_dashboard_templates" drop constraint "role_item_starter_dashboard_templates_dashboard__7942f_foreign";`,
    );
    this.addSql(
      `alter table "dashboard_template_item_kpis" drop constraint "dashboard_template_item_kpis_dashboard_template__45778_foreign";`,
    );
    this.addSql(
      `alter table "dashboard_item_kpis" drop constraint "dashboard_item_kpis_dashboard_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "change_log_detail_item" drop constraint "change_log_detail_item_log_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_message_item" drop constraint "ai_chat_message_item_session_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" drop constraint "ai_chat_transcription_item_session_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_tool_action_item" drop constraint "ai_chat_tool_action_item_session_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_attachment_item" drop constraint "ai_chat_attachment_item_session_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" drop constraint "ai_agent_run_item_session_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_transcription_item" drop constraint "ai_chat_transcription_item_message_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_tool_action_item" drop constraint "ai_chat_tool_action_item_message_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_chat_attachment_item" drop constraint "ai_chat_attachment_item_message_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_agent_run_item" drop constraint "ai_agent_run_item_message_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_contract_handle_foreign";`,
    );
    this.addSql(
      `alter table "contract_item_products" drop constraint "contract_item_products_contract_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "ticket_time_tracking_item" drop constraint "ticket_time_tracking_item_ticket_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_item" drop constraint "event_item_ticket_handle_foreign";`,
    );
    this.addSql(
      `alter table "effort_estimate_item" drop constraint "effort_estimate_item_ticket_handle_foreign";`,
    );
    this.addSql(
      `alter table "knowledge_article_item" drop constraint "knowledge_article_item_source_ticket_handle_foreign";`,
    );
    this.addSql(
      `alter table "person_item_events" drop constraint "person_item_events_event_item_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_google_item" drop constraint "event_google_item_event_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_delivery_item" drop constraint "event_delivery_item_event_handle_foreign";`,
    );
    this.addSql(
      `alter table "event_azure_item" drop constraint "event_azure_item_event_handle_foreign";`,
    );
    this.addSql(
      `alter table "knowledge_article_item" drop constraint "knowledge_article_item_source_effort_estimate_handle_foreign";`,
    );
    this.addSql(
      `alter table "effort_estimate_position_item" drop constraint "effort_estimate_position_item_estimate_handle_foreign";`,
    );

    this.addSql(`drop table if exists "address_type_item" cascade;`);
    this.addSql(`drop table if exists "ai_provider_type_item" cascade;`);
    this.addSql(`drop table if exists "ai_provider_model_item" cascade;`);
    this.addSql(`drop table if exists "ai_agent_item" cascade;`);
    this.addSql(`drop table if exists "ai_agent_version_item" cascade;`);
    this.addSql(`drop table if exists "ai_agent_playbook_item" cascade;`);
    this.addSql(`drop table if exists "ai_agent_memory_item" cascade;`);
    this.addSql(`drop table if exists "ai_agent_evaluation_item" cascade;`);
    this.addSql(`drop table if exists "ai_vector_document_item" cascade;`);
    this.addSql(`drop table if exists "change_log_action_item" cascade;`);
    this.addSql(
      `drop table if exists "company_annual_revenue_class_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "company_churn_risk_reason_item" cascade;`,
    );
    this.addSql(`drop table if exists "company_industry_item" cascade;`);
    this.addSql(
      `drop table if exists "company_relationship_type_item" cascade;`,
    );
    this.addSql(`drop table if exists "company_segment_item" cascade;`);
    this.addSql(`drop table if exists "company_size_item" cascade;`);
    this.addSql(`drop table if exists "contract_service_item" cascade;`);
    this.addSql(`drop table if exists "custom_field_type_item" cascade;`);
    this.addSql(`drop table if exists "document_type_item" cascade;`);
    this.addSql(
      `drop table if exists "effort_estimate_position_template_item" cascade;`,
    );
    this.addSql(`drop table if exists "effort_estimate_status_item" cascade;`);
    this.addSql(`drop table if exists "email_delivery_status_item" cascade;`);
    this.addSql(`drop table if exists "entity_group_item" cascade;`);
    this.addSql(`drop table if exists "entity_item" cascade;`);
    this.addSql(`drop table if exists "email_template_item" cascade;`);
    this.addSql(`drop table if exists "email_list_item" cascade;`);
    this.addSql(`drop table if exists "custom_field_definition_item" cascade;`);
    this.addSql(`drop table if exists "custom_field_value_item" cascade;`);
    this.addSql(
      `drop table if exists "ai_entity_generation_template_item" cascade;`,
    );
    this.addSql(`drop table if exists "entity_route_item" cascade;`);
    this.addSql(`drop table if exists "event_delivery_status_item" cascade;`);
    this.addSql(`drop table if exists "event_status_item" cascade;`);
    this.addSql(`drop table if exists "event_type_item" cascade;`);
    this.addSql(`drop table if exists "favorite_template_item" cascade;`);
    this.addSql(`drop table if exists "holiday_group_item" cascade;`);
    this.addSql(`drop table if exists "holiday_item" cascade;`);
    this.addSql(`drop table if exists "import_source_item" cascade;`);
    this.addSql(`drop table if exists "import_template_item" cascade;`);
    this.addSql(
      `drop table if exists "import_template_value_mapping_item" cascade;`,
    );
    this.addSql(`drop table if exists "inbox_template_item" cascade;`);
    this.addSql(`drop table if exists "internal_case_category_item" cascade;`);
    this.addSql(`drop table if exists "internal_case_status_item" cascade;`);
    this.addSql(
      `drop table if exists "knowledge_article_category_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "knowledge_article_status_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "knowledge_article_visibility_item" cascade;`,
    );
    this.addSql(`drop table if exists "kpi_aggregation_item" cascade;`);
    this.addSql(`drop table if exists "kpi_timeframe_item" cascade;`);
    this.addSql(`drop table if exists "kpi_type_item" cascade;`);
    this.addSql(`drop table if exists "kpi_item" cascade;`);
    this.addSql(`drop table if exists "language_item" cascade;`);
    this.addSql(
      `drop table if exists "marketing_campaign_status_item" cascade;`,
    );
    this.addSql(`drop table if exists "marketing_campaign_type_item" cascade;`);
    this.addSql(`drop table if exists "mcp_server_config_item" cascade;`);
    this.addSql(`drop table if exists "money_item" cascade;`);
    this.addSql(`drop table if exists "country_item" cascade;`);
    this.addSql(`drop table if exists "note_group_item" cascade;`);
    this.addSql(`drop table if exists "person_decision_role_item" cascade;`);
    this.addSql(`drop table if exists "person_department_item" cascade;`);
    this.addSql(`drop table if exists "person_function_item" cascade;`);
    this.addSql(`drop table if exists "person_job_title_item" cascade;`);
    this.addSql(`drop table if exists "person_salutation_item" cascade;`);
    this.addSql(`drop table if exists "person_title_item" cascade;`);
    this.addSql(`drop table if exists "person_type_item" cascade;`);
    this.addSql(`drop table if exists "product_item" cascade;`);
    this.addSql(`drop table if exists "role_stage_item" cascade;`);
    this.addSql(`drop table if exists "role_item" cascade;`);
    this.addSql(
      `drop table if exists "role_item_starter_favorite_templates" cascade;`,
    );
    this.addSql(`drop table if exists "permission_item" cascade;`);
    this.addSql(`drop table if exists "ai_agent_memory_item_roles" cascade;`);
    this.addSql(`drop table if exists "ai_agent_item_roles" cascade;`);
    this.addSql(
      `drop table if exists "sales_opportunity_forecast_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "sales_opportunity_loss_reason_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "sales_opportunity_result_status_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "sales_opportunity_source_item" cascade;`,
    );
    this.addSql(`drop table if exists "sales_opportunity_stage_item" cascade;`);
    this.addSql(`drop table if exists "script_button_item" cascade;`);
    this.addSql(`drop table if exists "seed_script_item" cascade;`);
    this.addSql(`drop table if exists "server_landscape_type_item" cascade;`);
    this.addSql(
      `drop table if exists "server_landscape_type_usage_item" cascade;`,
    );
    this.addSql(`drop table if exists "session_store_item" cascade;`);
    this.addSql(`drop table if exists "shared_mailbox_group_item" cascade;`);
    this.addSql(`drop table if exists "shared_mailbox_item" cascade;`);
    this.addSql(`drop table if exists "sla_policy_item" cascade;`);
    this.addSql(`drop table if exists "social_media_type_item" cascade;`);
    this.addSql(`drop table if exists "support_team_item" cascade;`);
    this.addSql(`drop table if exists "support_queue_item" cascade;`);
    this.addSql(`drop table if exists "teams_delivery_status_item" cascade;`);
    this.addSql(`drop table if exists "teams_template_item" cascade;`);
    this.addSql(`drop table if exists "ticket_priority_item" cascade;`);
    this.addSql(`drop table if exists "ticket_source_item" cascade;`);
    this.addSql(`drop table if exists "ticket_status_item" cascade;`);
    this.addSql(`drop table if exists "ticket_type_item" cascade;`);
    this.addSql(`drop table if exists "ticket_category_item" cascade;`);
    this.addSql(`drop table if exists "translation_item" cascade;`);
    this.addSql(
      `drop table if exists "webhook_authentication_api_key_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "webhook_authentication_basic_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "webhook_authentication_oauth2item" cascade;`,
    );
    this.addSql(
      `drop table if exists "webhook_authentication_type_item" cascade;`,
    );
    this.addSql(`drop table if exists "webhook_delivery_status_item" cascade;`);
    this.addSql(
      `drop table if exists "webhook_subscription_method_item" cascade;`,
    );
    this.addSql(
      `drop table if exists "webhook_subscription_payload_type" cascade;`,
    );
    this.addSql(
      `drop table if exists "webhook_subscription_type_item" cascade;`,
    );
    this.addSql(`drop table if exists "webhook_subscription_item" cascade;`);
    this.addSql(`drop table if exists "webhook_delivery_item" cascade;`);
    this.addSql(`drop table if exists "teams_subscription_item" cascade;`);
    this.addSql(`drop table if exists "inbox_subscription_item" cascade;`);
    this.addSql(`drop table if exists "work_hour_item" cascade;`);
    this.addSql(`drop table if exists "work_hour_week_item" cascade;`);
    this.addSql(`drop table if exists "company_item" cascade;`);
    this.addSql(`drop table if exists "server_landscape_item" cascade;`);
    this.addSql(`drop table if exists "person_item" cascade;`);
    this.addSql(`drop table if exists "teams_delivery_item" cascade;`);
    this.addSql(`drop table if exists "social_media_item" cascade;`);
    this.addSql(
      `drop table if exists "shared_mailbox_group_item_persons" cascade;`,
    );
    this.addSql(`drop table if exists "sapling_form_config_item" cascade;`);
    this.addSql(`drop table if exists "sales_opportunity_item" cascade;`);
    this.addSql(
      `drop table if exists "sales_opportunity_item_competitors" cascade;`,
    );
    this.addSql(`drop table if exists "phone_call_item" cascade;`);
    this.addSql(`drop table if exists "person_session_item" cascade;`);
    this.addSql(`drop table if exists "person_passkey_item" cascade;`);
    this.addSql(`drop table if exists "person_api_token_item" cascade;`);
    this.addSql(`drop table if exists "person_item_roles" cascade;`);
    this.addSql(`drop table if exists "note_item" cascade;`);
    this.addSql(`drop table if exists "marketing_campaign_item" cascade;`);
    this.addSql(`drop table if exists "information_item" cascade;`);
    this.addSql(`drop table if exists "inbox_notification_item" cascade;`);
    this.addSql(`drop table if exists "import_batch_item" cascade;`);
    this.addSql(`drop table if exists "import_batch_row_item" cascade;`);
    this.addSql(`drop table if exists "external_record_link_item" cascade;`);
    this.addSql(`drop table if exists "favorite_item" cascade;`);
    this.addSql(`drop table if exists "email_subscription_item" cascade;`);
    this.addSql(
      `drop table if exists "email_subscription_condition_item" cascade;`,
    );
    this.addSql(`drop table if exists "email_delivery_item" cascade;`);
    this.addSql(`drop table if exists "email_list_item_persons" cascade;`);
    this.addSql(`drop table if exists "document_item" cascade;`);
    this.addSql(`drop table if exists "dashboard_template_item" cascade;`);
    this.addSql(
      `drop table if exists "role_item_starter_dashboard_templates" cascade;`,
    );
    this.addSql(`drop table if exists "dashboard_template_item_kpis" cascade;`);
    this.addSql(`drop table if exists "dashboard_item" cascade;`);
    this.addSql(`drop table if exists "dashboard_item_kpis" cascade;`);
    this.addSql(`drop table if exists "change_log_item" cascade;`);
    this.addSql(`drop table if exists "change_log_detail_item" cascade;`);
    this.addSql(
      `drop table if exists "calendar_sync_subscription_item" cascade;`,
    );
    this.addSql(`drop table if exists "ai_chat_session_item" cascade;`);
    this.addSql(`drop table if exists "ai_chat_message_item" cascade;`);
    this.addSql(`drop table if exists "ai_chat_transcription_item" cascade;`);
    this.addSql(`drop table if exists "ai_chat_tool_action_item" cascade;`);
    this.addSql(`drop table if exists "ai_chat_attachment_item" cascade;`);
    this.addSql(`drop table if exists "ai_agent_run_item" cascade;`);
    this.addSql(`drop table if exists "internal_case_item" cascade;`);
    this.addSql(`drop table if exists "email_list_item_companies" cascade;`);
    this.addSql(`drop table if exists "contract_item" cascade;`);
    this.addSql(`drop table if exists "ticket_item" cascade;`);
    this.addSql(`drop table if exists "ticket_time_tracking_item" cascade;`);
    this.addSql(`drop table if exists "event_item" cascade;`);
    this.addSql(`drop table if exists "person_item_events" cascade;`);
    this.addSql(`drop table if exists "event_google_item" cascade;`);
    this.addSql(`drop table if exists "event_delivery_item" cascade;`);
    this.addSql(`drop table if exists "event_azure_item" cascade;`);
    this.addSql(`drop table if exists "effort_estimate_item" cascade;`);
    this.addSql(`drop table if exists "knowledge_article_item" cascade;`);
    this.addSql(
      `drop table if exists "effort_estimate_position_item" cascade;`,
    );
    this.addSql(`drop table if exists "contract_item_products" cascade;`);
    this.addSql(`drop table if exists "company_relationship_item" cascade;`);
    this.addSql(`drop table if exists "address_item" cascade;`);
  }
}
