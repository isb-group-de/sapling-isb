import { Migration } from '@mikro-orm/migrations';

type IndexDefinition = {
  name: string;
  table: string;
  columns: string[];
};

const ADDITIONAL_INDEXES: IndexDefinition[] = [
  {
    name: 'ticket_item_start_date_index',
    table: 'ticket_item',
    columns: ['start_date'],
  },
  {
    name: 'ticket_item_end_date_index',
    table: 'ticket_item',
    columns: ['end_date'],
  },
  {
    name: 'ticket_item_deadline_date_index',
    table: 'ticket_item',
    columns: ['deadline_date'],
  },
  {
    name: 'ticket_item_created_at_index',
    table: 'ticket_item',
    columns: ['created_at'],
  },
  {
    name: 'ticket_item_updated_at_index',
    table: 'ticket_item',
    columns: ['updated_at'],
  },
  {
    name: 'ticket_assignee_prs_status_deadline_date_index',
    table: 'ticket_item',
    columns: ['assignee_person_handle', 'status_handle', 'deadline_date'],
  },
  {
    name: 'ticket_item_creator_company_handle_updated_at_index',
    table: 'ticket_item',
    columns: ['creator_company_handle', 'updated_at'],
  },
  {
    name: 'ticket_item_sales_opportunity_handle_updated_at_index',
    table: 'ticket_item',
    columns: ['sales_opportunity_handle', 'updated_at'],
  },
  {
    name: 'ticket_item_contract_handle_updated_at_index',
    table: 'ticket_item',
    columns: ['contract_handle', 'updated_at'],
  },

  {
    name: 'event_item_start_date_index',
    table: 'event_item',
    columns: ['start_date'],
  },
  {
    name: 'event_item_end_date_index',
    table: 'event_item',
    columns: ['end_date'],
  },
  {
    name: 'event_item_created_at_index',
    table: 'event_item',
    columns: ['created_at'],
  },
  {
    name: 'event_item_updated_at_index',
    table: 'event_item',
    columns: ['updated_at'],
  },
  {
    name: 'event_item_private_creator_index',
    table: 'event_item',
    columns: ['is_private', 'creator_person_handle'],
  },
  {
    name: 'event_item_status_handle_start_date_end_date_index',
    table: 'event_item',
    columns: ['status_handle', 'start_date', 'end_date'],
  },
  {
    name: 'event_assignee_prs_status_start_date_index',
    table: 'event_item',
    columns: ['assignee_person_handle', 'status_handle', 'start_date'],
  },
  {
    name: 'event_item_ticket_handle_start_date_index',
    table: 'event_item',
    columns: ['ticket_handle', 'start_date'],
  },
  {
    name: 'event_item_sales_opportunity_handle_start_date_index',
    table: 'event_item',
    columns: ['sales_opportunity_handle', 'start_date'],
  },

  {
    name: 'sales_opportunity_item_close_date_index',
    table: 'sales_opportunity_item',
    columns: ['close_date'],
  },
  {
    name: 'sales_opportunity_item_created_at_index',
    table: 'sales_opportunity_item',
    columns: ['created_at'],
  },
  {
    name: 'sales_opportunity_item_updated_at_index',
    table: 'sales_opportunity_item',
    columns: ['updated_at'],
  },
  {
    name: 'sales_opportunity_item_is_active_index',
    table: 'sales_opportunity_item',
    columns: ['is_active'],
  },
  {
    name: 'sales_opp_assignee_prs_is_active_type_index',
    table: 'sales_opportunity_item',
    columns: ['assignee_person_handle', 'is_active', 'type_handle'],
  },
  {
    name: 'sales_opportunity_item_creator_company_handle_updated_at_index',
    table: 'sales_opportunity_item',
    columns: ['creator_company_handle', 'updated_at'],
  },

  {
    name: 'effort_est_assignee_prs_is_active_status_index',
    table: 'effort_estimate_item',
    columns: ['assignee_person_handle', 'is_active', 'status_handle'],
  },
  {
    name: 'effort_estimate_item_sales_opportunity_handle_updated_at_index',
    table: 'effort_estimate_item',
    columns: ['sales_opportunity_handle', 'updated_at'],
  },
  {
    name: 'effort_estimate_item_ticket_handle_updated_at_index',
    table: 'effort_estimate_item',
    columns: ['ticket_handle', 'updated_at'],
  },

  {
    name: 'internal_case_responsible_prs_status_index',
    table: 'internal_case_item',
    columns: ['responsible_person_handle', 'status_handle'],
  },
  {
    name: 'internal_case_item_customer_company_handle_updated_at_index',
    table: 'internal_case_item',
    columns: ['customer_company_handle', 'updated_at'],
  },
  {
    name: 'internal_case_item_customer_person_handle_updated_at_index',
    table: 'internal_case_item',
    columns: ['customer_person_handle', 'updated_at'],
  },

  {
    name: 'custom_field_value_item_string_filter_index',
    table: 'custom_field_value_item',
    columns: ['entity_handle', 'definition_handle', 'value_string'],
  },
  {
    name: 'custom_field_value_item_number_filter_index',
    table: 'custom_field_value_item',
    columns: ['entity_handle', 'definition_handle', 'value_number'],
  },
  {
    name: 'custom_field_value_item_boolean_filter_index',
    table: 'custom_field_value_item',
    columns: ['entity_handle', 'definition_handle', 'value_boolean'],
  },
  {
    name: 'custom_field_value_item_date_filter_index',
    table: 'custom_field_value_item',
    columns: ['entity_handle', 'definition_handle', 'value_date'],
  },
  {
    name: 'custom_field_value_item_datetime_filter_index',
    table: 'custom_field_value_item',
    columns: ['entity_handle', 'definition_handle', 'value_date_time'],
  },
  {
    name: 'custom_field_definition_entity_active_order_key_index',
    table: 'custom_field_definition_item',
    columns: ['entity_handle', 'is_active', 'field_order', 'field_key'],
  },
  {
    name: 'custom_field_value_definition_record_reference_index',
    table: 'custom_field_value_item',
    columns: ['definition_handle', 'record_reference'],
  },

  {
    name: 'inbox_notif_recipient_prs_is_read_created_at_index',
    table: 'inbox_notification_item',
    columns: ['recipient_person_handle', 'is_read', 'created_at', 'handle'],
  },
  {
    name: 'inbox_notification_item_entity_handle_reference_handle_index',
    table: 'inbox_notification_item',
    columns: ['entity_handle', 'reference_handle'],
  },
  {
    name: 'change_log_entity_reference_created_at_index',
    table: 'change_log_item',
    columns: ['entity_handle', 'reference', 'created_at', 'handle'],
  },
  {
    name: 'change_log_item_person_handle_created_at_index',
    table: 'change_log_item',
    columns: ['person_handle', 'created_at'],
  },
  {
    name: 'document_item_entity_handle_reference_created_at_index',
    table: 'document_item',
    columns: ['entity_handle', 'reference', 'created_at'],
  },
  {
    name: 'phone_call_item_entity_handle_reference_created_at_index',
    table: 'phone_call_item',
    columns: ['entity_handle', 'reference', 'created_at'],
  },
  {
    name: 'note_item_person_handle_updated_at_index',
    table: 'note_item',
    columns: ['person_handle', 'updated_at'],
  },

  {
    name: 'import_batch_row_item_batch_handle_row_number_index',
    table: 'import_batch_row_item',
    columns: ['batch_handle', 'row_number'],
  },
  {
    name: 'import_batch_row_item_batch_handle_status_index',
    table: 'import_batch_row_item',
    columns: ['batch_handle', 'status'],
  },
  {
    name: 'import_batch_item_target_entity_handle_updated_at_index',
    table: 'import_batch_item',
    columns: ['target_entity_handle', 'updated_at'],
  },
  {
    name: 'external_record_link_entity_external_key_hash_index',
    table: 'external_record_link_item',
    columns: ['entity_handle', 'external_key_hash'],
  },
  {
    name: 'external_record_link_item_entity_reference_index',
    table: 'external_record_link_item',
    columns: ['entity_handle', 'reference'],
  },

  {
    name: 'favorite_item_person_handle_entity_handle_index',
    table: 'favorite_item',
    columns: ['person_handle', 'entity_handle'],
  },
  {
    name: 'dashboard_item_person_handle_updated_at_index',
    table: 'dashboard_item',
    columns: ['person_handle', 'updated_at'],
  },
  {
    name: 'dashboard_tpl_kpis_kpi_dashboard_tpl_index',
    table: 'dashboard_template_item_kpis',
    columns: ['kpi_item_handle', 'dashboard_template_item_handle'],
  },
  {
    name: 'dashboard_kpis_kpi_dashboard_index',
    table: 'dashboard_item_kpis',
    columns: ['kpi_item_handle', 'dashboard_item_handle'],
  },
  {
    name: 'role_starter_dashboard_tpls_dashboard_tpl_role_index',
    table: 'role_item_starter_dashboard_templates',
    columns: ['dashboard_template_item_handle', 'role_item_handle'],
  },
  {
    name: 'role_starter_favorite_tpls_favorite_tpl_role_index',
    table: 'role_item_starter_favorite_templates',
    columns: ['favorite_template_item_handle', 'role_item_handle'],
  },
  {
    name: 'person_item_roles_role_item_handle_person_item_handle_index',
    table: 'person_item_roles',
    columns: ['role_item_handle', 'person_item_handle'],
  },

  {
    name: 'ai_chat_session_prs_is_archived_updated_at_index',
    table: 'ai_chat_session_item',
    columns: ['person_handle', 'is_archived', 'updated_at'],
  },
  {
    name: 'ai_chat_session_context_entity_context_record_updated_at_index',
    table: 'ai_chat_session_item',
    columns: ['context_entity_handle', 'context_record_handle', 'updated_at'],
  },
  {
    name: 'ai_chat_message_item_session_handle_sequence_index',
    table: 'ai_chat_message_item',
    columns: ['session_handle', 'sequence'],
  },
  {
    name: 'ai_chat_tool_action_item_session_handle_created_at_index',
    table: 'ai_chat_tool_action_item',
    columns: ['session_handle', 'created_at'],
  },
  {
    name: 'ai_chat_attachment_item_session_handle_handle_index',
    table: 'ai_chat_attachment_item',
    columns: ['session_handle', 'handle'],
  },
  {
    name: 'ai_agent_run_item_session_handle_started_at_index',
    table: 'ai_agent_run_item',
    columns: ['session_handle', 'started_at'],
  },
  {
    name: 'ai_agent_run_item_person_handle_started_at_index',
    table: 'ai_agent_run_item',
    columns: ['person_handle', 'started_at'],
  },
  {
    name: 'ai_vector_document_source_entity_source_record_updated_idx',
    table: 'ai_vector_document_item',
    columns: ['source_entity_handle', 'source_record_handle', 'updated_at'],
  },
  {
    name: 'ai_vector_document_provider_model_updated_at_index',
    table: 'ai_vector_document_item',
    columns: ['provider_handle', 'model_handle', 'updated_at'],
  },

  {
    name: 'email_delivery_item_status_handle_next_retry_at_index',
    table: 'email_delivery_item',
    columns: ['status_handle', 'next_retry_at'],
  },
  {
    name: 'teams_delivery_item_status_handle_next_retry_at_index',
    table: 'teams_delivery_item',
    columns: ['status_handle', 'next_retry_at'],
  },
  {
    name: 'webhook_delivery_item_status_handle_next_retry_at_index',
    table: 'webhook_delivery_item',
    columns: ['status_handle', 'next_retry_at'],
  },
  {
    name: 'event_delivery_item_status_handle_event_handle_index',
    table: 'event_delivery_item',
    columns: ['status_handle', 'event_handle'],
  },
  {
    name: 'calendar_sync_subscription_item_is_active_last_run_at_index',
    table: 'calendar_sync_subscription_item',
    columns: ['is_active', 'last_run_at'],
  },
  {
    name: 'person_session_item_person_handle_updated_at_index',
    table: 'person_session_item',
    columns: ['person_handle', 'updated_at'],
  },
  {
    name: 'session_store_item_updated_at_index',
    table: 'session_store_item',
    columns: ['updated_at'],
  },

  {
    name: 'kpi_item_target_entity_handle_type_handle_index',
    table: 'kpi_item',
    columns: ['target_entity_handle', 'type_handle'],
  },
  {
    name: 'kpi_item_timeframe_handle_timeframe_interval_handle_index',
    table: 'kpi_item',
    columns: ['timeframe_handle', 'timeframe_interval_handle'],
  },
  {
    name: 'sapling_form_config_entity_prs_scope_is_default_index',
    table: 'sapling_form_config_item',
    columns: ['entity_handle', 'person_handle', 'scope', 'is_default'],
  },
  {
    name: 'translation_item_language_handle_entity_property_index',
    table: 'translation_item',
    columns: ['language_handle', 'entity', 'property'],
  },
  {
    name: 'entity_route_item_entity_handle_route_index',
    table: 'entity_route_item',
    columns: ['entity_handle', 'route'],
  },
  {
    name: 'entity_item_group_handle_sort_order_handle_index',
    table: 'entity_item',
    columns: ['group_handle', 'sort_order', 'handle'],
  },

  {
    name: 'company_item_account_manager_handle_updated_at_index',
    table: 'company_item',
    columns: ['account_manager_handle', 'updated_at'],
  },
  {
    name: 'company_item_customer_success_manager_handle_updated_at_index',
    table: 'company_item',
    columns: ['customer_success_manager_handle', 'updated_at'],
  },
  {
    name: 'person_item_company_handle_updated_at_index',
    table: 'person_item',
    columns: ['company_handle', 'updated_at'],
  },
  {
    name: 'address_item_company_handle_type_handle_index',
    table: 'address_item',
    columns: ['company_handle', 'type_handle'],
  },
  {
    name: 'marketing_campaign_owner_prs_status_index',
    table: 'marketing_campaign_item',
    columns: ['owner_person_handle', 'status_handle'],
  },
  {
    name: 'contract_item_company_handle_end_date_index',
    table: 'contract_item',
    columns: ['company_handle', 'end_date'],
  },
  {
    name: 'ticket_time_tracking_item_ticket_handle_created_at_index',
    table: 'ticket_time_tracking_item',
    columns: ['ticket_handle', 'created_at'],
  },
  {
    name: 'knowledge_article_item_status_handle_updated_at_index',
    table: 'knowledge_article_item',
    columns: ['status_handle', 'updated_at'],
  },
  {
    name: 'knowledge_article_item_product_handle_updated_at_index',
    table: 'knowledge_article_item',
    columns: ['product_handle', 'updated_at'],
  },
];

