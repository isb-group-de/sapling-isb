import { Migration } from '@mikro-orm/migrations';

export class Migration20260910125036_PersonDeleteRules extends Migration {
  override name = 'Migration20260910125036_PersonDeleteRules';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "teams_delivery_item" drop constraint "teams_delivery_item_created_by_handle_foreign";`,
    );

    this.addSql(
      `alter table "social_media_item" drop constraint "social_media_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "sapling_form_config_item" drop constraint "sapling_form_config_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_creator_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "phone_call_item" drop constraint "phone_call_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "person_passkey_item" drop constraint "person_passkey_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "person_api_token_item" drop constraint "person_api_token_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "information_item" drop constraint "information_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "import_batch_item" drop constraint "import_batch_item_created_by_handle_foreign";`,
    );

    this.addSql(
      `alter table "email_subscription_item" drop constraint "email_subscription_item_sender_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_item_processing_person_handle_foreign";`,
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
      `alter table "automation_event_item" drop constraint "automation_event_item_actor_handle_foreign";`,
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
      `alter table "ai_chat_queued_input_item" drop constraint "ai_chat_queued_input_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_chat_attachment_item" drop constraint "ai_chat_attachment_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_agent_run_item" drop constraint "ai_agent_run_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "email_delivery_item" drop constraint "email_delivery_item_created_by_handle_foreign";`,
    );

    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_creator_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ticket_time_tracking_item" drop constraint "ticket_time_tracking_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ticket_time_tracking_item" drop constraint "ticket_time_tracking_item_ticket_handle_foreign";`,
    );

    this.addSql(
      `alter table "event_item" drop constraint "event_item_creator_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "teams_delivery_item" alter column "created_by_handle" drop not null;`,
    );
    this.addSql(
      `alter table "teams_delivery_item" add constraint "teams_delivery_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "social_media_item" add constraint "social_media_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "sapling_form_config_item" add constraint "sapling_form_config_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "sales_opportunity_item" alter column "creator_person_handle" drop not null;`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "phone_call_item" alter column "person_handle" drop not null;`,
    );
    this.addSql(
      `alter table "phone_call_item" add constraint "phone_call_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "person_passkey_item" add constraint "person_passkey_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "person_api_token_item" add constraint "person_api_token_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "information_item" alter column "person_handle" drop not null;`,
    );
    this.addSql(
      `alter table "information_item" add constraint "information_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "import_batch_item" alter column "created_by_handle" drop not null;`,
    );
    this.addSql(
      `alter table "import_batch_item" add constraint "import_batch_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_sender_person_handle_foreign" foreign key ("sender_person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_item_processing_person_handle_foreign" foreign key ("processing_person_handle") references "person_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "document_item" alter column "person_handle" drop not null;`,
    );
    this.addSql(
      `alter table "document_item" add constraint "document_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "dashboard_template_item" add constraint "dashboard_template_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "dashboard_item" add constraint "dashboard_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "change_log_item" alter column "person_handle" drop not null;`,
    );
    this.addSql(
      `alter table "change_log_item" add constraint "change_log_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "automation_event_item" add constraint "automation_event_item_actor_handle_foreign" foreign key ("actor_handle") references "person_item" ("handle") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "ai_chat_session_item" add constraint "ai_chat_session_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "ai_chat_message_item" add constraint "ai_chat_message_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "ai_chat_transcription_item" add constraint "ai_chat_transcription_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "ai_chat_tool_action_item" add constraint "ai_chat_tool_action_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "ai_chat_queued_input_item" add constraint "ai_chat_queued_input_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "ai_chat_attachment_item" add constraint "ai_chat_attachment_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "ai_agent_run_item" add constraint "ai_agent_run_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "email_delivery_item" alter column "created_by_handle" drop not null;`,
    );
    this.addSql(
      `alter table "email_delivery_item" add constraint "email_delivery_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "ticket_item" alter column "creator_person_handle" drop not null;`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "ticket_time_tracking_item" alter column "person_handle" drop not null;`,
    );
    this.addSql(
      `alter table "ticket_time_tracking_item" add constraint "ticket_time_tracking_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "ticket_time_tracking_item" add constraint "ticket_time_tracking_item_ticket_handle_foreign" foreign key ("ticket_handle") references "ticket_item" ("handle") on delete cascade;`,
    );

    this.addSql(
      `alter table "event_item" alter column "creator_person_handle" drop not null;`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      'alter table "event_item" add column "send_calendar_invitations" boolean not null default false;',
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "ai_agent_run_item" drop constraint "ai_agent_run_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_chat_attachment_item" drop constraint "ai_chat_attachment_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_chat_message_item" drop constraint "ai_chat_message_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_chat_queued_input_item" drop constraint "ai_chat_queued_input_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_chat_session_item" drop constraint "ai_chat_session_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_chat_tool_action_item" drop constraint "ai_chat_tool_action_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_chat_transcription_item" drop constraint "ai_chat_transcription_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "automation_event_item" drop constraint "automation_event_item_actor_handle_foreign";`,
    );

    this.addSql(
      `alter table "calendar_sync_subscription_item" drop constraint "calendar_sync_subscription_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "change_log_item" drop constraint "change_log_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "dashboard_item" drop constraint "dashboard_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "dashboard_template_item" drop constraint "dashboard_template_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "document_item" drop constraint "document_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "email_delivery_item" drop constraint "email_delivery_item_created_by_handle_foreign";`,
    );

    this.addSql(
      `alter table "email_inbox_subscription_item" drop constraint "email_inbox_subscription_item_processing_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "email_subscription_item" drop constraint "email_subscription_item_sender_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "event_item" drop constraint "event_item_creator_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "import_batch_item" drop constraint "import_batch_item_created_by_handle_foreign";`,
    );

    this.addSql(
      `alter table "information_item" drop constraint "information_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "person_api_token_item" drop constraint "person_api_token_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "person_passkey_item" drop constraint "person_passkey_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "phone_call_item" drop constraint "phone_call_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "sales_opportunity_item" drop constraint "sales_opportunity_item_creator_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "sapling_form_config_item" drop constraint "sapling_form_config_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "social_media_item" drop constraint "social_media_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "teams_delivery_item" drop constraint "teams_delivery_item_created_by_handle_foreign";`,
    );

    this.addSql(
      `alter table "ticket_item" drop constraint "ticket_item_creator_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ticket_time_tracking_item" drop constraint "ticket_time_tracking_item_person_handle_foreign";`,
    );

    this.addSql(
      `alter table "ticket_time_tracking_item" drop constraint "ticket_time_tracking_item_ticket_handle_foreign";`,
    );

    this.addSql(
      `alter table "ai_agent_run_item" add constraint "ai_agent_run_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_chat_attachment_item" add constraint "ai_chat_attachment_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_chat_message_item" add constraint "ai_chat_message_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_chat_queued_input_item" add constraint "ai_chat_queued_input_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_chat_session_item" add constraint "ai_chat_session_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_chat_tool_action_item" add constraint "ai_chat_tool_action_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ai_chat_transcription_item" add constraint "ai_chat_transcription_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "automation_event_item" add constraint "automation_event_item_actor_handle_foreign" foreign key ("actor_handle") references "person_item" ("handle") on update cascade;`,
    );

    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "change_log_item" alter column "person_handle" set not null;`,
    );
    this.addSql(
      `alter table "change_log_item" add constraint "change_log_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "dashboard_item" add constraint "dashboard_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "dashboard_template_item" add constraint "dashboard_template_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "document_item" alter column "person_handle" set not null;`,
    );
    this.addSql(
      `alter table "document_item" add constraint "document_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "email_delivery_item" alter column "created_by_handle" set not null;`,
    );
    this.addSql(
      `alter table "email_delivery_item" add constraint "email_delivery_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "email_inbox_subscription_item" add constraint "email_inbox_subscription_item_processing_person_handle_foreign" foreign key ("processing_person_handle") references "person_item" ("handle") on update cascade;`,
    );

    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_sender_person_handle_foreign" foreign key ("sender_person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "event_item" alter column "creator_person_handle" set not null;`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "import_batch_item" alter column "created_by_handle" set not null;`,
    );
    this.addSql(
      `alter table "import_batch_item" add constraint "import_batch_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "information_item" alter column "person_handle" set not null;`,
    );
    this.addSql(
      `alter table "information_item" add constraint "information_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "person_api_token_item" add constraint "person_api_token_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "person_passkey_item" add constraint "person_passkey_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "phone_call_item" alter column "person_handle" set not null;`,
    );
    this.addSql(
      `alter table "phone_call_item" add constraint "phone_call_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "sales_opportunity_item" alter column "creator_person_handle" set not null;`,
    );
    this.addSql(
      `alter table "sales_opportunity_item" add constraint "sales_opportunity_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "sapling_form_config_item" add constraint "sapling_form_config_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle") on delete set null;`,
    );

    this.addSql(
      `alter table "social_media_item" add constraint "social_media_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "teams_delivery_item" alter column "created_by_handle" set not null;`,
    );
    this.addSql(
      `alter table "teams_delivery_item" add constraint "teams_delivery_item_created_by_handle_foreign" foreign key ("created_by_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ticket_item" alter column "creator_person_handle" set not null;`,
    );
    this.addSql(
      `alter table "ticket_item" add constraint "ticket_item_creator_person_handle_foreign" foreign key ("creator_person_handle") references "person_item" ("handle");`,
    );

    this.addSql(
      `alter table "ticket_time_tracking_item" alter column "person_handle" set not null;`,
    );
    this.addSql(
      `alter table "ticket_time_tracking_item" add constraint "ticket_time_tracking_item_person_handle_foreign" foreign key ("person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "ticket_time_tracking_item" add constraint "ticket_time_tracking_item_ticket_handle_foreign" foreign key ("ticket_handle") references "ticket_item" ("handle");`,
    );

    this.addSql(
      'alter table "event_item" drop column "send_calendar_invitations";',
    );
  }
}
