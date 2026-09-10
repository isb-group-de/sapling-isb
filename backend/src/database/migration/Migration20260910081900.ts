import { Migration } from '@mikro-orm/migrations';

export class Migration20260910081900 extends Migration {
  override name = 'Migration20260910081900';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" drop constraint "dvelop_entity_mapping_search_category_item_mapping_handle_forei";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" drop constraint "dvelop_entity_mapping_search_category_item_object_definition_ha";`,
    );

    this.addSql(
      `alter table "system_error_group_item" drop constraint "system_error_group_environment_foreign";`,
    );

    this.addSql(
      `alter table "system_check_run_item" drop constraint "system_check_run_environment_foreign";`,
    );

    this.addSql(
      `alter table "system_alert_incident_item" drop constraint "system_alert_incident_item_environment_foreign";`,
    );
    this.addSql(
      `alter table "system_alert_incident_item" drop constraint "system_alert_incident_rule_fk";`,
    );

    this.addSql(
      `alter table "system_telemetry_instance_item" drop constraint "system_telemetry_instance_environment_foreign";`,
    );

    this.addSql(
      `alter table "system_metric_bucket_item" drop constraint "system_metric_bucket_instance_fk";`,
    );

    this.addSql(
      `alter table "system_error_occurrence_item" drop constraint "system_error_occurrence_environment_foreign";`,
    );
    this.addSql(
      `alter table "system_error_occurrence_item" drop constraint "system_error_occurrence_group_foreign";`,
    );
    this.addSql(
      `alter table "system_error_occurrence_item" drop constraint "system_error_occurrence_instance_foreign";`,
    );

    this.addSql(
      `alter table "system_remediation_execution_item" drop constraint "system_remediation_approved_by_foreign";`,
    );
    this.addSql(
      `alter table "system_remediation_execution_item" drop constraint "system_remediation_environment_foreign";`,
    );
    this.addSql(
      `alter table "system_remediation_execution_item" drop constraint "system_remediation_incident_foreign";`,
    );

    this.addSql(
      `alter table "http_metric_bucket_item" drop constraint "http_metric_bucket_item_environment_foreign";`,
    );
    this.addSql(
      `alter table "http_metric_bucket_item" drop constraint "http_metric_bucket_person_fk";`,
    );
    this.addSql(
      `alter table "http_metric_bucket_item" drop constraint "http_metric_bucket_token_fk";`,
    );

    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_agent_foreign";`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_mailbox_foreign";`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_person_foreign";`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_processing_mode_foreign";`,
    );

    this.addSql(
      `alter table "calendar_sync_subscription_item" drop constraint "calendar_sync_subscription_item_default_event_category_handle_f";`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item" drop constraint "calendar_sync_subscription_item_default_event_type_handle_forei";`,
    );

    this.addSql(
      `alter table "authentication_event_item" drop constraint "authentication_event_item_environment_foreign";`,
    );
    this.addSql(
      `alter table "authentication_event_item" drop constraint "authentication_event_person_fk";`,
    );

    this.addSql(
      `alter table "ai_usage_event_item" drop constraint "ai_usage_event_item_environment_foreign";`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" drop constraint "ai_usage_event_person_fk";`,
    );

    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_agent_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_ai_message_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_ai_session_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_company_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_mailbox_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_office_task_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_person_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_sales_opportunity_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_source_document_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_status_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_subscription_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_ticket_foreign";`,
    );

    this.addSql(
      `alter table "dvelop_object_definition_item" drop constraint "dvelop_object_definition_item_connection_handle_dvelop_id_uniqu";`,
    );
    this.addSql(
      `alter table "dvelop_object_definition_item" add constraint "dvelop_object_definition_item_connection_handle_d_24dad_unique" unique ("connection_handle", "dvelop_id");`,
    );

    this.addSql(
      `alter table "dvelop_property_item" drop constraint "dvelop_property_item_connection_handle_object_definition_handle";`,
    );
    this.addSql(
      `alter table "dvelop_property_item" add constraint "dvelop_property_item_connection_handle_object_def_4cba0_unique" unique ("connection_handle", "object_definition_handle", "dvelop_id");`,
    );

    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" add constraint "dvelop_entity_mapping_search_category_item_mappi_e6b27_foreign" foreign key ("mapping_handle") references "dvelop_entity_mapping_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" add constraint "dvelop_entity_mapping_search_category_item_objec_901f8_foreign" foreign key ("object_definition_handle") references "dvelop_object_definition_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" drop constraint "dvelop_entity_mapping_search_category_item_mapping_handle_objec";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" add constraint "dvelop_entity_mapping_search_category_item_mappin_fec76_unique" unique ("mapping_handle", "object_definition_handle");`,
    );

    this.addSql(
      `alter table "dvelop_entity_mapping_property_item" drop constraint "dvelop_entity_mapping_property_item_mapping_handle_property_han";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_property_item" add constraint "dvelop_entity_mapping_property_item_mapping_handl_7a4c6_unique" unique ("mapping_handle", "property_handle");`,
    );

    this.addSql(
      `alter table "global_search_index_item" drop constraint "global_search_index_item_record_field_unique";`,
    );
    this.addSql(
      `alter table "global_search_index_item" add constraint "global_search_index_item_entity_handle_record_han_ccb79_unique" unique ("entity_handle", "record_handle", "field_path");`,
    );

    this.addSql(
      `drop index "role_starter_favorite_tpls_favorite_tpl_role_index";`,
    );
    this.addSql(
      `create index "role_item_starter_favorite_templates_favorite_temp_50784_index" on "role_item_starter_favorite_templates" ("favorite_template_item_handle");`,
    );

    this.addSql(
      `alter table "system_error_group_item" add constraint "system_error_group_item_environment_handle_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter index "system_error_group_status_last_seen_idx" rename to "system_error_group_item_status_last_seen_at_index";`,
    );

    this.addSql(
      `alter table "system_check_run_item" add constraint "system_check_run_item_environment_handle_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter index "system_check_run_environment_key_time_idx" rename to "system_check_run_item_environment_handle_check_key_68b3a_index";`,
    );

    this.addSql(
      `alter table "system_alert_incident_item" add constraint "system_alert_incident_item_environment_handle_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "system_alert_incident_item" add constraint "system_alert_incident_item_rule_handle_foreign" foreign key ("rule_handle") references "system_alert_rule_item" ("handle") on delete restrict;`,
    );
    this.addSql(
      `create index "system_alert_incident_item_last_seen_at_index" on "system_alert_incident_item" ("last_seen_at");`,
    );
    this.addSql(
      `alter index "system_alert_incident_fingerprint_idx" rename to "system_alert_incident_item_fingerprint_index";`,
    );
    this.addSql(
      `alter index "system_alert_incident_state_time_idx" rename to "system_alert_incident_item_state_last_seen_at_index";`,
    );

    this.addSql(
      `alter table "system_telemetry_instance_item" alter column "status" set default 'active';`,
    );
    this.addSql(
      `alter table "system_telemetry_instance_item" add constraint "system_telemetry_instance_item_environment_handle_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter index "system_telemetry_instance_last_sample_idx" rename to "system_telemetry_instance_item_last_sample_at_index";`,
    );
    this.addSql(
      `alter index "system_telemetry_instance_environment_slot_status_idx" rename to "system_telemetry_instance_item_environment_handle__7af8e_index";`,
    );

    this.addSql(
      `alter table "system_metric_bucket_item" add constraint "system_metric_bucket_item_instance_handle_foreign" foreign key ("instance_handle") references "system_telemetry_instance_item" ("handle") on delete cascade;`,
    );
    this.addSql(
      `create index "system_metric_bucket_item_bucket_start_index" on "system_metric_bucket_item" ("bucket_start");`,
    );
    this.addSql(
      `alter index "system_metric_bucket_series_idx" rename to "system_metric_bucket_item_metric_key_resolution_bu_6b325_index";`,
    );

    this.addSql(
      `alter table "system_error_occurrence_item" add constraint "system_error_occurrence_item_group_handle_foreign" foreign key ("group_handle") references "system_error_group_item" ("handle") on delete cascade;`,
    );
    this.addSql(
      `alter table "system_error_occurrence_item" add constraint "system_error_occurrence_item_environment_handle_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "system_error_occurrence_item" add constraint "system_error_occurrence_item_instance_handle_foreign" foreign key ("instance_handle") references "system_telemetry_instance_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter index "system_error_occurrence_environment_time_idx" rename to "system_error_occurrence_item_environment_handle_oc_98482_index";`,
    );
    this.addSql(
      `alter index "system_error_occurrence_group_time_idx" rename to "system_error_occurrence_item_group_handle_occurred_at_index";`,
    );

    this.addSql(
      `alter table "system_remediation_execution_item" add constraint "system_remediation_execution_item_environment_handle_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "system_remediation_execution_item" add constraint "system_remediation_execution_item_incident_handle_foreign" foreign key ("incident_handle") references "system_alert_incident_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "system_remediation_execution_item" add constraint "system_remediation_execution_item_approved_by_handle_foreign" foreign key ("approved_by_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter index "system_remediation_environment_time_idx" rename to "system_remediation_execution_item_environment_hand_9f822_index";`,
    );

    this.addSql(
      `alter index "session_store_last_seen_idx" rename to "session_store_item_last_seen_at_index";`,
    );

    this.addSql(
      `drop index "person_item_roles_role_item_handle_person_item_handle_index";`,
    );
    this.addSql(
      `create index "person_item_roles_role_item_handle_index" on "person_item_roles" ("role_item_handle");`,
    );

    this.addSql(
      `alter table "http_metric_bucket_item" add constraint "http_metric_bucket_item_environment_handle_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "http_metric_bucket_item" add constraint "http_metric_bucket_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "http_metric_bucket_item" add constraint "http_metric_bucket_item_api_token_handle_foreign" foreign key ("api_token_handle") references "person_api_token_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `create index "http_metric_bucket_item_bucket_start_index" on "http_metric_bucket_item" ("bucket_start");`,
    );
    this.addSql(
      `create index "http_metric_bucket_item_bucket_start_person_handle_index" on "http_metric_bucket_item" ("bucket_start", "person_handle");`,
    );

    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_item_mailbox_handle_foreign" foreign key ("mailbox_handle") references "shared_mailbox_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_item_processing_person_handle_foreign" foreign key ("processing_person_handle") references "person_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_item_agent_handle_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_item_processing_mode_handle_foreign" foreign key ("processing_mode_handle") references "email_inbox_processing_mode_item" ("handle") on update cascade;`,
    );

    this.addSql(
      `drop index "role_starter_dashboard_tpls_dashboard_tpl_role_index";`,
    );
    this.addSql(
      `create index "role_item_starter_dashboard_templates_dashboard_te_32fca_index" on "role_item_starter_dashboard_templates" ("dashboard_template_item_handle");`,
    );

    this.addSql(`drop index "dashboard_tpl_kpis_kpi_dashboard_tpl_index";`);
    this.addSql(
      `create index "dashboard_template_item_kpis_kpi_item_handle_index" on "dashboard_template_item_kpis" ("kpi_item_handle");`,
    );

    this.addSql(`drop index "dashboard_kpis_kpi_dashboard_index";`);
    this.addSql(
      `create index "dashboard_item_kpis_kpi_item_handle_index" on "dashboard_item_kpis" ("kpi_item_handle");`,
    );

    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_default_event_ty_d8955_foreign" foreign key ("default_event_type_handle") references "event_type_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_default_event_ca_44daa_foreign" foreign key ("default_event_category_handle") references "event_category_item" ("handle") on update cascade;`,
    );

    this.addSql(
      `alter table "authentication_event_item" add constraint "authentication_event_item_environment_handle_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "authentication_event_item" add constraint "authentication_event_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `create index "authentication_event_item_occurred_at_index" on "authentication_event_item" ("occurred_at");`,
    );
    this.addSql(
      `alter index "authentication_event_person_time_idx" rename to "authentication_event_item_person_handle_occurred_at_index";`,
    );

    this.addSql(
      `alter table "ai_usage_event_item" add constraint "ai_usage_event_item_environment_handle_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" add constraint "ai_usage_event_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `create index "ai_usage_event_item_occurred_at_index" on "ai_usage_event_item" ("occurred_at");`,
    );
    this.addSql(
      `create index "ai_usage_event_item_occurred_at_person_handle_index" on "ai_usage_event_item" ("occurred_at", "person_handle");`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" drop constraint "ai_usage_event_item_source_key_key";`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" add constraint "ai_usage_event_item_source_key_unique" unique ("source_key");`,
    );
    this.addSql(
      `alter index "ai_usage_event_provider_time_idx" rename to "ai_usage_event_item_provider_model_occurred_at_index";`,
    );

    this.addSql(
      `alter table "ai_chat_message_item" drop constraint "ai_chat_message_item_rating_check";`,
    );
    this.addSql(
      `alter table "ai_chat_message_item" add constraint "ai_chat_message_item_rating_check" check (rating in (-1, 1));`,
    );

    this.addSql(
      `alter index "ai_chat_queued_input_item_session_handle_status_mode_created_at" rename to "ai_chat_queued_input_item_session_handle_status_mo_348f2_index";`,
    );

    this.addSql(
      `alter table "ticket_item" alter column "priority_handle" set default 'normal';`,
    );
    this.addSql(
      `alter table "ticket_item" alter column "status_handle" set default 'open';`,
    );

    this.addSql(
      `alter table "effort_estimate_item" alter column "status_handle" set default 'open';`,
    );

    this.addSql(
      `alter table "internal_case_item" alter column "status_handle" set default 'open';`,
    );

    this.addSql(
      `alter table "event_item" alter column "status_handle" set default 'scheduled';`,
    );

    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_status_handle_foreign" foreign key ("status_handle") references "inbound_email_status_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_mailbox_handle_foreign" foreign key ("mailbox_handle") references "shared_mailbox_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_subscription_handle_foreign" foreign key ("subscription_handle") references "email_inbox_subscription_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_company_handle_foreign" foreign key ("company_handle") references "company_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_ticket_handle_foreign" foreign key ("ticket_handle") references "ticket_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_sales_opportunity_handle_foreign" foreign key ("sales_opportunity_handle") references "sales_opportunity_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_office_task_handle_foreign" foreign key ("office_task_handle") references "event_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_source_document_handle_foreign" foreign key ("source_document_handle") references "document_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_agent_handle_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_ai_session_handle_foreign" foreign key ("ai_session_handle") references "ai_chat_session_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_ai_message_handle_foreign" foreign key ("ai_message_handle") references "ai_chat_message_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_source_document_unique";`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_source_document_handle_unique" unique ("source_document_handle");`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_mailbox_provider_message_unique";`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_mailbox_handle_provider_message_id_unique" unique ("mailbox_handle", "provider_message_id");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "ai_usage_event_item" drop constraint "ai_usage_event_item_environment_handle_foreign";`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" drop constraint "ai_usage_event_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "authentication_event_item" drop constraint "authentication_event_item_environment_handle_foreign";`,
    );
    this.addSql(
      `alter table "authentication_event_item" drop constraint "authentication_event_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "calendar_sync_subscription_item" drop constraint "calendar_sync_subscription_item_default_event_ty_d8955_foreign";`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item" drop constraint "calendar_sync_subscription_item_default_event_ca_44daa_foreign";`,
    );

    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" drop constraint "dvelop_entity_mapping_search_category_item_mappi_e6b27_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" drop constraint "dvelop_entity_mapping_search_category_item_objec_901f8_foreign";`,
    );

    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_item_mailbox_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_item_processing_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_item_agent_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_item_processing_mode_handle_foreign";`,
    );

    this.addSql(
      `alter table "http_metric_bucket_item" drop constraint "http_metric_bucket_item_environment_handle_foreign";`,
    );
    this.addSql(
      `alter table "http_metric_bucket_item" drop constraint "http_metric_bucket_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "http_metric_bucket_item" drop constraint "http_metric_bucket_item_api_token_handle_foreign";`,
    );

    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_status_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_mailbox_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_subscription_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_person_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_ticket_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_sales_opportunity_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_office_task_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_source_document_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_agent_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_ai_session_handle_foreign";`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_ai_message_handle_foreign";`,
    );

    this.addSql(
      `alter table "system_alert_incident_item" drop constraint "system_alert_incident_item_environment_handle_foreign";`,
    );
    this.addSql(
      `alter table "system_alert_incident_item" drop constraint "system_alert_incident_item_rule_handle_foreign";`,
    );

    this.addSql(
      `alter table "system_check_run_item" drop constraint "system_check_run_item_environment_handle_foreign";`,
    );

    this.addSql(
      `alter table "system_error_group_item" drop constraint "system_error_group_item_environment_handle_foreign";`,
    );

    this.addSql(
      `alter table "system_error_occurrence_item" drop constraint "system_error_occurrence_item_group_handle_foreign";`,
    );
    this.addSql(
      `alter table "system_error_occurrence_item" drop constraint "system_error_occurrence_item_environment_handle_foreign";`,
    );
    this.addSql(
      `alter table "system_error_occurrence_item" drop constraint "system_error_occurrence_item_instance_handle_foreign";`,
    );

    this.addSql(
      `alter table "system_metric_bucket_item" drop constraint "system_metric_bucket_item_instance_handle_foreign";`,
    );

    this.addSql(
      `alter table "system_remediation_execution_item" drop constraint "system_remediation_execution_item_environment_handle_foreign";`,
    );
    this.addSql(
      `alter table "system_remediation_execution_item" drop constraint "system_remediation_execution_item_incident_handle_foreign";`,
    );
    this.addSql(
      `alter table "system_remediation_execution_item" drop constraint "system_remediation_execution_item_approved_by_handle_foreign";`,
    );

    this.addSql(
      `alter table "system_telemetry_instance_item" drop constraint "system_telemetry_instance_item_environment_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_chat_message_item" drop constraint "ai_chat_message_item_rating_check";`,
    );
    this.addSql(
      `alter table "ai_chat_message_item" add constraint "ai_chat_message_item_rating_check" check ("rating" in ('-1'));`,
    );

    this.addSql(
      `alter index "ai_chat_queued_input_item_session_handle_status_mo_348f2_index" rename to "ai_chat_queued_input_item_session_handle_status_mode_created_at";`,
    );

    this.addSql(`drop index "ai_usage_event_item_occurred_at_index";`);
    this.addSql(
      `drop index "ai_usage_event_item_occurred_at_person_handle_index";`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" add constraint "ai_usage_event_item_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" add constraint "ai_usage_event_person_fk" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" drop constraint "ai_usage_event_item_source_key_unique";`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" add constraint "ai_usage_event_item_source_key_key" unique ("source_key");`,
    );
    this.addSql(
      `alter index "ai_usage_event_item_provider_model_occurred_at_index" rename to "ai_usage_event_provider_time_idx";`,
    );

    this.addSql(`drop index "authentication_event_item_occurred_at_index";`);
    this.addSql(
      `alter table "authentication_event_item" add constraint "authentication_event_item_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "authentication_event_item" add constraint "authentication_event_person_fk" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter index "authentication_event_item_person_handle_occurred_at_index" rename to "authentication_event_person_time_idx";`,
    );

    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_default_event_category_handle_f" foreign key ("default_event_category_handle") references "event_category_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_default_event_type_handle_forei" foreign key ("default_event_type_handle") references "event_type_item" ("handle") on update cascade;`,
    );

    this.addSql(`drop index "dashboard_item_kpis_kpi_item_handle_index";`);
    this.addSql(
      `create index "dashboard_kpis_kpi_dashboard_index" on "dashboard_item_kpis" ("kpi_item_handle", "dashboard_item_handle");`,
    );

    this.addSql(
      `drop index "dashboard_template_item_kpis_kpi_item_handle_index";`,
    );
    this.addSql(
      `create index "dashboard_tpl_kpis_kpi_dashboard_tpl_index" on "dashboard_template_item_kpis" ("kpi_item_handle", "dashboard_template_item_handle");`,
    );

    this.addSql(
      `alter table "dvelop_entity_mapping_property_item" drop constraint "dvelop_entity_mapping_property_item_mapping_handl_7a4c6_unique";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_property_item" add constraint "dvelop_entity_mapping_property_item_mapping_handle_property_han" unique ("mapping_handle", "property_handle");`,
    );

    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" add constraint "dvelop_entity_mapping_search_category_item_mapping_handle_forei" foreign key ("mapping_handle") references "dvelop_entity_mapping_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" add constraint "dvelop_entity_mapping_search_category_item_object_definition_ha" foreign key ("object_definition_handle") references "dvelop_object_definition_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" drop constraint "dvelop_entity_mapping_search_category_item_mappin_fec76_unique";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" add constraint "dvelop_entity_mapping_search_category_item_mapping_handle_objec" unique ("mapping_handle", "object_definition_handle");`,
    );

    this.addSql(
      `alter table "dvelop_object_definition_item" drop constraint "dvelop_object_definition_item_connection_handle_d_24dad_unique";`,
    );
    this.addSql(
      `alter table "dvelop_object_definition_item" add constraint "dvelop_object_definition_item_connection_handle_dvelop_id_uniqu" unique ("connection_handle", "dvelop_id");`,
    );

    this.addSql(
      `alter table "dvelop_property_item" drop constraint "dvelop_property_item_connection_handle_object_def_4cba0_unique";`,
    );
    this.addSql(
      `alter table "dvelop_property_item" add constraint "dvelop_property_item_connection_handle_object_definition_handle" unique ("connection_handle", "object_definition_handle", "dvelop_id");`,
    );

    this.addSql(
      `alter table "effort_estimate_item" alter column "status_handle" drop default;`,
    );

    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_agent_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_mailbox_foreign" foreign key ("mailbox_handle") references "shared_mailbox_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_person_foreign" foreign key ("processing_person_handle") references "person_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_processing_mode_foreign" foreign key ("processing_mode_handle") references "email_inbox_processing_mode_item" ("handle") on update cascade;`,
    );

    this.addSql(
      `alter table "event_item" alter column "status_handle" drop default;`,
    );

    this.addSql(
      `alter table "global_search_index_item" drop constraint "global_search_index_item_entity_handle_record_han_ccb79_unique";`,
    );
    this.addSql(
      `alter table "global_search_index_item" add constraint "global_search_index_item_record_field_unique" unique ("entity_handle", "record_handle", "field_path");`,
    );

    this.addSql(`drop index "http_metric_bucket_item_bucket_start_index";`);
    this.addSql(
      `drop index "http_metric_bucket_item_bucket_start_person_handle_index";`,
    );
    this.addSql(
      `alter table "http_metric_bucket_item" add constraint "http_metric_bucket_item_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "http_metric_bucket_item" add constraint "http_metric_bucket_person_fk" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "http_metric_bucket_item" add constraint "http_metric_bucket_token_fk" foreign key ("api_token_handle") references "person_api_token_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_agent_foreign" foreign key ("agent_handle") references "ai_agent_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_ai_message_foreign" foreign key ("ai_message_handle") references "ai_chat_message_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_ai_session_foreign" foreign key ("ai_session_handle") references "ai_chat_session_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_company_foreign" foreign key ("company_handle") references "company_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_mailbox_foreign" foreign key ("mailbox_handle") references "shared_mailbox_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_office_task_foreign" foreign key ("office_task_handle") references "event_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_person_foreign" foreign key ("person_handle") references "person_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_sales_opportunity_foreign" foreign key ("sales_opportunity_handle") references "sales_opportunity_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_source_document_foreign" foreign key ("source_document_handle") references "document_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_status_foreign" foreign key ("status_handle") references "inbound_email_status_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_subscription_foreign" foreign key ("subscription_handle") references "email_inbox_subscription_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_ticket_foreign" foreign key ("ticket_handle") references "ticket_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_mailbox_handle_provider_message_id_unique";`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_mailbox_provider_message_unique" unique ("mailbox_handle", "provider_message_id");`,
    );
    this.addSql(
      `alter table "inbound_email_item" drop constraint "inbound_email_item_source_document_handle_unique";`,
    );
    this.addSql(
      `alter table "inbound_email_item" add constraint "inbound_email_item_source_document_unique" unique ("source_document_handle");`,
    );

    this.addSql(
      `alter table "internal_case_item" alter column "status_handle" drop default;`,
    );

    this.addSql(`drop index "person_item_roles_role_item_handle_index";`);
    this.addSql(
      `create index "person_item_roles_role_item_handle_person_item_handle_index" on "person_item_roles" ("role_item_handle", "person_item_handle");`,
    );

    this.addSql(
      `drop index "role_item_starter_dashboard_templates_dashboard_te_32fca_index";`,
    );
    this.addSql(
      `create index "role_starter_dashboard_tpls_dashboard_tpl_role_index" on "role_item_starter_dashboard_templates" ("dashboard_template_item_handle", "role_item_handle");`,
    );

    this.addSql(
      `drop index "role_item_starter_favorite_templates_favorite_temp_50784_index";`,
    );
    this.addSql(
      `create index "role_starter_favorite_tpls_favorite_tpl_role_index" on "role_item_starter_favorite_templates" ("favorite_template_item_handle", "role_item_handle");`,
    );

    this.addSql(
      `alter index "session_store_item_last_seen_at_index" rename to "session_store_last_seen_idx";`,
    );

    this.addSql(`drop index "system_alert_incident_item_last_seen_at_index";`);
    this.addSql(
      `alter table "system_alert_incident_item" add constraint "system_alert_incident_item_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "system_alert_incident_item" add constraint "system_alert_incident_rule_fk" foreign key ("rule_handle") references "system_alert_rule_item" ("handle") on delete restrict;`,
    );
    this.addSql(
      `alter index "system_alert_incident_item_fingerprint_index" rename to "system_alert_incident_fingerprint_idx";`,
    );
    this.addSql(
      `alter index "system_alert_incident_item_state_last_seen_at_index" rename to "system_alert_incident_state_time_idx";`,
    );

    this.addSql(
      `alter table "system_check_run_item" add constraint "system_check_run_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter index "system_check_run_item_environment_handle_check_key_68b3a_index" rename to "system_check_run_environment_key_time_idx";`,
    );

    this.addSql(
      `alter table "system_error_group_item" add constraint "system_error_group_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter index "system_error_group_item_status_last_seen_at_index" rename to "system_error_group_status_last_seen_idx";`,
    );

    this.addSql(
      `alter table "system_error_occurrence_item" add constraint "system_error_occurrence_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "system_error_occurrence_item" add constraint "system_error_occurrence_group_foreign" foreign key ("group_handle") references "system_error_group_item" ("handle") on delete cascade;`,
    );
    this.addSql(
      `alter table "system_error_occurrence_item" add constraint "system_error_occurrence_instance_foreign" foreign key ("instance_handle") references "system_telemetry_instance_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter index "system_error_occurrence_item_environment_handle_oc_98482_index" rename to "system_error_occurrence_environment_time_idx";`,
    );
    this.addSql(
      `alter index "system_error_occurrence_item_group_handle_occurred_at_index" rename to "system_error_occurrence_group_time_idx";`,
    );

    this.addSql(`drop index "system_metric_bucket_item_bucket_start_index";`);
    this.addSql(
      `alter table "system_metric_bucket_item" add constraint "system_metric_bucket_instance_fk" foreign key ("instance_handle") references "system_telemetry_instance_item" ("handle") on delete cascade;`,
    );
    this.addSql(
      `alter index "system_metric_bucket_item_metric_key_resolution_bu_6b325_index" rename to "system_metric_bucket_series_idx";`,
    );

    this.addSql(
      `alter table "system_remediation_execution_item" add constraint "system_remediation_approved_by_foreign" foreign key ("approved_by_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "system_remediation_execution_item" add constraint "system_remediation_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "system_remediation_execution_item" add constraint "system_remediation_incident_foreign" foreign key ("incident_handle") references "system_alert_incident_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter index "system_remediation_execution_item_environment_hand_9f822_index" rename to "system_remediation_environment_time_idx";`,
    );

    this.addSql(
      `alter table "system_telemetry_instance_item" alter column "status" set default 'retired';`,
    );
    this.addSql(
      `alter table "system_telemetry_instance_item" add constraint "system_telemetry_instance_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter index "system_telemetry_instance_item_environment_handle__7af8e_index" rename to "system_telemetry_instance_environment_slot_status_idx";`,
    );
    this.addSql(
      `alter index "system_telemetry_instance_item_last_sample_at_index" rename to "system_telemetry_instance_last_sample_idx";`,
    );

    this.addSql(
      `alter table "ticket_item" alter column "status_handle" drop default;`,
    );
    this.addSql(
      `alter table "ticket_item" alter column "priority_handle" drop default;`,
    );
  }
}