export class Migration20260713120000 extends Migration {
  override up(): void {
    for (const index of ADDITIONAL_INDEXES) {
      this.addSql(this.createIndexSql(index));
    }

    this.addSql(this.createMissingForeignKeyIndexesSql());
  }

  override down(): void {
    this.addSql(this.dropMissingForeignKeyIndexesSql());

    for (const index of [...ADDITIONAL_INDEXES].reverse()) {
      this.addSql(`drop index "${index.name}";`);
    }
  }

  private createIndexSql(index: IndexDefinition): string {
    const columns = index.columns.map((column) => `"${column}"`).join(', ');
    return `create index "${index.name}" on "${index.table}" (${columns});`;
  }

  private createMissingForeignKeyIndexesSql(): string {
    return `
do $$
declare
  fk record;
  base_name text;
  compact_name text;
  index_name text;
  quoted_columns text;
begin
  for fk in
    select
      tc.table_name,
      array_agg(kcu.column_name order by kcu.ordinal_position) as columns
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
      and kcu.constraint_name = tc.constraint_name
      and kcu.table_schema = tc.table_schema
      and kcu.table_name = tc.table_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = current_schema()
      and tc.table_name not like 'dvelop\\_%' escape '\\'
    group by tc.table_name, tc.constraint_name
  loop
    if exists (
      select 1
      from pg_class table_class
      join pg_namespace namespace on namespace.oid = table_class.relnamespace
      join pg_index indexed on indexed.indrelid = table_class.oid
      join pg_attribute first_column
        on first_column.attrelid = table_class.oid
        and first_column.attnum = indexed.indkey[0]
      where namespace.nspname = current_schema()
        and table_class.relname = fk.table_name
        and indexed.indisvalid
        and first_column.attname = fk.columns[1]
    ) then
      continue;
    end if;

    base_name := fk.table_name || '_' || array_to_string(fk.columns, '_') || '_index';
    index_name := base_name;

    if length(index_name) > 63 then
      compact_name := regexp_replace(base_name, '(_item|_handle)', '', 'g');
      index_name := left(compact_name, 49) || '_' || substr(md5(base_name), 1, 8) || '_idx';
    end if;

    select string_agg(format('%I', column_name), ', ')
      into quoted_columns
    from unnest(fk.columns) as column_name;

    execute format(
      'create index %I on %I (%s)',
      index_name,
      fk.table_name,
      quoted_columns
    );
  end loop;
end $$;`;
  }

  private dropMissingForeignKeyIndexesSql(): string {
    return `
do $$
declare
  fk record;
  base_name text;
  compact_name text;
  index_name text;
begin
  for fk in
    select
      tc.table_name,
      array_agg(kcu.column_name order by kcu.ordinal_position) as columns
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
      and kcu.constraint_name = tc.constraint_name
      and kcu.table_schema = tc.table_schema
      and kcu.table_name = tc.table_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = current_schema()
      and tc.table_name not like 'dvelop\\_%' escape '\\'
    group by tc.table_name, tc.constraint_name
  loop
    base_name := fk.table_name || '_' || array_to_string(fk.columns, '_') || '_index';
    index_name := base_name;

    if length(index_name) > 63 then
      compact_name := regexp_replace(base_name, '(_item|_handle)', '', 'g');
      index_name := left(compact_name, 49) || '_' || substr(md5(base_name), 1, 8) || '_idx';
    end if;

    execute format('drop index if exists %I', index_name);
  end loop;
end $$;`;
  }
}
