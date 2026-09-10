import { Migration } from '@mikro-orm/migrations';

// Generated consolidated schema; keep the historical migration identity unchanged.
export class Migration20260708104812 extends Migration {
  override up(): void {
    this.addSql(`CREATE EXTENSION IF NOT EXISTS vector;`);
    this.addSql(`CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE FUNCTION public.sapling_immutable_prompt_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ begin if TG_OP = 'DELETE' or NEW.handle is distinct from OLD.handle or NEW.change_note is distinct from OLD.change_note or (NEW.author_handle is not null and NEW.author_handle is distinct from OLD.author_handle) or NEW.content is distinct from OLD.content or NEW.variables is distinct from OLD.variables or NEW.template_handle is distinct from OLD.template_handle or NEW.version is distinct from OLD.version or NEW.checksum is distinct from OLD.checksum or NEW.published_at is distinct from OLD.published_at then raise exception 'Published prompt versions are immutable'; end if; return NEW; end $$;

CREATE TABLE public.address_item (
    handle integer NOT NULL,
    street character varying(128) NOT NULL,
    zip character varying(16),
    city character varying(64),
    phone character varying(32),
    mobile character varying(32),
    email character varying(128),
    website character varying(128),
    company_handle integer NOT NULL,
    type_handle character varying(64) NOT NULL,
    country_handle character varying(64) DEFAULT 'DE'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.address_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.address_item_handle_seq OWNED BY public.address_item.handle;

CREATE TABLE public.address_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-map-marker-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.ai_agent_evaluation_item (
    handle integer NOT NULL,
    agent_handle character varying(64) NOT NULL,
    agent_version_handle integer,
    title character varying(160) NOT NULL,
    prompt text NOT NULL,
    expected_criteria text,
    target_entity_handle character varying(64),
    target_record_handle character varying(128),
    status character varying(32) DEFAULT 'needsReview'::character varying NOT NULL,
    rating character varying(255),
    comment text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    expectations jsonb,
    tool_fixtures jsonb
);

CREATE SEQUENCE public.ai_agent_evaluation_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_agent_evaluation_item_handle_seq OWNED BY public.ai_agent_evaluation_item.handle;

CREATE TABLE public.ai_agent_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description text,
    icon character varying(64),
    color character varying(32),
    prompt_markdown text NOT NULL,
    welcome_message text,
    conversation_starters jsonb,
    provider_handle character varying(64),
    model_handle character varying(64),
    allowed_entity_handles jsonb,
    allowed_knowledge_entity_handles jsonb,
    allowed_internal_tools jsonb,
    allowed_external_tools jsonb,
    mutation_mode character varying(16) DEFAULT 'confirm'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    web_search_provider_handle character varying(64),
    web_search_model_handle character varying(64)
);

CREATE TABLE public.ai_agent_item_roles (
    ai_agent_item_handle character varying(64) NOT NULL,
    role_item_handle integer NOT NULL
);

CREATE TABLE public.ai_agent_memory_item (
    handle integer NOT NULL,
    agent_handle character varying(64) NOT NULL,
    type character varying(32) NOT NULL,
    title character varying(160) NOT NULL,
    content_markdown text NOT NULL,
    entity_scope_handles jsonb,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.ai_agent_memory_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_agent_memory_item_handle_seq OWNED BY public.ai_agent_memory_item.handle;

CREATE TABLE public.ai_agent_memory_item_roles (
    ai_agent_memory_item_handle integer NOT NULL,
    role_item_handle integer NOT NULL
);

CREATE TABLE public.ai_agent_playbook_item (
    handle character varying(64) NOT NULL,
    agent_handle character varying(64) NOT NULL,
    title character varying(160) NOT NULL,
    description text,
    trigger_entity_handles jsonb,
    steps jsonb NOT NULL,
    expected_output text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.ai_agent_run_item (
    handle integer NOT NULL,
    session_handle integer,
    message_handle integer,
    person_handle integer NOT NULL,
    agent_handle character varying(64),
    agent_version_handle integer,
    playbook_handle character varying(64),
    status character varying(32) DEFAULT 'running'::character varying NOT NULL,
    provider character varying(64),
    model character varying(128),
    context_entity_handle character varying(64),
    context_record_handle character varying(128),
    duration_ms integer,
    tool_calls jsonb,
    sources jsonb,
    pending_actions jsonb,
    usage_payload jsonb,
    response_text text,
    error_payload jsonb,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    purpose character varying(128),
    prompt_manifest jsonb,
    evaluation_result jsonb
);

CREATE SEQUENCE public.ai_agent_run_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_agent_run_item_handle_seq OWNED BY public.ai_agent_run_item.handle;

CREATE TABLE public.ai_agent_version_item (
    handle integer NOT NULL,
    agent_handle character varying(64) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    prompt_markdown text NOT NULL,
    changelog text,
    provider_handle character varying(64),
    model_handle character varying(64),
    allowed_entity_handles jsonb,
    allowed_knowledge_entity_handles jsonb,
    allowed_internal_tools jsonb,
    allowed_external_tools jsonb,
    activated_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    web_search_provider_handle character varying(64),
    web_search_model_handle character varying(64)
);

CREATE SEQUENCE public.ai_agent_version_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_agent_version_item_handle_seq OWNED BY public.ai_agent_version_item.handle;

CREATE TABLE public.ai_chat_attachment_item (
    handle integer NOT NULL,
    session_handle integer,
    message_handle integer,
    person_handle integer NOT NULL,
    document_handle integer NOT NULL,
    import_batch_handle integer,
    purpose character varying(64) DEFAULT 'importAnalysis'::character varying NOT NULL,
    filename character varying(256) NOT NULL,
    mime_type character varying(128),
    byte_length character varying(255),
    status character varying(32) DEFAULT 'analyzed'::character varying NOT NULL,
    summary_payload jsonb,
    error_payload jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.ai_chat_attachment_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_chat_attachment_item_handle_seq OWNED BY public.ai_chat_attachment_item.handle;

CREATE TABLE public.ai_chat_message_item (
    handle integer NOT NULL,
    session_handle integer NOT NULL,
    person_handle integer NOT NULL,
    role character varying(32) NOT NULL,
    status character varying(32) DEFAULT 'completed'::character varying NOT NULL,
    sequence integer NOT NULL,
    content character varying(16384) NOT NULL,
    context_payload jsonb,
    tool_calls jsonb,
    request_payload jsonb,
    response_payload jsonb,
    provider character varying(64),
    model character varying(128),
    url character varying(512),
    route_name character varying(128),
    page_title character varying(256),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    rating boolean
);

CREATE SEQUENCE public.ai_chat_message_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_chat_message_item_handle_seq OWNED BY public.ai_chat_message_item.handle;

CREATE TABLE public.ai_chat_queued_input_item (
    handle integer NOT NULL,
    session_handle integer NOT NULL,
    person_handle integer NOT NULL,
    mode character varying(16) DEFAULT 'queue'::character varying NOT NULL,
    status character varying(16) DEFAULT 'queued'::character varying NOT NULL,
    content character varying(16384) NOT NULL,
    request_payload jsonb,
    user_message_handle integer,
    assistant_message_handle integer,
    error_payload jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);

CREATE SEQUENCE public.ai_chat_queued_input_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_chat_queued_input_item_handle_seq OWNED BY public.ai_chat_queued_input_item.handle;

CREATE TABLE public.ai_chat_session_item (
    handle integer NOT NULL,
    title character varying(256) NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    provider_handle character varying(64),
    model_handle character varying(64),
    agent_handle character varying(64),
    agent_version_handle integer,
    playbook_handle character varying(64),
    context_entity_handle character varying(64),
    context_record_handle character varying(128),
    last_message_at timestamp with time zone,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    response_status character varying(32) DEFAULT 'idle'::character varying NOT NULL,
    response_activity_at timestamp with time zone,
    last_response_at timestamp with time zone,
    last_read_at timestamp with time zone,
    prompt_manifest jsonb
);

CREATE SEQUENCE public.ai_chat_session_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_chat_session_item_handle_seq OWNED BY public.ai_chat_session_item.handle;

CREATE TABLE public.ai_chat_tool_action_item (
    handle integer NOT NULL,
    session_handle integer NOT NULL,
    message_handle integer,
    person_handle integer NOT NULL,
    agent_handle character varying(64),
    server_name character varying(128) NOT NULL,
    tool_name character varying(128) NOT NULL,
    arguments jsonb,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    result_payload jsonb,
    error_payload jsonb,
    expires_at timestamp with time zone,
    executed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.ai_chat_tool_action_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_chat_tool_action_item_handle_seq OWNED BY public.ai_chat_tool_action_item.handle;

CREATE TABLE public.ai_chat_transcription_item (
    handle integer NOT NULL,
    session_handle integer,
    message_handle integer,
    document_handle integer,
    person_handle integer NOT NULL,
    provider_handle character varying(64),
    model_handle character varying(64),
    status character varying(32) DEFAULT 'processing'::character varying NOT NULL,
    transcript character varying(16384),
    detected_language character varying(16),
    mime_type character varying(128) NOT NULL,
    byte_length integer NOT NULL,
    duration_seconds real,
    request_payload jsonb,
    response_payload jsonb,
    failure_payload jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.ai_chat_transcription_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_chat_transcription_item_handle_seq OWNED BY public.ai_chat_transcription_item.handle;

CREATE TABLE public.ai_entity_generation_template_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    action_name character varying(128) NOT NULL,
    source_entity_handle character varying(64) CONSTRAINT ai_entity_generation_template_ite_source_entity_handle_not_null NOT NULL,
    target_entity_handle character varying(64) CONSTRAINT ai_entity_generation_template_ite_target_entity_handle_not_null NOT NULL,
    source_relations jsonb,
    prompt_markdown text NOT NULL,
    field_mapping jsonb,
    source_field_mapping jsonb,
    target_defaults jsonb,
    source_reference_field character varying(128),
    user_reference_field character varying(128),
    provider_handle character varying(64),
    model_handle character varying(64),
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.ai_prompt_template_item (
    handle character varying(190) NOT NULL,
    title character varying(256) NOT NULL,
    description text,
    purpose character varying(128) NOT NULL,
    draft text NOT NULL,
    variables jsonb NOT NULL,
    published_version_handle integer,
    updated_at timestamp(6) with time zone NOT NULL
);

CREATE TABLE public.ai_prompt_version_item (
    handle integer NOT NULL,
    template_handle character varying(190) NOT NULL,
    version integer NOT NULL,
    content text NOT NULL,
    variables jsonb NOT NULL,
    change_note text,
    author_handle integer,
    checksum character varying(64) NOT NULL,
    published_at timestamp(6) with time zone NOT NULL
);

CREATE SEQUENCE public.ai_prompt_version_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_prompt_version_item_handle_seq OWNED BY public.ai_prompt_version_item.handle;

CREATE TABLE public.ai_provider_model_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(512),
    provider_handle character varying(64) NOT NULL,
    provider_model character varying(128) NOT NULL,
    supports_streaming boolean DEFAULT true NOT NULL,
    supports_tools boolean DEFAULT false NOT NULL,
    supports_embeddings boolean DEFAULT false NOT NULL,
    supports_transcription boolean DEFAULT false NOT NULL,
    embedding_batch_size integer DEFAULT 32 NOT NULL,
    vector_chunk_length integer DEFAULT 1200 NOT NULL,
    vector_chunk_overlap integer DEFAULT 200 NOT NULL,
    vector_search_candidate_multiplier integer DEFAULT 6 CONSTRAINT ai_provider_model_item_vector_search_candidate_multipl_not_null NOT NULL,
    vector_search_max_candidate_limit integer DEFAULT 60 CONSTRAINT ai_provider_model_item_vector_search_max_candidate_lim_not_null NOT NULL,
    vector_search_max_results integer DEFAULT 10 NOT NULL,
    supports_speech boolean DEFAULT false NOT NULL,
    speech_voice character varying(64) DEFAULT 'nova'::character varying NOT NULL,
    speech_speed real DEFAULT 1 NOT NULL,
    speech_mime_type character varying(128) DEFAULT 'audio/mpeg'::character varying NOT NULL,
    speech_file_extension character varying(16) DEFAULT 'mp3'::character varying NOT NULL,
    speech_max_input_length integer DEFAULT 4000 NOT NULL,
    max_tool_call_iterations integer DEFAULT 100 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    supports_web_search boolean DEFAULT false NOT NULL,
    is_default_web_search boolean DEFAULT false NOT NULL,
    supports_reasoning_summary boolean DEFAULT false NOT NULL,
    is_default_markdown boolean DEFAULT false NOT NULL,
    supports_vision boolean DEFAULT false NOT NULL
);

CREATE TABLE public.ai_provider_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-robot-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    credential_types jsonb,
    credentials jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.ai_usage_event_item (
    handle integer NOT NULL,
    source_key character varying(160) NOT NULL,
    person_handle integer,
    operation character varying(32) NOT NULL,
    execution_type character varying(24) DEFAULT 'interactive'::character varying NOT NULL,
    provider character varying(64),
    model character varying(128),
    status character varying(24) NOT NULL,
    duration_ms integer,
    input_tokens integer,
    output_tokens integer,
    total_tokens integer,
    usage_reported boolean DEFAULT false NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    environment_handle character varying(96) NOT NULL
);

CREATE SEQUENCE public.ai_usage_event_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_usage_event_item_handle_seq OWNED BY public.ai_usage_event_item.handle;

CREATE TABLE public.ai_vector_document_item (
    handle integer NOT NULL,
    source_entity_handle character varying(64) NOT NULL,
    source_record_handle character varying(128) NOT NULL,
    source_section character varying(64) NOT NULL,
    chunk_index integer DEFAULT 0 NOT NULL,
    title character varying(256),
    content text NOT NULL,
    content_hash character varying(64) NOT NULL,
    metadata jsonb,
    provider_handle character varying(64) NOT NULL,
    model_handle character varying(128) NOT NULL,
    embedding_dimensions integer NOT NULL,
    embedding public.vector NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.ai_vector_document_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ai_vector_document_item_handle_seq OWNED BY public.ai_vector_document_item.handle;

CREATE TABLE public.authentication_event_item (
    handle integer NOT NULL,
    person_handle integer,
    event_type character varying(32) NOT NULL,
    provider character varying(24) NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    environment_handle character varying(96) NOT NULL
);

CREATE SEQUENCE public.authentication_event_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.authentication_event_item_handle_seq OWNED BY public.authentication_event_item.handle;

CREATE TABLE public.automation_event_item (
    handle integer NOT NULL,
    event_id character varying(36) NOT NULL,
    source_entity_handle character varying(64) NOT NULL,
    source_handle character varying(64) NOT NULL,
    operation character varying(32) NOT NULL,
    actor_handle integer NOT NULL,
    chain_id character varying(36) NOT NULL,
    chain_depth integer DEFAULT 0 NOT NULL,
    old_snapshot jsonb,
    new_snapshot jsonb,
    context jsonb,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    error text,
    next_attempt_at timestamp with time zone,
    processing_started_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone
);

CREATE SEQUENCE public.automation_event_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.automation_event_item_handle_seq OWNED BY public.automation_event_item.handle;

CREATE TABLE public.automation_execution_item (
    handle integer NOT NULL,
    deduplication_key character varying(190) NOT NULL,
    event_handle integer NOT NULL,
    target_entity_handle character varying(64) NOT NULL,
    target_handle character varying(64) NOT NULL,
    action_type character varying(16) NOT NULL,
    rule_handle character varying(32) NOT NULL,
    status character varying(16) NOT NULL,
    message text,
    created_at timestamp with time zone NOT NULL,
    rule_snapshot jsonb
);

CREATE SEQUENCE public.automation_execution_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.automation_execution_item_handle_seq OWNED BY public.automation_execution_item.handle;

CREATE TABLE public.calendar_sync_subscription_item (
    handle integer NOT NULL,
    description character varying(128) DEFAULT 'Outlook calendar import'::character varying NOT NULL,
    provider character varying(32) DEFAULT 'azure'::character varying NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    sync_range character varying(16) DEFAULT 'week'::character varying NOT NULL,
    interval_minutes integer DEFAULT 60 NOT NULL,
    last_run_at timestamp with time zone,
    last_success_at timestamp with time zone,
    last_error character varying(512),
    last_imported_count integer DEFAULT 0 NOT NULL,
    last_created_count integer DEFAULT 0 NOT NULL,
    last_updated_count integer DEFAULT 0 NOT NULL,
    last_skipped_count integer DEFAULT 0 NOT NULL,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    default_event_type_handle character varying(64) DEFAULT 'online'::character varying CONSTRAINT calendar_sync_subscription_i_default_event_type_handle_not_null NOT NULL,
    default_event_category_handle character varying(64) DEFAULT 'internal'::character varying CONSTRAINT calendar_sync_subscription__default_event_category_han_not_null NOT NULL,
    classification_mappings jsonb DEFAULT '[]'::jsonb CONSTRAINT calendar_sync_subscription_ite_classification_mappings_not_null NOT NULL
);

CREATE SEQUENCE public.calendar_sync_subscription_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.calendar_sync_subscription_item_handle_seq OWNED BY public.calendar_sync_subscription_item.handle;

CREATE TABLE public.change_log_action_item (
    handle character varying(32) NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(256),
    icon character varying(64) DEFAULT 'mdi-pencil-circle-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.change_log_detail_item (
    handle integer NOT NULL,
    log_handle integer NOT NULL,
    property character varying(256) NOT NULL,
    old_value jsonb,
    new_value jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.change_log_detail_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.change_log_detail_item_handle_seq OWNED BY public.change_log_detail_item.handle;

CREATE TABLE public.change_log_item (
    handle integer NOT NULL,
    action_handle character varying(32) NOT NULL,
    reference character varying(64) NOT NULL,
    entity_handle character varying(64) NOT NULL,
    person_handle integer NOT NULL,
    old_payload jsonb,
    new_payload jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.change_log_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.change_log_item_handle_seq OWNED BY public.change_log_item.handle;

CREATE TABLE public.company_annual_revenue_class_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-cash-multiple'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.company_churn_risk_reason_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(512),
    icon character varying(64) DEFAULT 'mdi-alert-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#EF6C00'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.company_industry_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-factory'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.company_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    street character varying(128),
    zip character varying(16),
    city character varying(64),
    phone character varying(32),
    mobile character varying(32),
    email character varying(128),
    website character varying(128),
    is_active boolean DEFAULT true NOT NULL,
    allow_newsletter boolean DEFAULT true NOT NULL,
    data_privacy_consent_given boolean DEFAULT false NOT NULL,
    data_privacy_consent_at date,
    employee_count integer,
    contract_value real,
    annual_recurring_revenue real,
    monthly_recurring_revenue real,
    country_handle character varying(64) DEFAULT 'DE'::character varying NOT NULL,
    account_manager_handle integer,
    customer_success_manager_handle integer,
    industry_handle character varying(64),
    segment_handle character varying(64),
    size_handle character varying(64),
    annual_revenue_class_handle character varying(64),
    churn_risk_reason_handle character varying(64),
    work_week_handle integer,
    holiday_group_handle integer,
    service_provider_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.company_item_automatic_cc_persons (
    company_item_handle integer NOT NULL,
    person_item_handle integer NOT NULL
);

CREATE SEQUENCE public.company_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.company_item_handle_seq OWNED BY public.company_item.handle;

CREATE TABLE public.company_relationship_item (
    handle integer NOT NULL,
    description character varying(1024),
    source_company_handle integer NOT NULL,
    target_company_handle integer NOT NULL,
    type_handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.company_relationship_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.company_relationship_item_handle_seq OWNED BY public.company_relationship_item.handle;

CREATE TABLE public.company_relationship_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-family-tree'::character varying NOT NULL,
    color character varying(32) DEFAULT '#00897B'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.company_segment_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-account-group-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.company_size_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-office-building'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.contract_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(512),
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    last_service_date timestamp with time zone,
    next_service_date timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    annual_included_hours integer DEFAULT 0 NOT NULL,
    has_updateservice boolean DEFAULT false NOT NULL,
    company_handle integer,
    service_level_handle character varying(64),
    default_support_team_handle character varying(64),
    default_support_queue_handle character varying(64),
    sla_policy_handle character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    contract_number character varying(128)
);

CREATE SEQUENCE public.contract_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.contract_item_handle_seq OWNED BY public.contract_item.handle;

CREATE TABLE public.contract_item_products (
    contract_item_handle integer NOT NULL,
    product_item_handle integer NOT NULL
);

CREATE TABLE public.contract_service_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-shield-check-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.country_item (
    handle character varying(64) NOT NULL,
    name character varying(256) NOT NULL,
    dialing_code character varying(8),
    language_handle character varying(64) DEFAULT 'en'::character varying,
    money_handle character varying(16),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.custom_field_definition_item (
    handle integer NOT NULL,
    entity_handle character varying(64) NOT NULL,
    field_key character varying(96) NOT NULL,
    label character varying(128) NOT NULL,
    field_type_handle character varying(64) NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    field_order integer DEFAULT 0 NOT NULL,
    form_visible boolean DEFAULT true NOT NULL,
    table_visible boolean DEFAULT false NOT NULL,
    mobile_visible boolean DEFAULT false NOT NULL,
    select_options jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_read_only boolean DEFAULT false NOT NULL,
    tooltip text
);

CREATE SEQUENCE public.custom_field_definition_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.custom_field_definition_item_handle_seq OWNED BY public.custom_field_definition_item.handle;

CREATE TABLE public.custom_field_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-form-textbox'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.custom_field_value_item (
    handle integer NOT NULL,
    entity_handle character varying(64) NOT NULL,
    definition_handle integer NOT NULL,
    record_reference character varying(64) NOT NULL,
    value_string text,
    value_number real,
    value_boolean boolean DEFAULT false,
    value_date date,
    value_date_time timestamp with time zone,
    value_json jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.custom_field_value_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.custom_field_value_item_handle_seq OWNED BY public.custom_field_value_item.handle;

CREATE TABLE public.dashboard_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    kpi_order jsonb DEFAULT '[]'::jsonb NOT NULL,
    widgets jsonb
);

CREATE SEQUENCE public.dashboard_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dashboard_item_handle_seq OWNED BY public.dashboard_item.handle;

CREATE TABLE public.dashboard_item_kpis (
    dashboard_item_handle integer NOT NULL,
    kpi_item_handle integer NOT NULL
);

CREATE TABLE public.dashboard_template_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    description character varying(512),
    is_shared boolean DEFAULT false NOT NULL,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    widgets jsonb
);

CREATE SEQUENCE public.dashboard_template_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dashboard_template_item_handle_seq OWNED BY public.dashboard_template_item.handle;

CREATE TABLE public.dashboard_template_item_kpis (
    dashboard_template_item_handle integer CONSTRAINT dashboard_template_item_kpi_dashboard_template_item_ha_not_null NOT NULL,
    kpi_item_handle integer NOT NULL
);

CREATE TABLE public.document_item (
    handle integer NOT NULL,
    path character varying(128) NOT NULL,
    filename character varying(256) NOT NULL,
    mimetype character varying(128) NOT NULL,
    length integer NOT NULL,
    description character varying(256),
    reference character varying(64) NOT NULL,
    entity_handle character varying(64) NOT NULL,
    type_handle character varying(64) NOT NULL,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.document_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.document_item_handle_seq OWNED BY public.document_item.handle;

CREATE TABLE public.document_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.dvelop_connection_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    base_url character varying(512) NOT NULL,
    repository_handle integer,
    api_key character varying(2048),
    default_object_definition_handle integer,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.dvelop_connection_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dvelop_connection_item_handle_seq OWNED BY public.dvelop_connection_item.handle;

CREATE TABLE public.dvelop_entity_mapping_item (
    handle integer NOT NULL,
    connection_handle integer NOT NULL,
    entity_handle character varying(64) NOT NULL,
    object_definition_handle integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.dvelop_entity_mapping_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dvelop_entity_mapping_item_handle_seq OWNED BY public.dvelop_entity_mapping_item.handle;

CREATE TABLE public.dvelop_entity_mapping_property_item (
    handle integer NOT NULL,
    mapping_handle integer NOT NULL,
    property_handle integer NOT NULL,
    source_field character varying(128),
    static_value character varying(256),
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.dvelop_entity_mapping_property_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dvelop_entity_mapping_property_item_handle_seq OWNED BY public.dvelop_entity_mapping_property_item.handle;

CREATE TABLE public.dvelop_entity_mapping_search_category_item (
    handle integer NOT NULL,
    mapping_handle integer CONSTRAINT dvelop_entity_mapping_search_category_i_mapping_handle_not_null NOT NULL,
    object_definition_handle integer CONSTRAINT dvelop_entity_mapping_search__object_definition_handle_not_null NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.dvelop_entity_mapping_search_category_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dvelop_entity_mapping_search_category_item_handle_seq OWNED BY public.dvelop_entity_mapping_search_category_item.handle;

CREATE TABLE public.dvelop_object_definition_item (
    handle integer NOT NULL,
    connection_handle integer NOT NULL,
    title character varying(256) NOT NULL,
    dvelop_id character varying(128) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.dvelop_object_definition_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dvelop_object_definition_item_handle_seq OWNED BY public.dvelop_object_definition_item.handle;

CREATE TABLE public.dvelop_property_item (
    handle integer NOT NULL,
    connection_handle integer NOT NULL,
    object_definition_handle integer,
    title character varying(256) NOT NULL,
    dvelop_id character varying(128) NOT NULL,
    data_type character varying(64),
    description text,
    is_required boolean DEFAULT false NOT NULL,
    is_multi_value boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.dvelop_property_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dvelop_property_item_handle_seq OWNED BY public.dvelop_property_item.handle;

CREATE TABLE public.dvelop_repository_item (
    handle integer NOT NULL,
    connection_handle integer NOT NULL,
    title character varying(256) NOT NULL,
    dvelop_id character varying(128) NOT NULL,
    version character varying(64),
    is_default boolean DEFAULT false NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.dvelop_repository_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dvelop_repository_item_handle_seq OWNED BY public.dvelop_repository_item.handle;

CREATE TABLE public.effort_estimate_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    status_handle character varying(64) DEFAULT 'open'::character varying,
    expected_completion_date date,
    requirements_markdown text,
    is_active boolean DEFAULT true NOT NULL,
    assignee_company_handle integer,
    assignee_person_handle integer,
    creator_company_handle integer,
    creator_person_handle integer,
    sales_opportunity_handle integer,
    ticket_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.effort_estimate_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.effort_estimate_item_handle_seq OWNED BY public.effort_estimate_item.handle;

CREATE TABLE public.effort_estimate_position_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    estimated_hours real,
    offer_text_markdown text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_optional boolean DEFAULT false NOT NULL,
    estimate_handle integer NOT NULL,
    template_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.effort_estimate_position_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.effort_estimate_position_item_handle_seq OWNED BY public.effort_estimate_position_item.handle;

CREATE TABLE public.effort_estimate_position_template_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(256),
    estimated_hours real,
    offer_text_markdown text CONSTRAINT effort_estimate_position_template__offer_text_markdown_not_null NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.effort_estimate_position_template_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.effort_estimate_position_template_item_handle_seq OWNED BY public.effort_estimate_position_template_item.handle;

CREATE TABLE public.effort_estimate_status_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    color character varying(16) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-new-box'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);

CREATE TABLE public.email_delivery_item (
    handle integer NOT NULL,
    status_handle character varying(64) DEFAULT 'pending'::character varying,
    template_handle integer,
    entity_handle character varying(64) NOT NULL,
    created_by_handle integer NOT NULL,
    reference_handle character varying(64),
    provider character varying(32) NOT NULL,
    to_recipients jsonb NOT NULL,
    cc_recipients jsonb,
    bcc_recipients jsonb,
    subject character varying(256) NOT NULL,
    body_markdown character varying(8192) NOT NULL,
    body_html character varying(16384) NOT NULL,
    attachment_handles jsonb,
    request_payload jsonb,
    response_status_code integer,
    response_body jsonb,
    response_headers jsonb,
    provider_message_id character varying(256),
    completed_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    customer_company_handle integer,
    customer_person_handle integer,
    subscription_handle integer,
    automation_deduplication_key character varying(160),
    rule_snapshot jsonb
);

CREATE SEQUENCE public.email_delivery_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.email_delivery_item_handle_seq OWNED BY public.email_delivery_item.handle;

CREATE TABLE public.email_delivery_status_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-email-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);

CREATE TABLE public.email_inbox_processing_mode_item (
    handle character varying(64) NOT NULL,
    description character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-email-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#1976D2'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.email_inbox_subscription_item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    mailbox_handle integer NOT NULL,
    processing_person_handle integer NOT NULL,
    agent_handle character varying(64),
    processing_mode_handle character varying(64) NOT NULL,
    context_markdown text,
    automatic_processing boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    interval_minutes integer DEFAULT 1 NOT NULL,
    import_existing_on_first_run boolean DEFAULT false CONSTRAINT email_inbox_subscription_it_import_existing_on_first_r_not_null NOT NULL,
    last_run_at timestamp with time zone,
    last_success_at timestamp with time zone,
    last_received_at timestamp with time zone,
    last_error character varying(1024),
    imported_count integer DEFAULT 0 NOT NULL,
    processed_count integer DEFAULT 0 NOT NULL,
    manual_review_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.email_inbox_subscription_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.email_inbox_subscription_item_handle_seq OWNED BY public.email_inbox_subscription_item.handle;

CREATE TABLE public.email_list_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    mail_template_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.email_list_item_companies (
    email_list_item_handle integer NOT NULL,
    company_item_handle integer NOT NULL
);

CREATE SEQUENCE public.email_list_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.email_list_item_handle_seq OWNED BY public.email_list_item.handle;

CREATE TABLE public.email_list_item_persons (
    email_list_item_handle integer NOT NULL,
    person_item_handle integer NOT NULL
);

CREATE TABLE public.email_signature_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    body_markdown character varying(8192) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    use_in_rotation boolean DEFAULT true NOT NULL,
    person_handle integer NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.email_signature_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.email_signature_item_handle_seq OWNED BY public.email_signature_item.handle;

CREATE TABLE public.email_subscription_condition_item (
    handle integer NOT NULL,
    subscription_handle integer NOT NULL,
    observed_field character varying(128) NOT NULL,
    old_value character varying(256),
    new_value character varying(256),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    group_order integer DEFAULT 0 NOT NULL
);

CREATE SEQUENCE public.email_subscription_condition_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.email_subscription_condition_item_handle_seq OWNED BY public.email_subscription_condition_item.handle;

CREATE TABLE public.email_subscription_item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    recipient_field character varying(128) NOT NULL,
    sender_person_handle integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    entity_handle character varying(64) NOT NULL,
    type_handle character varying(64) DEFAULT 'afterInsert'::character varying NOT NULL,
    template_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sender_mailbox_handle integer,
    allow_repeated_sending boolean DEFAULT true NOT NULL
);

CREATE SEQUENCE public.email_subscription_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.email_subscription_item_handle_seq OWNED BY public.email_subscription_item.handle;

CREATE TABLE public.email_template_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    description character varying(256),
    subject_template character varying(256) NOT NULL,
    body_markdown character varying(8192) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    entity_handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.email_template_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.email_template_item_handle_seq OWNED BY public.email_template_item.handle;

CREATE TABLE public.entity_group_item (
    handle character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-folder'::character varying NOT NULL,
    is_expanded boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    parent_handle character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.entity_item (
    handle character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'square-rounded'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    can_read boolean DEFAULT true NOT NULL,
    can_insert boolean DEFAULT false NOT NULL,
    can_update boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_show boolean DEFAULT false NOT NULL,
    group_handle character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.entity_route_item (
    handle integer NOT NULL,
    route character varying(64) NOT NULL,
    navigation character varying(128),
    entity_handle character varying(64),
    group_handle character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.entity_route_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.entity_route_item_handle_seq OWNED BY public.entity_route_item.handle;

CREATE TABLE public.event_azure_item (
    handle integer NOT NULL,
    reference_handle character varying(1024) NOT NULL,
    event_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    ical_uid character varying(1024)
);

CREATE SEQUENCE public.event_azure_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.event_azure_item_handle_seq OWNED BY public.event_azure_item.handle;

CREATE TABLE public.event_category_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-shape-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#5C6BC0'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.event_delivery_item (
    handle integer NOT NULL,
    status_handle character varying(64) DEFAULT 'pending'::character varying,
    event_handle integer NOT NULL,
    payload jsonb NOT NULL,
    request_headers jsonb,
    response_status_code integer DEFAULT 200,
    response_body jsonb,
    response_headers jsonb,
    completed_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    queue_wait_ms integer,
    provider_duration_ms integer
);

CREATE SEQUENCE public.event_delivery_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.event_delivery_item_handle_seq OWNED BY public.event_delivery_item.handle;

CREATE TABLE public.event_delivery_status_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);

CREATE TABLE public.event_google_item (
    handle integer NOT NULL,
    reference_handle character varying(1024) NOT NULL,
    event_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    ical_uid character varying(1024)
);

CREATE SEQUENCE public.event_google_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.event_google_item_handle_seq OWNED BY public.event_google_item.handle;

CREATE TABLE public.event_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    description text,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    is_all_day boolean DEFAULT false NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    recurrence_rule character varying(512),
    online_meeting_url character varying(512),
    type_handle character varying(64) DEFAULT 'online'::character varying,
    assignee_company_handle integer,
    assignee_person_handle integer,
    creator_company_handle integer NOT NULL,
    creator_person_handle integer NOT NULL,
    ticket_handle integer,
    sales_opportunity_handle integer,
    status_handle character varying(64) DEFAULT 'scheduled'::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    preparation_duration time without time zone DEFAULT '00:00:00'::time without time zone NOT NULL,
    follow_up_duration time without time zone DEFAULT '00:00:00'::time without time zone NOT NULL,
    category_handle character varying(64) DEFAULT 'internal'::character varying NOT NULL,
    recurrence_exception_dates jsonb DEFAULT '[]'::jsonb NOT NULL,
    create_online_meeting boolean DEFAULT false NOT NULL,
    internal_case_handle integer,
    effort_estimate_handle integer
);

CREATE SEQUENCE public.event_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.event_item_handle_seq OWNED BY public.event_item.handle;

CREATE TABLE public.event_status_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    color character varying(16) NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);

CREATE TABLE public.event_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    show_in_default_calendar boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.external_record_link_item (
    handle integer NOT NULL,
    source_handle character varying(64) NOT NULL,
    entity_handle character varying(64) NOT NULL,
    reference character varying(64) NOT NULL,
    external_key_hash character varying(128) NOT NULL,
    external_key_parts jsonb NOT NULL,
    first_import_batch_handle integer,
    last_import_batch_handle integer,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.external_record_link_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.external_record_link_item_handle_seq OWNED BY public.external_record_link_item.handle;

CREATE TABLE public.favorite_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    search character varying(256),
    sort_by jsonb,
    filter jsonb,
    person_handle integer NOT NULL,
    entity_handle character varying(64) NOT NULL,
    entity_route_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    "grouping" jsonb
);

CREATE SEQUENCE public.favorite_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.favorite_item_handle_seq OWNED BY public.favorite_item.handle;

CREATE TABLE public.favorite_template_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    entity_handle character varying(64) NOT NULL,
    entity_route_handle integer,
    filter jsonb,
    is_recommended boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.favorite_template_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.favorite_template_item_handle_seq OWNED BY public.favorite_template_item.handle;

CREATE TABLE public.field_automation_item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    source_entity_handle character varying(64) NOT NULL,
    target_entity_handle character varying(64) NOT NULL,
    operation_handle character varying(64) DEFAULT 'afterUpdate'::character varying NOT NULL,
    reference_path jsonb DEFAULT '[]'::jsonb NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    assignments jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.field_automation_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.field_automation_item_handle_seq OWNED BY public.field_automation_item.handle;

CREATE TABLE public.field_permission_item (
    handle integer NOT NULL,
    permission_handle integer NOT NULL,
    field_name character varying(128) NOT NULL,
    allow_read boolean DEFAULT true NOT NULL,
    allow_insert boolean DEFAULT true NOT NULL,
    allow_update boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.field_permission_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.field_permission_item_handle_seq OWNED BY public.field_permission_item.handle;

CREATE TABLE public.global_search_index_item (
    handle integer NOT NULL,
    entity_handle character varying(64) NOT NULL,
    record_handle character varying(128) NOT NULL,
    field_path character varying(128) NOT NULL,
    field_value text NOT NULL,
    normalized_value text NOT NULL,
    source_updated_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.global_search_index_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.global_search_index_item_handle_seq OWNED BY public.global_search_index_item.handle;

CREATE TABLE public.holiday_group_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.holiday_group_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.holiday_group_item_handle_seq OWNED BY public.holiday_group_item.handle;

CREATE TABLE public.holiday_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(1024),
    group_handle integer NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    is_all_day boolean DEFAULT true NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar-alert'::character varying NOT NULL,
    color character varying(32) DEFAULT '#C62828'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.holiday_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.holiday_item_handle_seq OWNED BY public.holiday_item.handle;

CREATE TABLE public.http_metric_bucket_item (
    handle integer NOT NULL,
    bucket_start timestamp with time zone NOT NULL,
    resolution character varying(8) DEFAULT '1m'::character varying NOT NULL,
    attribution_key character varying(64) NOT NULL,
    person_handle integer,
    api_token_handle integer,
    auth_kind character varying(16) NOT NULL,
    route_group character varying(32) NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    client_error_count integer DEFAULT 0 NOT NULL,
    server_error_count integer DEFAULT 0 NOT NULL,
    request_bytes bigint DEFAULT 0 NOT NULL,
    response_bytes bigint DEFAULT 0 NOT NULL,
    duration_sum_ms double precision DEFAULT 0 NOT NULL,
    duration_max_ms double precision DEFAULT 0 NOT NULL,
    duration_histogram jsonb DEFAULT '[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]'::jsonb NOT NULL,
    impersonated_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    environment_handle character varying(96) NOT NULL,
    operation character varying(192) DEFAULT ''::character varying NOT NULL,
    aborted_count integer DEFAULT 0 NOT NULL,
    timeout_count integer DEFAULT 0 NOT NULL,
    request_kind character varying(16) DEFAULT 'standard'::character varying NOT NULL,
    resource_key character varying(64) DEFAULT ''::character varying NOT NULL
);

CREATE SEQUENCE public.http_metric_bucket_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.http_metric_bucket_item_handle_seq OWNED BY public.http_metric_bucket_item.handle;

CREATE TABLE public.import_batch_item (
    handle integer NOT NULL,
    source_handle character varying(64),
    target_entity_handle character varying(64),
    import_template_handle integer,
    created_by_handle integer NOT NULL,
    filename character varying(256) NOT NULL,
    mimetype character varying(128),
    file_size integer,
    status character varying(32) DEFAULT 'analyzed'::character varying NOT NULL,
    current_operation character varying(32),
    row_count integer,
    processed_count integer DEFAULT 0 NOT NULL,
    ready_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    created_count integer DEFAULT 0 NOT NULL,
    updated_count integer DEFAULT 0 NOT NULL,
    skipped_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    job_id character varying(128),
    started_at timestamp with time zone,
    delimiter character varying(8),
    headers jsonb,
    sample_rows jsonb,
    mapping jsonb,
    external_key_columns jsonb,
    generic_reference_mapping jsonb,
    executed_at timestamp with time zone,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.import_batch_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.import_batch_item_handle_seq OWNED BY public.import_batch_item.handle;

CREATE TABLE public.import_batch_row_item (
    handle integer NOT NULL,
    batch_handle integer NOT NULL,
    row_number integer NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    action character varying(32),
    target_reference character varying(64),
    external_key_hash character varying(128),
    external_key_parts jsonb,
    raw_data jsonb NOT NULL,
    payload jsonb,
    message text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.import_batch_row_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.import_batch_row_item_handle_seq OWNED BY public.import_batch_row_item.handle;

CREATE TABLE public.import_source_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.import_template_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    description text,
    source_handle character varying(64) NOT NULL,
    target_entity_handle character varying(64) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    mapping jsonb NOT NULL,
    external_key_columns jsonb,
    generic_reference_mapping jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.import_template_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.import_template_item_handle_seq OWNED BY public.import_template_item.handle;

CREATE TABLE public.import_template_value_mapping_item (
    handle integer NOT NULL,
    import_template_handle integer CONSTRAINT import_template_value_mapping_i_import_template_handle_not_null NOT NULL,
    target_field character varying(128) NOT NULL,
    source_value text NOT NULL,
    target_value text NOT NULL,
    fallback character varying(16) DEFAULT 'keep'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.import_template_value_mapping_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.import_template_value_mapping_item_handle_seq OWNED BY public.import_template_value_mapping_item.handle;

CREATE TABLE public.inbound_email_item (
    handle integer NOT NULL,
    status_handle character varying(64) DEFAULT 'pending'::character varying NOT NULL,
    subject character varying(512) NOT NULL,
    from_address character varying(320) NOT NULL,
    from_name character varying(256),
    to_recipients jsonb NOT NULL,
    cc_recipients jsonb,
    body_text text,
    body_html text,
    mailbox_handle integer NOT NULL,
    subscription_handle integer NOT NULL,
    person_handle integer,
    company_handle integer,
    ticket_handle integer,
    sales_opportunity_handle integer,
    office_task_handle integer,
    source_document_handle integer,
    provider character varying(32) NOT NULL,
    provider_message_id character varying(512) NOT NULL,
    internet_message_id character varying(512),
    conversation_id character varying(512),
    in_reply_to character varying(512),
    "references" jsonb,
    headers jsonb,
    received_at timestamp with time zone NOT NULL,
    processing_attempts integer DEFAULT 0 NOT NULL,
    processing_message character varying(1024),
    processing_log jsonb,
    agent_handle character varying(64),
    ai_session_handle integer,
    ai_message_handle integer,
    processed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    prompt_manifest jsonb
);

CREATE SEQUENCE public.inbound_email_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.inbound_email_item_handle_seq OWNED BY public.inbound_email_item.handle;

CREATE TABLE public.inbound_email_status_item (
    handle character varying(64) NOT NULL,
    description character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-email-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#607D8B'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);

CREATE TABLE public.inbox_notification_item (
    handle integer NOT NULL,
    entity_handle character varying(64) NOT NULL,
    subscription_handle integer NOT NULL,
    template_handle integer,
    recipient_person_handle integer NOT NULL,
    created_by_handle integer NOT NULL,
    reference_handle character varying(64),
    title character varying(256) NOT NULL,
    body_markdown character varying(8192) NOT NULL,
    body_text character varying(8192) NOT NULL,
    request_payload jsonb,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    automation_deduplication_key character varying(190)
);

CREATE SEQUENCE public.inbox_notification_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.inbox_notification_item_handle_seq OWNED BY public.inbox_notification_item.handle;

CREATE TABLE public.inbox_subscription_item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    recipient_field character varying(64) NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    entity_handle character varying(64) NOT NULL,
    type_handle character varying(64) DEFAULT 'afterInsert'::character varying NOT NULL,
    template_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    source_entity_handle character varying(64),
    reference_path jsonb DEFAULT '[]'::jsonb NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    notify_actor boolean DEFAULT false NOT NULL
);

CREATE SEQUENCE public.inbox_subscription_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.inbox_subscription_item_handle_seq OWNED BY public.inbox_subscription_item.handle;

CREATE TABLE public.inbox_template_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    description character varying(256),
    title_template character varying(256) NOT NULL,
    body_markdown character varying(8192) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    entity_handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.inbox_template_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.inbox_template_item_handle_seq OWNED BY public.inbox_template_item.handle;

CREATE TABLE public.information_item (
    handle integer NOT NULL,
    reference character varying(64) NOT NULL,
    content text NOT NULL,
    entity_handle character varying(64) NOT NULL,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.information_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.information_item_handle_seq OWNED BY public.information_item.handle;

CREATE TABLE public.internal_case_category_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-shape-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#5C6BC0'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.internal_case_item (
    handle integer NOT NULL,
    number character varying(32),
    title character varying(128) NOT NULL,
    status_handle character varying(64) DEFAULT 'open'::character varying,
    category_handle character varying(64) DEFAULT 'internalRequest'::character varying NOT NULL,
    request_markdown text,
    internal_information_markdown text,
    customer_company_handle integer,
    customer_person_handle integer,
    responsible_company_handle integer,
    responsible_person_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sales_opportunity_handle integer,
    ticket_handle integer,
    effort_estimate_handle integer
);

CREATE SEQUENCE public.internal_case_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.internal_case_item_handle_seq OWNED BY public.internal_case_item.handle;

CREATE TABLE public.internal_case_status_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    color character varying(16) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-clipboard-text-outline'::character varying NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);

CREATE TABLE public.knowledge_article_category_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(256),
    icon character varying(64) DEFAULT 'mdi-shape-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#607D8B'::character varying NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.knowledge_article_item (
    handle integer NOT NULL,
    title character varying(160) NOT NULL,
    status_handle character varying(64),
    visibility_handle character varying(64),
    category_handle character varying(64),
    product_handle integer,
    summary text,
    tags character varying(512),
    context_key character varying(128),
    problem_markdown text,
    solution_markdown text,
    documentation_markdown text,
    is_active boolean DEFAULT true NOT NULL,
    published_at timestamp with time zone,
    valid_until date,
    source_ticket_handle integer,
    source_sales_opportunity_handle integer,
    source_effort_estimate_handle integer,
    author_person_handle integer,
    reviewer_person_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.knowledge_article_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.knowledge_article_item_handle_seq OWNED BY public.knowledge_article_item.handle;

CREATE TABLE public.knowledge_article_status_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    color character varying(32) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-file-document-outline'::character varying NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_open boolean DEFAULT true NOT NULL
);

CREATE TABLE public.knowledge_article_visibility_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    color character varying(32) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-eye-outline'::character varying NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.kpi_aggregation_item (
    handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.kpi_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    description character varying(256),
    aggregation_handle character varying(64) NOT NULL,
    field character varying(128) NOT NULL,
    type_handle character varying(64) DEFAULT 'ITEM'::character varying NOT NULL,
    timeframe_field character varying(128),
    timeframe_handle character varying(64),
    timeframe_interval_handle character varying(64),
    filter jsonb,
    group_by jsonb,
    relation_field character varying(128),
    relation_handle character varying(64),
    target_entity_handle character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secondary_aggregation_handle character varying(64),
    secondary_target_entity_handle character varying(64),
    secondary_field character varying(128),
    secondary_filter jsonb,
    duration_start_field character varying(128),
    formula_operation character varying(32),
    formula_scale real,
    unit character varying(32),
    target_value real,
    target_direction character varying(32),
    warning_threshold real,
    critical_threshold real
);

CREATE SEQUENCE public.kpi_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.kpi_item_handle_seq OWNED BY public.kpi_item.handle;

CREATE TABLE public.kpi_timeframe_item (
    handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.kpi_type_item (
    handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.language_item (
    handle character varying(64) NOT NULL,
    name character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.marketing_campaign_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    description text,
    start_date date,
    end_date date,
    is_active boolean DEFAULT true NOT NULL,
    status_handle character varying(64) DEFAULT 'planned'::character varying NOT NULL,
    type_handle character varying(64) DEFAULT 'newsletter'::character varying NOT NULL,
    target_list_handle integer,
    email_template_handle integer,
    owner_person_handle integer,
    opportunity_source_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.marketing_campaign_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.marketing_campaign_item_handle_seq OWNED BY public.marketing_campaign_item.handle;

CREATE TABLE public.marketing_campaign_status_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar-clock'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_open boolean DEFAULT true NOT NULL
);

CREATE TABLE public.marketing_campaign_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-bullhorn-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.mcp_server_config_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    description character varying(512),
    transport character varying(32) DEFAULT 'http'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    endpoint character varying(512),
    command character varying(512),
    args jsonb,
    environment jsonb,
    headers jsonb,
    auth_config jsonb,
    allowed_tools jsonb,
    timeout_ms character varying(255),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.mcp_server_config_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.mcp_server_config_item_handle_seq OWNED BY public.mcp_server_config_item.handle;

CREATE TABLE public.money_item (
    handle character varying(16) NOT NULL,
    name character varying(64) NOT NULL,
    symbol character varying(8) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.note_group_item (
    handle character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-folder'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.note_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(1024),
    person_handle integer,
    group_handle character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.note_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.note_item_handle_seq OWNED BY public.note_item.handle;

CREATE TABLE public.permission_item (
    handle integer NOT NULL,
    allow_read boolean DEFAULT true NOT NULL,
    allow_insert boolean DEFAULT true NOT NULL,
    allow_update boolean DEFAULT true NOT NULL,
    allow_delete boolean DEFAULT true NOT NULL,
    allow_show boolean DEFAULT true NOT NULL,
    entity_handle character varying(64) NOT NULL,
    role_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.permission_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.permission_item_handle_seq OWNED BY public.permission_item.handle;

CREATE TABLE public.person_api_token_item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    token_prefix character varying(24) NOT NULL,
    token_hash character varying(128) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone,
    allowed_ips jsonb,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.person_api_token_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.person_api_token_item_handle_seq OWNED BY public.person_api_token_item.handle;

CREATE TABLE public.person_decision_role_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-account-check-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.person_department_item (
    handle character varying(64) NOT NULL,
    description character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.person_function_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-account-tie-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.person_item (
    handle integer NOT NULL,
    first_name character varying(64),
    last_name character varying(64) NOT NULL,
    login_name character varying(64),
    login_password character varying(128),
    phone character varying(32),
    mobile character varying(32),
    email character varying(128),
    birth_day date,
    require_password_change boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    send_newsletter boolean DEFAULT true NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    company_handle integer,
    salutation_handle character varying(64),
    title_handle character varying(64),
    job_title_handle character varying(64),
    job_function_handle character varying(64),
    decision_role_handle character varying(64),
    type_handle character varying(64) DEFAULT 'sapling'::character varying,
    department_handle character varying(64),
    language_handle character varying(64) DEFAULT 'de'::character varying,
    work_week_handle integer,
    holiday_group_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    email_signature_rotation boolean DEFAULT true NOT NULL,
    default_email_signature_handle integer
);

CREATE TABLE public.person_item_events (
    person_item_handle integer NOT NULL,
    event_item_handle integer NOT NULL
);

CREATE SEQUENCE public.person_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.person_item_handle_seq OWNED BY public.person_item.handle;

CREATE TABLE public.person_item_roles (
    person_item_handle integer NOT NULL,
    role_item_handle integer NOT NULL
);

CREATE TABLE public.person_job_title_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-briefcase-account-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.person_passkey_item (
    handle integer NOT NULL,
    label character varying(128) NOT NULL,
    credential_id character varying(512) NOT NULL,
    public_key text NOT NULL,
    counter integer DEFAULT 0 NOT NULL,
    transports jsonb,
    credential_device_type character varying(32),
    credential_backed_up boolean DEFAULT false NOT NULL,
    last_used_at timestamp with time zone,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.person_passkey_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.person_passkey_item_handle_seq OWNED BY public.person_passkey_item.handle;

CREATE TABLE public.person_salutation_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-card-account-details-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.person_session_item (
    handle integer NOT NULL,
    number character varying(128) NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.person_session_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.person_session_item_handle_seq OWNED BY public.person_session_item.handle;

CREATE TABLE public.person_title_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-school-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.person_type_item (
    handle character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.phone_call_item (
    handle integer NOT NULL,
    phone_number character varying(64) NOT NULL,
    note text,
    reached boolean DEFAULT false NOT NULL,
    entity_handle character varying(64) NOT NULL,
    reference character varying(128) NOT NULL,
    person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.phone_call_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.phone_call_item_handle_seq OWNED BY public.phone_call_item.handle;

CREATE TABLE public.product_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    name character varying(64) NOT NULL,
    version character varying(32) DEFAULT '1.0.0'::character varying,
    description character varying(512),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.product_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.product_item_handle_seq OWNED BY public.product_item.handle;

CREATE TABLE public.role_item (
    handle integer NOT NULL,
    title character varying(64) NOT NULL,
    is_administrator boolean DEFAULT false NOT NULL,
    stage_handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.role_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.role_item_handle_seq OWNED BY public.role_item.handle;

CREATE TABLE public.role_item_starter_dashboard_templates (
    role_item_handle integer NOT NULL,
    dashboard_template_item_handle integer CONSTRAINT role_item_starter_dashboard_dashboard_template_item_ha_not_null NOT NULL
);

CREATE TABLE public.role_item_starter_favorite_templates (
    role_item_handle integer NOT NULL,
    favorite_template_item_handle integer CONSTRAINT role_item_starter_favorite__favorite_template_item_han_not_null NOT NULL
);

CREATE TABLE public.role_stage_item (
    handle character varying(64) NOT NULL,
    title character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.sales_opportunity_forecast_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.sales_opportunity_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    description text,
    expected_revenue real,
    probability real,
    close_date date,
    next_step character varying(256),
    pain_points text,
    is_active boolean DEFAULT true NOT NULL,
    type_handle character varying(64) DEFAULT 'new'::character varying NOT NULL,
    forecast_handle character varying(64) DEFAULT 'pipeline'::character varying NOT NULL,
    source_handle integer NOT NULL,
    result_status_handle character varying(64) DEFAULT 'open'::character varying NOT NULL,
    loss_reason_handle character varying(64),
    assignee_company_handle integer,
    assignee_person_handle integer,
    creator_company_handle integer NOT NULL,
    creator_person_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    number character varying(32)
);

CREATE TABLE public.sales_opportunity_item_competitors (
    sales_opportunity_item_handle integer CONSTRAINT sales_opportunity_item_comp_sales_opportunity_item_han_not_null NOT NULL,
    company_item_handle integer NOT NULL
);

CREATE SEQUENCE public.sales_opportunity_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sales_opportunity_item_handle_seq OWNED BY public.sales_opportunity_item.handle;

CREATE TABLE public.sales_opportunity_loss_reason_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(512),
    icon character varying(64) DEFAULT 'mdi-close-circle-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#9E9E9E'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.sales_opportunity_result_status_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    is_success boolean DEFAULT false NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    icon character varying(64) DEFAULT 'mdi-circle-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#546E7A'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.sales_opportunity_source_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    name character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.sales_opportunity_source_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sales_opportunity_source_item_handle_seq OWNED BY public.sales_opportunity_source_item.handle;

CREATE TABLE public.sales_opportunity_stage_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(256),
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    default_probability real DEFAULT 0 NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    is_success boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_open boolean DEFAULT true NOT NULL
);

CREATE TABLE public.sapling_form_config_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    entity_handle character varying(64) NOT NULL,
    scope character varying(16) DEFAULT 'global'::character varying NOT NULL,
    scope_handle character varying(64),
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    config jsonb NOT NULL,
    person_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.sapling_form_config_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sapling_form_config_item_handle_seq OWNED BY public.sapling_form_config_item.handle;

CREATE TABLE public.script_button_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    title character varying(128) NOT NULL,
    parameter jsonb,
    is_multi_select boolean DEFAULT false NOT NULL,
    entity_handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.script_button_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.script_button_item_handle_seq OWNED BY public.script_button_item.handle;

CREATE TABLE public.seed_script_item (
    handle integer NOT NULL,
    script_name character varying(256) NOT NULL,
    entity_handle character varying(64) NOT NULL,
    executed_at timestamp with time zone NOT NULL,
    is_success boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.seed_script_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.seed_script_item_handle_seq OWNED BY public.seed_script_item.handle;

CREATE TABLE public.server_landscape_item (
    handle integer NOT NULL,
    server_name character varying(128) NOT NULL,
    description character varying(512),
    allow_remote_access boolean DEFAULT false NOT NULL,
    has_internet_access boolean DEFAULT true NOT NULL,
    type_handle character varying(64) NOT NULL,
    usage_handle character varying(64) NOT NULL,
    company_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.server_landscape_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.server_landscape_item_handle_seq OWNED BY public.server_landscape_item.handle;

CREATE TABLE public.server_landscape_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-server'::character varying NOT NULL,
    color character varying(32) DEFAULT '#1565C0'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.server_landscape_type_usage_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-console-network'::character varying NOT NULL,
    color character varying(32) DEFAULT '#2E7D32'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.session_store_item (
    handle character varying(255) NOT NULL,
    payload jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    person_handle integer,
    last_seen_at timestamp with time zone
);

CREATE TABLE public.shared_mailbox_context_item (
    handle integer NOT NULL,
    entity_handle character varying(64) NOT NULL,
    mailbox_handle integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    template_handle integer
);

CREATE SEQUENCE public.shared_mailbox_context_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shared_mailbox_context_item_handle_seq OWNED BY public.shared_mailbox_context_item.handle;

CREATE TABLE public.shared_mailbox_group_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(256),
    icon character varying(64) DEFAULT 'mdi-email-lock-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#1565C0'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.shared_mailbox_group_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shared_mailbox_group_item_handle_seq OWNED BY public.shared_mailbox_group_item.handle;

CREATE TABLE public.shared_mailbox_group_item_persons (
    shared_mailbox_group_item_handle integer CONSTRAINT shared_mailbox_group_item_p_shared_mailbox_group_item__not_null NOT NULL,
    person_item_handle integer NOT NULL
);

CREATE TABLE public.shared_mailbox_item (
    handle integer NOT NULL,
    title character varying(128) NOT NULL,
    email character varying(256) NOT NULL,
    description character varying(256),
    provider_handle character varying(64) DEFAULT 'azure'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    group_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.shared_mailbox_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shared_mailbox_item_handle_seq OWNED BY public.shared_mailbox_item.handle;

CREATE TABLE public.sla_policy_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(256),
    first_response_hours integer DEFAULT 8 NOT NULL,
    resolution_hours integer DEFAULT 40 NOT NULL,
    icon character varying(64) DEFAULT 'mdi-timer-sand'::character varying NOT NULL,
    color character varying(32) DEFAULT '#E53935'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    work_week_handle integer,
    holiday_group_handle integer,
    time_zone character varying(64)
);

CREATE TABLE public.social_media_item (
    handle integer NOT NULL,
    title character varying(128),
    url character varying(256) NOT NULL,
    username character varying(64),
    external_id character varying(128),
    is_primary boolean DEFAULT false NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    notes character varying(256),
    person_handle integer NOT NULL,
    type_handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.social_media_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.social_media_item_handle_seq OWNED BY public.social_media_item.handle;

CREATE TABLE public.social_media_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-web'::character varying NOT NULL,
    color character varying(32) DEFAULT '#1E88E5'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.support_queue_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(256),
    icon character varying(64) DEFAULT 'mdi-inbox-arrow-down-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#00897B'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    team_handle character varying(64) NOT NULL,
    default_sla_policy_handle character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.support_team_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description character varying(256),
    icon character varying(64) DEFAULT 'mdi-account-group-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#3949AB'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.system_alert_incident_item (
    handle integer NOT NULL,
    rule_handle character varying(64) NOT NULL,
    fingerprint character varying(320) NOT NULL,
    dimension_key character varying(255) DEFAULT ''::character varying NOT NULL,
    state character varying(16) DEFAULT 'open'::character varying NOT NULL,
    severity character varying(16) NOT NULL,
    observed_value double precision NOT NULL,
    threshold double precision NOT NULL,
    healthy_evaluations integer DEFAULT 0 NOT NULL,
    notified_severity character varying(16),
    first_seen_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    environment_handle character varying(96) NOT NULL,
    incident_type character varying(24) DEFAULT 'threshold'::character varying NOT NULL,
    correlation_key character varying(320),
    diagnosis jsonb,
    resolved_reason character varying(48)
);

CREATE SEQUENCE public.system_alert_incident_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_alert_incident_item_handle_seq OWNED BY public.system_alert_incident_item.handle;

CREATE TABLE public.system_alert_rule_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    metric_key character varying(96) NOT NULL,
    severity character varying(16) DEFAULT 'warning'::character varying NOT NULL,
    comparator character varying(8) DEFAULT 'gt'::character varying NOT NULL,
    threshold double precision NOT NULL,
    window_seconds integer DEFAULT 300 NOT NULL,
    minimum_count integer DEFAULT 1 NOT NULL,
    scope character varying(16) DEFAULT 'global'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    evaluation_type character varying(24) DEFAULT 'threshold'::character varying NOT NULL,
    evaluation_config jsonb,
    shadow_mode boolean DEFAULT false NOT NULL,
    remediation_mode character varying(16) DEFAULT 'none'::character varying NOT NULL,
    remediation_action_key character varying(96)
);

CREATE TABLE public.system_canary_record_item (
    handle integer NOT NULL,
    marker character varying(96) NOT NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.system_canary_record_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_canary_record_item_handle_seq OWNED BY public.system_canary_record_item.handle;

CREATE TABLE public.system_check_run_item (
    handle integer NOT NULL,
    environment_handle character varying(96) NOT NULL,
    check_key character varying(96) NOT NULL,
    category character varying(32) NOT NULL,
    status character varying(16) NOT NULL,
    duration_ms integer NOT NULL,
    summary character varying(500),
    steps jsonb,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.system_check_run_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_check_run_item_handle_seq OWNED BY public.system_check_run_item.handle;

CREATE TABLE public.system_error_group_item (
    handle integer NOT NULL,
    environment_handle character varying(96) NOT NULL,
    fingerprint character varying(64) NOT NULL,
    source character varying(24) NOT NULL,
    operation character varying(160) NOT NULL,
    status character varying(16) DEFAULT 'open'::character varying NOT NULL,
    occurrence_count integer DEFAULT 1 NOT NULL,
    latest_release character varying(128),
    first_seen_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.system_error_group_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_error_group_item_handle_seq OWNED BY public.system_error_group_item.handle;

CREATE TABLE public.system_error_occurrence_item (
    handle integer NOT NULL,
    group_handle integer NOT NULL,
    environment_handle character varying(96) NOT NULL,
    instance_handle character varying(128),
    operation character varying(160) NOT NULL,
    source character varying(24) NOT NULL,
    error_class character varying(128) NOT NULL,
    error_code character varying(64),
    message character varying(500) NOT NULL,
    stack text,
    request_id character varying(64),
    correlation_id character varying(64),
    release character varying(128),
    occurred_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.system_error_occurrence_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_error_occurrence_item_handle_seq OWNED BY public.system_error_occurrence_item.handle;

CREATE TABLE public.system_metric_bucket_item (
    handle integer NOT NULL,
    instance_handle character varying(128) NOT NULL,
    bucket_start timestamp with time zone NOT NULL,
    resolution character varying(8) NOT NULL,
    metric_key character varying(96) NOT NULL,
    dimension_key character varying(255) DEFAULT ''::character varying NOT NULL,
    sample_count integer DEFAULT 1 NOT NULL,
    minimum double precision NOT NULL,
    maximum double precision NOT NULL,
    sum double precision NOT NULL,
    last double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.system_metric_bucket_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_metric_bucket_item_handle_seq OWNED BY public.system_metric_bucket_item.handle;

CREATE TABLE public.system_remediation_execution_item (
    handle integer NOT NULL,
    environment_handle character varying(96) NOT NULL,
    incident_handle integer,
    action_key character varying(96) NOT NULL,
    mode character varying(16) NOT NULL,
    state character varying(24) NOT NULL,
    attempt integer DEFAULT 1 NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    approved_by_handle integer,
    evidence jsonb,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone
);

CREATE SEQUENCE public.system_remediation_execution_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_remediation_execution_item_handle_seq OWNED BY public.system_remediation_execution_item.handle;

CREATE TABLE public.system_telemetry_environment_item (
    handle character varying(96) NOT NULL,
    name character varying(128) NOT NULL,
    kind character varying(24) NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    first_seen_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone NOT NULL
);

CREATE TABLE public.system_telemetry_instance_item (
    handle character varying(128) NOT NULL,
    hostname character varying(255) NOT NULL,
    app_version character varying(64),
    process_started_at timestamp with time zone NOT NULL,
    last_sample_at timestamp with time zone,
    collector_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    environment_handle character varying(96) NOT NULL,
    process_slot character varying(96) NOT NULL,
    boot_id character varying(64) NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    stopped_at timestamp with time zone,
    retired_at timestamp with time zone,
    lifecycle_reason character varying(48)
);

CREATE TABLE public.teams_delivery_item (
    handle integer NOT NULL,
    status_handle character varying(64) DEFAULT 'pending'::character varying,
    subscription_handle integer NOT NULL,
    template_handle integer,
    entity_handle character varying(64) NOT NULL,
    created_by_handle integer NOT NULL,
    recipient_person_handle integer,
    reference_handle character varying(64),
    provider character varying(32) DEFAULT 'azure'::character varying NOT NULL,
    body_markdown character varying(8192) NOT NULL,
    body_html character varying(16384) NOT NULL,
    request_payload jsonb,
    response_status_code integer,
    response_body jsonb,
    provider_message_id character varying(256),
    completed_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    automation_deduplication_key character varying(190)
);

CREATE SEQUENCE public.teams_delivery_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.teams_delivery_item_handle_seq OWNED BY public.teams_delivery_item.handle;

CREATE TABLE public.teams_delivery_status_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-microsoft-teams'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);

CREATE TABLE public.teams_subscription_item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    recipient_field character varying(64) NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    entity_handle character varying(64) NOT NULL,
    type_handle character varying(64) DEFAULT 'afterInsert'::character varying NOT NULL,
    template_handle integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    source_entity_handle character varying(64),
    reference_path jsonb DEFAULT '[]'::jsonb NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    notify_actor boolean DEFAULT false NOT NULL
);

CREATE SEQUENCE public.teams_subscription_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.teams_subscription_item_handle_seq OWNED BY public.teams_subscription_item.handle;

CREATE TABLE public.teams_template_item (
    handle integer NOT NULL,
    name character varying(128) NOT NULL,
    description character varying(256),
    body_markdown character varying(8192) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    entity_handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.teams_template_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.teams_template_item_handle_seq OWNED BY public.teams_template_item.handle;

CREATE TABLE public.ticket_category_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-shape-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#5C6BC0'::character varying NOT NULL,
    type_handle character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.ticket_item (
    handle integer NOT NULL,
    number character varying(32),
    title character varying(256) NOT NULL,
    status_handle character varying(64) DEFAULT 'open'::character varying,
    priority_handle character varying(64) DEFAULT 'normal'::character varying,
    external_number character varying(128),
    problem_description text,
    solution_description text,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    deadline_date timestamp with time zone,
    assignee_company_handle integer,
    assignee_person_handle integer,
    creator_company_handle integer NOT NULL,
    creator_person_handle integer NOT NULL,
    sales_opportunity_handle integer,
    sla_policy_handle character varying(64),
    first_response_due_at timestamp with time zone,
    resolution_due_at timestamp with time zone,
    first_responded_at timestamp with time zone,
    resolved_at timestamp with time zone,
    type_handle character varying(64) DEFAULT 'incident'::character varying NOT NULL,
    category_handle character varying(64),
    source_handle character varying(64) DEFAULT 'email'::character varying NOT NULL,
    support_team_handle character varying(64),
    support_queue_handle character varying(64),
    contract_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.ticket_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ticket_item_handle_seq OWNED BY public.ticket_item.handle;

CREATE TABLE public.ticket_priority_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    color character varying(16) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-chevron-down'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.ticket_source_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-email-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#00897B'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.ticket_status_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    color character varying(16) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-new-box'::character varying NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);

CREATE TABLE public.ticket_time_tracking_item (
    handle integer NOT NULL,
    title character varying(64) NOT NULL,
    description character varying(2048) NOT NULL,
    person_handle integer NOT NULL,
    ticket_handle integer NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.ticket_time_tracking_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ticket_time_tracking_item_handle_seq OWNED BY public.ticket_time_tracking_item.handle;

CREATE TABLE public.ticket_type_item (
    handle character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-alert-circle-outline'::character varying NOT NULL,
    color character varying(32) DEFAULT '#F44336'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.translation_item (
    handle integer NOT NULL,
    entity character varying(64) NOT NULL,
    property character varying(64) NOT NULL,
    value character varying(1024) NOT NULL,
    language_handle character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.translation_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.translation_item_handle_seq OWNED BY public.translation_item.handle;

CREATE TABLE public.webhook_authentication_api_key_item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    header_name character varying(128) NOT NULL,
    api_key character varying(256),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.webhook_authentication_api_key_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.webhook_authentication_api_key_item_handle_seq OWNED BY public.webhook_authentication_api_key_item.handle;

CREATE TABLE public.webhook_authentication_basic_item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    username character varying(64) NOT NULL,
    password character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.webhook_authentication_basic_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.webhook_authentication_basic_item_handle_seq OWNED BY public.webhook_authentication_basic_item.handle;

CREATE TABLE public.webhook_authentication_oauth2item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    client_id character varying(128) NOT NULL,
    client_secret character varying(256),
    token_url character varying(256) NOT NULL,
    scope character varying(256),
    parameters jsonb,
    cached_token character varying(2048),
    token_expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.webhook_authentication_oauth2item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.webhook_authentication_oauth2item_handle_seq OWNED BY public.webhook_authentication_oauth2item.handle;

CREATE TABLE public.webhook_authentication_type_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.webhook_delivery_item (
    handle integer NOT NULL,
    status_handle character varying(64) DEFAULT 'pending'::character varying,
    subscription_handle integer NOT NULL,
    payload jsonb NOT NULL,
    request_headers jsonb,
    response_status_code integer DEFAULT 200,
    response_body jsonb,
    response_headers jsonb,
    completed_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    automation_deduplication_key character varying(190)
);

CREATE SEQUENCE public.webhook_delivery_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.webhook_delivery_item_handle_seq OWNED BY public.webhook_delivery_item.handle;

CREATE TABLE public.webhook_delivery_status_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);

CREATE TABLE public.webhook_subscription_item (
    handle integer NOT NULL,
    description character varying(128) NOT NULL,
    custom_headers jsonb,
    container_name character varying(128),
    relations jsonb,
    payload_type_handle character varying(64) DEFAULT 'list'::character varying NOT NULL,
    url character varying(256) NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    authentication_type_handle character varying(64) DEFAULT 'none'::character varying,
    authentication_api_key_handle integer,
    authentication_oauth2_handle integer,
    authentication_basic_handle integer,
    signing_secret character varying(128),
    entity_handle character varying(64) NOT NULL,
    type_handle character varying(64) DEFAULT 'afterInsert'::character varying NOT NULL,
    method_handle character varying(64) DEFAULT 'post'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    source_entity_handle character varying(64),
    reference_path jsonb DEFAULT '[]'::jsonb NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL
);

CREATE SEQUENCE public.webhook_subscription_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.webhook_subscription_item_handle_seq OWNED BY public.webhook_subscription_item.handle;

CREATE TABLE public.webhook_subscription_method_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.webhook_subscription_payload_type (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.webhook_subscription_type_item (
    handle character varying(64) NOT NULL,
    description character varying(64) NOT NULL,
    icon character varying(64) DEFAULT 'mdi-calendar'::character varying NOT NULL,
    color character varying(32) DEFAULT '#4CAF50'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.work_hour_item (
    handle integer NOT NULL,
    title character varying(64) NOT NULL,
    time_from time(0) without time zone NOT NULL,
    time_to time(0) without time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.work_hour_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.work_hour_item_handle_seq OWNED BY public.work_hour_item.handle;

CREATE TABLE public.work_hour_week_item (
    handle integer NOT NULL,
    title character varying(64) NOT NULL,
    monday_handle integer,
    tuesday_handle integer,
    wednesday_handle integer,
    thursday_handle integer,
    friday_handle integer,
    saturday_handle integer,
    sunday_handle integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.work_hour_week_item_handle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.work_hour_week_item_handle_seq OWNED BY public.work_hour_week_item.handle;

ALTER TABLE ONLY public.address_item ALTER COLUMN handle SET DEFAULT nextval('public.address_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_agent_evaluation_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_agent_evaluation_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_agent_memory_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_agent_memory_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_agent_run_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_agent_run_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_agent_version_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_agent_version_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_chat_attachment_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_chat_attachment_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_chat_message_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_chat_message_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_chat_queued_input_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_chat_queued_input_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_chat_session_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_chat_session_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_chat_tool_action_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_chat_tool_action_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_chat_transcription_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_chat_transcription_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_prompt_version_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_prompt_version_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_usage_event_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_usage_event_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ai_vector_document_item ALTER COLUMN handle SET DEFAULT nextval('public.ai_vector_document_item_handle_seq'::regclass);

ALTER TABLE ONLY public.authentication_event_item ALTER COLUMN handle SET DEFAULT nextval('public.authentication_event_item_handle_seq'::regclass);

ALTER TABLE ONLY public.automation_event_item ALTER COLUMN handle SET DEFAULT nextval('public.automation_event_item_handle_seq'::regclass);

ALTER TABLE ONLY public.automation_execution_item ALTER COLUMN handle SET DEFAULT nextval('public.automation_execution_item_handle_seq'::regclass);

ALTER TABLE ONLY public.calendar_sync_subscription_item ALTER COLUMN handle SET DEFAULT nextval('public.calendar_sync_subscription_item_handle_seq'::regclass);

ALTER TABLE ONLY public.change_log_detail_item ALTER COLUMN handle SET DEFAULT nextval('public.change_log_detail_item_handle_seq'::regclass);

ALTER TABLE ONLY public.change_log_item ALTER COLUMN handle SET DEFAULT nextval('public.change_log_item_handle_seq'::regclass);

ALTER TABLE ONLY public.company_item ALTER COLUMN handle SET DEFAULT nextval('public.company_item_handle_seq'::regclass);

ALTER TABLE ONLY public.company_relationship_item ALTER COLUMN handle SET DEFAULT nextval('public.company_relationship_item_handle_seq'::regclass);

ALTER TABLE ONLY public.contract_item ALTER COLUMN handle SET DEFAULT nextval('public.contract_item_handle_seq'::regclass);

ALTER TABLE ONLY public.custom_field_definition_item ALTER COLUMN handle SET DEFAULT nextval('public.custom_field_definition_item_handle_seq'::regclass);

ALTER TABLE ONLY public.custom_field_value_item ALTER COLUMN handle SET DEFAULT nextval('public.custom_field_value_item_handle_seq'::regclass);

ALTER TABLE ONLY public.dashboard_item ALTER COLUMN handle SET DEFAULT nextval('public.dashboard_item_handle_seq'::regclass);

ALTER TABLE ONLY public.dashboard_template_item ALTER COLUMN handle SET DEFAULT nextval('public.dashboard_template_item_handle_seq'::regclass);

ALTER TABLE ONLY public.document_item ALTER COLUMN handle SET DEFAULT nextval('public.document_item_handle_seq'::regclass);

ALTER TABLE ONLY public.dvelop_connection_item ALTER COLUMN handle SET DEFAULT nextval('public.dvelop_connection_item_handle_seq'::regclass);

ALTER TABLE ONLY public.dvelop_entity_mapping_item ALTER COLUMN handle SET DEFAULT nextval('public.dvelop_entity_mapping_item_handle_seq'::regclass);

ALTER TABLE ONLY public.dvelop_entity_mapping_property_item ALTER COLUMN handle SET DEFAULT nextval('public.dvelop_entity_mapping_property_item_handle_seq'::regclass);

ALTER TABLE ONLY public.dvelop_entity_mapping_search_category_item ALTER COLUMN handle SET DEFAULT nextval('public.dvelop_entity_mapping_search_category_item_handle_seq'::regclass);

ALTER TABLE ONLY public.dvelop_object_definition_item ALTER COLUMN handle SET DEFAULT nextval('public.dvelop_object_definition_item_handle_seq'::regclass);

ALTER TABLE ONLY public.dvelop_property_item ALTER COLUMN handle SET DEFAULT nextval('public.dvelop_property_item_handle_seq'::regclass);

ALTER TABLE ONLY public.dvelop_repository_item ALTER COLUMN handle SET DEFAULT nextval('public.dvelop_repository_item_handle_seq'::regclass);

ALTER TABLE ONLY public.effort_estimate_item ALTER COLUMN handle SET DEFAULT nextval('public.effort_estimate_item_handle_seq'::regclass);

ALTER TABLE ONLY public.effort_estimate_position_item ALTER COLUMN handle SET DEFAULT nextval('public.effort_estimate_position_item_handle_seq'::regclass);

ALTER TABLE ONLY public.effort_estimate_position_template_item ALTER COLUMN handle SET DEFAULT nextval('public.effort_estimate_position_template_item_handle_seq'::regclass);

ALTER TABLE ONLY public.email_delivery_item ALTER COLUMN handle SET DEFAULT nextval('public.email_delivery_item_handle_seq'::regclass);

ALTER TABLE ONLY public.email_inbox_subscription_item ALTER COLUMN handle SET DEFAULT nextval('public.email_inbox_subscription_item_handle_seq'::regclass);

ALTER TABLE ONLY public.email_list_item ALTER COLUMN handle SET DEFAULT nextval('public.email_list_item_handle_seq'::regclass);

ALTER TABLE ONLY public.email_signature_item ALTER COLUMN handle SET DEFAULT nextval('public.email_signature_item_handle_seq'::regclass);

ALTER TABLE ONLY public.email_subscription_condition_item ALTER COLUMN handle SET DEFAULT nextval('public.email_subscription_condition_item_handle_seq'::regclass);

ALTER TABLE ONLY public.email_subscription_item ALTER COLUMN handle SET DEFAULT nextval('public.email_subscription_item_handle_seq'::regclass);

ALTER TABLE ONLY public.email_template_item ALTER COLUMN handle SET DEFAULT nextval('public.email_template_item_handle_seq'::regclass);

ALTER TABLE ONLY public.entity_route_item ALTER COLUMN handle SET DEFAULT nextval('public.entity_route_item_handle_seq'::regclass);

ALTER TABLE ONLY public.event_azure_item ALTER COLUMN handle SET DEFAULT nextval('public.event_azure_item_handle_seq'::regclass);

ALTER TABLE ONLY public.event_delivery_item ALTER COLUMN handle SET DEFAULT nextval('public.event_delivery_item_handle_seq'::regclass);

ALTER TABLE ONLY public.event_google_item ALTER COLUMN handle SET DEFAULT nextval('public.event_google_item_handle_seq'::regclass);

ALTER TABLE ONLY public.event_item ALTER COLUMN handle SET DEFAULT nextval('public.event_item_handle_seq'::regclass);

ALTER TABLE ONLY public.external_record_link_item ALTER COLUMN handle SET DEFAULT nextval('public.external_record_link_item_handle_seq'::regclass);

ALTER TABLE ONLY public.favorite_item ALTER COLUMN handle SET DEFAULT nextval('public.favorite_item_handle_seq'::regclass);

ALTER TABLE ONLY public.favorite_template_item ALTER COLUMN handle SET DEFAULT nextval('public.favorite_template_item_handle_seq'::regclass);

ALTER TABLE ONLY public.field_automation_item ALTER COLUMN handle SET DEFAULT nextval('public.field_automation_item_handle_seq'::regclass);

ALTER TABLE ONLY public.field_permission_item ALTER COLUMN handle SET DEFAULT nextval('public.field_permission_item_handle_seq'::regclass);

ALTER TABLE ONLY public.global_search_index_item ALTER COLUMN handle SET DEFAULT nextval('public.global_search_index_item_handle_seq'::regclass);

ALTER TABLE ONLY public.holiday_group_item ALTER COLUMN handle SET DEFAULT nextval('public.holiday_group_item_handle_seq'::regclass);

ALTER TABLE ONLY public.holiday_item ALTER COLUMN handle SET DEFAULT nextval('public.holiday_item_handle_seq'::regclass);

ALTER TABLE ONLY public.http_metric_bucket_item ALTER COLUMN handle SET DEFAULT nextval('public.http_metric_bucket_item_handle_seq'::regclass);

ALTER TABLE ONLY public.import_batch_item ALTER COLUMN handle SET DEFAULT nextval('public.import_batch_item_handle_seq'::regclass);

ALTER TABLE ONLY public.import_batch_row_item ALTER COLUMN handle SET DEFAULT nextval('public.import_batch_row_item_handle_seq'::regclass);

ALTER TABLE ONLY public.import_template_item ALTER COLUMN handle SET DEFAULT nextval('public.import_template_item_handle_seq'::regclass);

ALTER TABLE ONLY public.import_template_value_mapping_item ALTER COLUMN handle SET DEFAULT nextval('public.import_template_value_mapping_item_handle_seq'::regclass);

ALTER TABLE ONLY public.inbound_email_item ALTER COLUMN handle SET DEFAULT nextval('public.inbound_email_item_handle_seq'::regclass);

ALTER TABLE ONLY public.inbox_notification_item ALTER COLUMN handle SET DEFAULT nextval('public.inbox_notification_item_handle_seq'::regclass);

ALTER TABLE ONLY public.inbox_subscription_item ALTER COLUMN handle SET DEFAULT nextval('public.inbox_subscription_item_handle_seq'::regclass);

ALTER TABLE ONLY public.inbox_template_item ALTER COLUMN handle SET DEFAULT nextval('public.inbox_template_item_handle_seq'::regclass);

ALTER TABLE ONLY public.information_item ALTER COLUMN handle SET DEFAULT nextval('public.information_item_handle_seq'::regclass);

ALTER TABLE ONLY public.internal_case_item ALTER COLUMN handle SET DEFAULT nextval('public.internal_case_item_handle_seq'::regclass);

ALTER TABLE ONLY public.knowledge_article_item ALTER COLUMN handle SET DEFAULT nextval('public.knowledge_article_item_handle_seq'::regclass);

ALTER TABLE ONLY public.kpi_item ALTER COLUMN handle SET DEFAULT nextval('public.kpi_item_handle_seq'::regclass);

ALTER TABLE ONLY public.marketing_campaign_item ALTER COLUMN handle SET DEFAULT nextval('public.marketing_campaign_item_handle_seq'::regclass);

ALTER TABLE ONLY public.mcp_server_config_item ALTER COLUMN handle SET DEFAULT nextval('public.mcp_server_config_item_handle_seq'::regclass);

ALTER TABLE ONLY public.note_item ALTER COLUMN handle SET DEFAULT nextval('public.note_item_handle_seq'::regclass);

ALTER TABLE ONLY public.permission_item ALTER COLUMN handle SET DEFAULT nextval('public.permission_item_handle_seq'::regclass);

ALTER TABLE ONLY public.person_api_token_item ALTER COLUMN handle SET DEFAULT nextval('public.person_api_token_item_handle_seq'::regclass);

ALTER TABLE ONLY public.person_item ALTER COLUMN handle SET DEFAULT nextval('public.person_item_handle_seq'::regclass);

ALTER TABLE ONLY public.person_passkey_item ALTER COLUMN handle SET DEFAULT nextval('public.person_passkey_item_handle_seq'::regclass);

ALTER TABLE ONLY public.person_session_item ALTER COLUMN handle SET DEFAULT nextval('public.person_session_item_handle_seq'::regclass);

ALTER TABLE ONLY public.phone_call_item ALTER COLUMN handle SET DEFAULT nextval('public.phone_call_item_handle_seq'::regclass);

ALTER TABLE ONLY public.product_item ALTER COLUMN handle SET DEFAULT nextval('public.product_item_handle_seq'::regclass);

ALTER TABLE ONLY public.role_item ALTER COLUMN handle SET DEFAULT nextval('public.role_item_handle_seq'::regclass);

ALTER TABLE ONLY public.sales_opportunity_item ALTER COLUMN handle SET DEFAULT nextval('public.sales_opportunity_item_handle_seq'::regclass);

ALTER TABLE ONLY public.sales_opportunity_source_item ALTER COLUMN handle SET DEFAULT nextval('public.sales_opportunity_source_item_handle_seq'::regclass);

ALTER TABLE ONLY public.sapling_form_config_item ALTER COLUMN handle SET DEFAULT nextval('public.sapling_form_config_item_handle_seq'::regclass);

ALTER TABLE ONLY public.script_button_item ALTER COLUMN handle SET DEFAULT nextval('public.script_button_item_handle_seq'::regclass);

ALTER TABLE ONLY public.seed_script_item ALTER COLUMN handle SET DEFAULT nextval('public.seed_script_item_handle_seq'::regclass);

ALTER TABLE ONLY public.server_landscape_item ALTER COLUMN handle SET DEFAULT nextval('public.server_landscape_item_handle_seq'::regclass);

ALTER TABLE ONLY public.shared_mailbox_context_item ALTER COLUMN handle SET DEFAULT nextval('public.shared_mailbox_context_item_handle_seq'::regclass);

ALTER TABLE ONLY public.shared_mailbox_group_item ALTER COLUMN handle SET DEFAULT nextval('public.shared_mailbox_group_item_handle_seq'::regclass);

ALTER TABLE ONLY public.shared_mailbox_item ALTER COLUMN handle SET DEFAULT nextval('public.shared_mailbox_item_handle_seq'::regclass);

ALTER TABLE ONLY public.social_media_item ALTER COLUMN handle SET DEFAULT nextval('public.social_media_item_handle_seq'::regclass);

ALTER TABLE ONLY public.system_alert_incident_item ALTER COLUMN handle SET DEFAULT nextval('public.system_alert_incident_item_handle_seq'::regclass);

ALTER TABLE ONLY public.system_canary_record_item ALTER COLUMN handle SET DEFAULT nextval('public.system_canary_record_item_handle_seq'::regclass);

ALTER TABLE ONLY public.system_check_run_item ALTER COLUMN handle SET DEFAULT nextval('public.system_check_run_item_handle_seq'::regclass);

ALTER TABLE ONLY public.system_error_group_item ALTER COLUMN handle SET DEFAULT nextval('public.system_error_group_item_handle_seq'::regclass);

ALTER TABLE ONLY public.system_error_occurrence_item ALTER COLUMN handle SET DEFAULT nextval('public.system_error_occurrence_item_handle_seq'::regclass);

ALTER TABLE ONLY public.system_metric_bucket_item ALTER COLUMN handle SET DEFAULT nextval('public.system_metric_bucket_item_handle_seq'::regclass);

ALTER TABLE ONLY public.system_remediation_execution_item ALTER COLUMN handle SET DEFAULT nextval('public.system_remediation_execution_item_handle_seq'::regclass);

ALTER TABLE ONLY public.teams_delivery_item ALTER COLUMN handle SET DEFAULT nextval('public.teams_delivery_item_handle_seq'::regclass);

ALTER TABLE ONLY public.teams_subscription_item ALTER COLUMN handle SET DEFAULT nextval('public.teams_subscription_item_handle_seq'::regclass);

ALTER TABLE ONLY public.teams_template_item ALTER COLUMN handle SET DEFAULT nextval('public.teams_template_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ticket_item ALTER COLUMN handle SET DEFAULT nextval('public.ticket_item_handle_seq'::regclass);

ALTER TABLE ONLY public.ticket_time_tracking_item ALTER COLUMN handle SET DEFAULT nextval('public.ticket_time_tracking_item_handle_seq'::regclass);

ALTER TABLE ONLY public.translation_item ALTER COLUMN handle SET DEFAULT nextval('public.translation_item_handle_seq'::regclass);

ALTER TABLE ONLY public.webhook_authentication_api_key_item ALTER COLUMN handle SET DEFAULT nextval('public.webhook_authentication_api_key_item_handle_seq'::regclass);

ALTER TABLE ONLY public.webhook_authentication_basic_item ALTER COLUMN handle SET DEFAULT nextval('public.webhook_authentication_basic_item_handle_seq'::regclass);

ALTER TABLE ONLY public.webhook_authentication_oauth2item ALTER COLUMN handle SET DEFAULT nextval('public.webhook_authentication_oauth2item_handle_seq'::regclass);

ALTER TABLE ONLY public.webhook_delivery_item ALTER COLUMN handle SET DEFAULT nextval('public.webhook_delivery_item_handle_seq'::regclass);

ALTER TABLE ONLY public.webhook_subscription_item ALTER COLUMN handle SET DEFAULT nextval('public.webhook_subscription_item_handle_seq'::regclass);

ALTER TABLE ONLY public.work_hour_item ALTER COLUMN handle SET DEFAULT nextval('public.work_hour_item_handle_seq'::regclass);

ALTER TABLE ONLY public.work_hour_week_item ALTER COLUMN handle SET DEFAULT nextval('public.work_hour_week_item_handle_seq'::regclass);

ALTER TABLE ONLY public.address_item
    ADD CONSTRAINT address_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.address_type_item
    ADD CONSTRAINT address_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_agent_evaluation_item
    ADD CONSTRAINT ai_agent_evaluation_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_agent_item
    ADD CONSTRAINT ai_agent_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_agent_item_roles
    ADD CONSTRAINT ai_agent_item_roles_pkey PRIMARY KEY (ai_agent_item_handle, role_item_handle);

ALTER TABLE ONLY public.ai_agent_memory_item
    ADD CONSTRAINT ai_agent_memory_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_agent_memory_item_roles
    ADD CONSTRAINT ai_agent_memory_item_roles_pkey PRIMARY KEY (ai_agent_memory_item_handle, role_item_handle);

ALTER TABLE ONLY public.ai_agent_playbook_item
    ADD CONSTRAINT ai_agent_playbook_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_agent_run_item
    ADD CONSTRAINT ai_agent_run_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_agent_version_item
    ADD CONSTRAINT ai_agent_version_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_chat_attachment_item
    ADD CONSTRAINT ai_chat_attachment_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_chat_message_item
    ADD CONSTRAINT ai_chat_message_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_chat_queued_input_item
    ADD CONSTRAINT ai_chat_queued_input_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_chat_session_item
    ADD CONSTRAINT ai_chat_session_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_chat_tool_action_item
    ADD CONSTRAINT ai_chat_tool_action_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_chat_transcription_item
    ADD CONSTRAINT ai_chat_transcription_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_entity_generation_template_item
    ADD CONSTRAINT ai_entity_generation_template_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_prompt_template_item
    ADD CONSTRAINT ai_prompt_template_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_prompt_version_item
    ADD CONSTRAINT ai_prompt_version_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_prompt_version_item
    ADD CONSTRAINT ai_prompt_version_item_template_handle_version_unique UNIQUE (template_handle, version);

ALTER TABLE ONLY public.ai_provider_model_item
    ADD CONSTRAINT ai_provider_model_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_provider_type_item
    ADD CONSTRAINT ai_provider_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_usage_event_item
    ADD CONSTRAINT ai_usage_event_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_usage_event_item
    ADD CONSTRAINT ai_usage_event_item_source_key_unique UNIQUE (source_key);

ALTER TABLE ONLY public.ai_vector_document_item
    ADD CONSTRAINT ai_vector_document_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ai_vector_document_item
    ADD CONSTRAINT ai_vector_document_item_source_entity_handle_sour_09f0c_unique UNIQUE (source_entity_handle, source_record_handle, source_section, chunk_index);

ALTER TABLE ONLY public.authentication_event_item
    ADD CONSTRAINT authentication_event_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.automation_event_item
    ADD CONSTRAINT automation_event_item_event_id_unique UNIQUE (event_id);

ALTER TABLE ONLY public.automation_event_item
    ADD CONSTRAINT automation_event_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.automation_execution_item
    ADD CONSTRAINT automation_execution_item_deduplication_key_unique UNIQUE (deduplication_key);

ALTER TABLE ONLY public.automation_execution_item
    ADD CONSTRAINT automation_execution_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.calendar_sync_subscription_item
    ADD CONSTRAINT calendar_sync_subscription_item_person_handle_unique UNIQUE (person_handle);

ALTER TABLE ONLY public.calendar_sync_subscription_item
    ADD CONSTRAINT calendar_sync_subscription_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.change_log_action_item
    ADD CONSTRAINT change_log_action_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.change_log_detail_item
    ADD CONSTRAINT change_log_detail_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.change_log_item
    ADD CONSTRAINT change_log_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.company_annual_revenue_class_item
    ADD CONSTRAINT company_annual_revenue_class_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.company_churn_risk_reason_item
    ADD CONSTRAINT company_churn_risk_reason_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.company_industry_item
    ADD CONSTRAINT company_industry_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.company_item_automatic_cc_persons
    ADD CONSTRAINT company_item_automatic_cc_persons_pkey PRIMARY KEY (company_item_handle, person_item_handle);

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_name_unique UNIQUE (name);

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.company_relationship_item
    ADD CONSTRAINT company_relationship_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.company_relationship_item
    ADD CONSTRAINT company_relationship_item_source_company_handle_t_92c05_unique UNIQUE (source_company_handle, target_company_handle, type_handle);

ALTER TABLE ONLY public.company_relationship_type_item
    ADD CONSTRAINT company_relationship_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.company_segment_item
    ADD CONSTRAINT company_segment_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.company_size_item
    ADD CONSTRAINT company_size_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.contract_item
    ADD CONSTRAINT contract_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.contract_item_products
    ADD CONSTRAINT contract_item_products_pkey PRIMARY KEY (contract_item_handle, product_item_handle);

ALTER TABLE ONLY public.contract_service_item
    ADD CONSTRAINT contract_service_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.country_item
    ADD CONSTRAINT country_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.custom_field_definition_item
    ADD CONSTRAINT custom_field_definition_item_entity_handle_field_key_unique UNIQUE (entity_handle, field_key);

ALTER TABLE ONLY public.custom_field_definition_item
    ADD CONSTRAINT custom_field_definition_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.custom_field_type_item
    ADD CONSTRAINT custom_field_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.custom_field_value_item
    ADD CONSTRAINT custom_field_value_item_entity_handle_record_refe_5605f_unique UNIQUE (entity_handle, record_reference, definition_handle);

ALTER TABLE ONLY public.custom_field_value_item
    ADD CONSTRAINT custom_field_value_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.dashboard_item_kpis
    ADD CONSTRAINT dashboard_item_kpis_pkey PRIMARY KEY (dashboard_item_handle, kpi_item_handle);

ALTER TABLE ONLY public.dashboard_item
    ADD CONSTRAINT dashboard_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.dashboard_template_item_kpis
    ADD CONSTRAINT dashboard_template_item_kpis_pkey PRIMARY KEY (dashboard_template_item_handle, kpi_item_handle);

ALTER TABLE ONLY public.dashboard_template_item
    ADD CONSTRAINT dashboard_template_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.document_item
    ADD CONSTRAINT document_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.document_type_item
    ADD CONSTRAINT document_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.dvelop_connection_item
    ADD CONSTRAINT dvelop_connection_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.dvelop_entity_mapping_item
    ADD CONSTRAINT dvelop_entity_mapping_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.dvelop_entity_mapping_property_item
    ADD CONSTRAINT dvelop_entity_mapping_property_item_mapping_handl_7a4c6_unique UNIQUE (mapping_handle, property_handle);

ALTER TABLE ONLY public.dvelop_entity_mapping_property_item
    ADD CONSTRAINT dvelop_entity_mapping_property_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.dvelop_entity_mapping_search_category_item
    ADD CONSTRAINT dvelop_entity_mapping_search_category_item_mappin_fec76_unique UNIQUE (mapping_handle, object_definition_handle);

ALTER TABLE ONLY public.dvelop_entity_mapping_search_category_item
    ADD CONSTRAINT dvelop_entity_mapping_search_category_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.dvelop_object_definition_item
    ADD CONSTRAINT dvelop_object_definition_item_connection_handle_d_24dad_unique UNIQUE (connection_handle, dvelop_id);

ALTER TABLE ONLY public.dvelop_object_definition_item
    ADD CONSTRAINT dvelop_object_definition_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.dvelop_property_item
    ADD CONSTRAINT dvelop_property_item_connection_handle_object_def_4cba0_unique UNIQUE (connection_handle, object_definition_handle, dvelop_id);

ALTER TABLE ONLY public.dvelop_property_item
    ADD CONSTRAINT dvelop_property_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.dvelop_repository_item
    ADD CONSTRAINT dvelop_repository_item_connection_handle_dvelop_id_unique UNIQUE (connection_handle, dvelop_id);

ALTER TABLE ONLY public.dvelop_repository_item
    ADD CONSTRAINT dvelop_repository_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.effort_estimate_item
    ADD CONSTRAINT effort_estimate_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.effort_estimate_position_item
    ADD CONSTRAINT effort_estimate_position_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.effort_estimate_position_template_item
    ADD CONSTRAINT effort_estimate_position_template_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.effort_estimate_status_item
    ADD CONSTRAINT effort_estimate_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.email_delivery_item
    ADD CONSTRAINT email_delivery_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.email_delivery_status_item
    ADD CONSTRAINT email_delivery_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.email_inbox_processing_mode_item
    ADD CONSTRAINT email_inbox_processing_mode_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.email_inbox_subscription_item
    ADD CONSTRAINT email_inbox_subscription_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.email_list_item_companies
    ADD CONSTRAINT email_list_item_companies_pkey PRIMARY KEY (email_list_item_handle, company_item_handle);

ALTER TABLE ONLY public.email_list_item_persons
    ADD CONSTRAINT email_list_item_persons_pkey PRIMARY KEY (email_list_item_handle, person_item_handle);

ALTER TABLE ONLY public.email_list_item
    ADD CONSTRAINT email_list_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.email_signature_item
    ADD CONSTRAINT email_signature_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.email_subscription_condition_item
    ADD CONSTRAINT email_subscription_condition_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.email_subscription_item
    ADD CONSTRAINT email_subscription_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.email_template_item
    ADD CONSTRAINT email_template_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.entity_group_item
    ADD CONSTRAINT entity_group_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.entity_item
    ADD CONSTRAINT entity_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.entity_route_item
    ADD CONSTRAINT entity_route_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.event_azure_item
    ADD CONSTRAINT event_azure_item_event_handle_unique UNIQUE (event_handle);

ALTER TABLE ONLY public.event_azure_item
    ADD CONSTRAINT event_azure_item_ical_uid_unique UNIQUE (ical_uid);

ALTER TABLE ONLY public.event_azure_item
    ADD CONSTRAINT event_azure_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.event_category_item
    ADD CONSTRAINT event_category_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.event_delivery_item
    ADD CONSTRAINT event_delivery_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.event_delivery_status_item
    ADD CONSTRAINT event_delivery_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.event_google_item
    ADD CONSTRAINT event_google_item_event_handle_unique UNIQUE (event_handle);

ALTER TABLE ONLY public.event_google_item
    ADD CONSTRAINT event_google_item_ical_uid_unique UNIQUE (ical_uid);

ALTER TABLE ONLY public.event_google_item
    ADD CONSTRAINT event_google_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.event_status_item
    ADD CONSTRAINT event_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.event_type_item
    ADD CONSTRAINT event_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.external_record_link_item
    ADD CONSTRAINT external_record_link_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.external_record_link_item
    ADD CONSTRAINT external_record_link_item_source_handle_entity_ha_fcda9_unique UNIQUE (source_handle, entity_handle, external_key_hash);

ALTER TABLE ONLY public.favorite_item
    ADD CONSTRAINT favorite_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.favorite_template_item
    ADD CONSTRAINT favorite_template_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.field_automation_item
    ADD CONSTRAINT field_automation_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.field_permission_item
    ADD CONSTRAINT field_permission_item_permission_handle_field_name_unique UNIQUE (permission_handle, field_name);

ALTER TABLE ONLY public.field_permission_item
    ADD CONSTRAINT field_permission_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.global_search_index_item
    ADD CONSTRAINT global_search_index_item_entity_handle_record_han_ccb79_unique UNIQUE (entity_handle, record_handle, field_path);

ALTER TABLE ONLY public.global_search_index_item
    ADD CONSTRAINT global_search_index_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.holiday_group_item
    ADD CONSTRAINT holiday_group_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.holiday_item
    ADD CONSTRAINT holiday_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.http_metric_bucket_item
    ADD CONSTRAINT http_metric_bucket_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.import_batch_item
    ADD CONSTRAINT import_batch_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.import_batch_row_item
    ADD CONSTRAINT import_batch_row_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.import_source_item
    ADD CONSTRAINT import_source_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.import_template_item
    ADD CONSTRAINT import_template_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.import_template_value_mapping_item
    ADD CONSTRAINT import_template_value_mapping_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_mailbox_handle_provider_message_id_unique UNIQUE (mailbox_handle, provider_message_id);

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_source_document_handle_unique UNIQUE (source_document_handle);

ALTER TABLE ONLY public.inbound_email_status_item
    ADD CONSTRAINT inbound_email_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.inbox_notification_item
    ADD CONSTRAINT inbox_notification_item_automation_deduplication_key_unique UNIQUE (automation_deduplication_key);

ALTER TABLE ONLY public.inbox_notification_item
    ADD CONSTRAINT inbox_notification_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.inbox_subscription_item
    ADD CONSTRAINT inbox_subscription_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.inbox_template_item
    ADD CONSTRAINT inbox_template_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.information_item
    ADD CONSTRAINT information_item_entity_handle_reference_unique UNIQUE (entity_handle, reference);

ALTER TABLE ONLY public.information_item
    ADD CONSTRAINT information_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.internal_case_category_item
    ADD CONSTRAINT internal_case_category_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.internal_case_status_item
    ADD CONSTRAINT internal_case_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.knowledge_article_category_item
    ADD CONSTRAINT knowledge_article_category_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.knowledge_article_status_item
    ADD CONSTRAINT knowledge_article_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.knowledge_article_visibility_item
    ADD CONSTRAINT knowledge_article_visibility_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.kpi_aggregation_item
    ADD CONSTRAINT kpi_aggregation_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.kpi_item
    ADD CONSTRAINT kpi_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.kpi_timeframe_item
    ADD CONSTRAINT kpi_timeframe_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.kpi_type_item
    ADD CONSTRAINT kpi_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.language_item
    ADD CONSTRAINT language_item_name_unique UNIQUE (name);

ALTER TABLE ONLY public.language_item
    ADD CONSTRAINT language_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.marketing_campaign_item
    ADD CONSTRAINT marketing_campaign_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.marketing_campaign_status_item
    ADD CONSTRAINT marketing_campaign_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.marketing_campaign_type_item
    ADD CONSTRAINT marketing_campaign_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.mcp_server_config_item
    ADD CONSTRAINT mcp_server_config_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.money_item
    ADD CONSTRAINT money_item_name_unique UNIQUE (name);

ALTER TABLE ONLY public.money_item
    ADD CONSTRAINT money_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.note_group_item
    ADD CONSTRAINT note_group_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.note_item
    ADD CONSTRAINT note_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.permission_item
    ADD CONSTRAINT permission_item_entity_handle_role_handle_unique UNIQUE (entity_handle, role_handle);

ALTER TABLE ONLY public.permission_item
    ADD CONSTRAINT permission_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_api_token_item
    ADD CONSTRAINT person_api_token_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_api_token_item
    ADD CONSTRAINT person_api_token_item_token_hash_unique UNIQUE (token_hash);

ALTER TABLE ONLY public.person_decision_role_item
    ADD CONSTRAINT person_decision_role_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_department_item
    ADD CONSTRAINT person_department_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_function_item
    ADD CONSTRAINT person_function_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_item_events
    ADD CONSTRAINT person_item_events_pkey PRIMARY KEY (person_item_handle, event_item_handle);

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_login_name_unique UNIQUE (login_name);

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_item_roles
    ADD CONSTRAINT person_item_roles_pkey PRIMARY KEY (person_item_handle, role_item_handle);

ALTER TABLE ONLY public.person_job_title_item
    ADD CONSTRAINT person_job_title_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_passkey_item
    ADD CONSTRAINT person_passkey_item_credential_id_unique UNIQUE (credential_id);

ALTER TABLE ONLY public.person_passkey_item
    ADD CONSTRAINT person_passkey_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_salutation_item
    ADD CONSTRAINT person_salutation_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_session_item
    ADD CONSTRAINT person_session_item_person_handle_unique UNIQUE (person_handle);

ALTER TABLE ONLY public.person_session_item
    ADD CONSTRAINT person_session_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_title_item
    ADD CONSTRAINT person_title_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.person_type_item
    ADD CONSTRAINT person_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.phone_call_item
    ADD CONSTRAINT phone_call_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.product_item
    ADD CONSTRAINT product_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.role_item
    ADD CONSTRAINT role_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.role_item_starter_dashboard_templates
    ADD CONSTRAINT role_item_starter_dashboard_templates_pkey PRIMARY KEY (role_item_handle, dashboard_template_item_handle);

ALTER TABLE ONLY public.role_item_starter_favorite_templates
    ADD CONSTRAINT role_item_starter_favorite_templates_pkey PRIMARY KEY (role_item_handle, favorite_template_item_handle);

ALTER TABLE ONLY public.role_stage_item
    ADD CONSTRAINT role_stage_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.sales_opportunity_forecast_item
    ADD CONSTRAINT sales_opportunity_forecast_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.sales_opportunity_item_competitors
    ADD CONSTRAINT sales_opportunity_item_competitors_pkey PRIMARY KEY (sales_opportunity_item_handle, company_item_handle);

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.sales_opportunity_loss_reason_item
    ADD CONSTRAINT sales_opportunity_loss_reason_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.sales_opportunity_result_status_item
    ADD CONSTRAINT sales_opportunity_result_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.sales_opportunity_source_item
    ADD CONSTRAINT sales_opportunity_source_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.sales_opportunity_stage_item
    ADD CONSTRAINT sales_opportunity_stage_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.sapling_form_config_item
    ADD CONSTRAINT sapling_form_config_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.script_button_item
    ADD CONSTRAINT script_button_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.seed_script_item
    ADD CONSTRAINT seed_script_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.server_landscape_item
    ADD CONSTRAINT server_landscape_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.server_landscape_type_item
    ADD CONSTRAINT server_landscape_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.server_landscape_type_usage_item
    ADD CONSTRAINT server_landscape_type_usage_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.session_store_item
    ADD CONSTRAINT session_store_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.shared_mailbox_context_item
    ADD CONSTRAINT shared_mailbox_context_item_entity_handle_unique UNIQUE (entity_handle);

ALTER TABLE ONLY public.shared_mailbox_context_item
    ADD CONSTRAINT shared_mailbox_context_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.shared_mailbox_group_item_persons
    ADD CONSTRAINT shared_mailbox_group_item_persons_pkey PRIMARY KEY (shared_mailbox_group_item_handle, person_item_handle);

ALTER TABLE ONLY public.shared_mailbox_group_item
    ADD CONSTRAINT shared_mailbox_group_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.shared_mailbox_item
    ADD CONSTRAINT shared_mailbox_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.sla_policy_item
    ADD CONSTRAINT sla_policy_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.social_media_item
    ADD CONSTRAINT social_media_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.social_media_type_item
    ADD CONSTRAINT social_media_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.support_queue_item
    ADD CONSTRAINT support_queue_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.support_team_item
    ADD CONSTRAINT support_team_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_alert_incident_item
    ADD CONSTRAINT system_alert_incident_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_alert_rule_item
    ADD CONSTRAINT system_alert_rule_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_canary_record_item
    ADD CONSTRAINT system_canary_record_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_check_run_item
    ADD CONSTRAINT system_check_run_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_error_group_item
    ADD CONSTRAINT system_error_group_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_error_occurrence_item
    ADD CONSTRAINT system_error_occurrence_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_metric_bucket_item
    ADD CONSTRAINT system_metric_bucket_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_remediation_execution_item
    ADD CONSTRAINT system_remediation_execution_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_telemetry_environment_item
    ADD CONSTRAINT system_telemetry_environment_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.system_telemetry_instance_item
    ADD CONSTRAINT system_telemetry_instance_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.teams_delivery_item
    ADD CONSTRAINT teams_delivery_item_automation_deduplication_key_unique UNIQUE (automation_deduplication_key);

ALTER TABLE ONLY public.teams_delivery_item
    ADD CONSTRAINT teams_delivery_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.teams_delivery_status_item
    ADD CONSTRAINT teams_delivery_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.teams_subscription_item
    ADD CONSTRAINT teams_subscription_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.teams_template_item
    ADD CONSTRAINT teams_template_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ticket_category_item
    ADD CONSTRAINT ticket_category_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ticket_priority_item
    ADD CONSTRAINT ticket_priority_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ticket_source_item
    ADD CONSTRAINT ticket_source_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ticket_status_item
    ADD CONSTRAINT ticket_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ticket_time_tracking_item
    ADD CONSTRAINT ticket_time_tracking_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.ticket_type_item
    ADD CONSTRAINT ticket_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.translation_item
    ADD CONSTRAINT translation_item_entity_property_language_handle_unique UNIQUE (entity, property, language_handle);

ALTER TABLE ONLY public.translation_item
    ADD CONSTRAINT translation_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_authentication_api_key_item
    ADD CONSTRAINT webhook_authentication_api_key_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_authentication_basic_item
    ADD CONSTRAINT webhook_authentication_basic_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_authentication_oauth2item
    ADD CONSTRAINT webhook_authentication_oauth2item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_authentication_type_item
    ADD CONSTRAINT webhook_authentication_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_delivery_item
    ADD CONSTRAINT webhook_delivery_item_automation_deduplication_key_unique UNIQUE (automation_deduplication_key);

ALTER TABLE ONLY public.webhook_delivery_item
    ADD CONSTRAINT webhook_delivery_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_delivery_status_item
    ADD CONSTRAINT webhook_delivery_status_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_subscription_method_item
    ADD CONSTRAINT webhook_subscription_method_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_subscription_payload_type
    ADD CONSTRAINT webhook_subscription_payload_type_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.webhook_subscription_type_item
    ADD CONSTRAINT webhook_subscription_type_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.work_hour_item
    ADD CONSTRAINT work_hour_item_pkey PRIMARY KEY (handle);

ALTER TABLE ONLY public.work_hour_week_item
    ADD CONSTRAINT work_hour_week_item_pkey PRIMARY KEY (handle);

CREATE INDEX address_item_company_handle_type_handle_index ON public.address_item USING btree (company_handle, type_handle);

CREATE INDEX address_item_country_handle_index ON public.address_item USING btree (country_handle);

CREATE INDEX address_item_type_handle_index ON public.address_item USING btree (type_handle);

CREATE INDEX ai_agent_evaluation_item_agent_handle_index ON public.ai_agent_evaluation_item USING btree (agent_handle);

CREATE INDEX ai_agent_evaluation_item_agent_version_handle_index ON public.ai_agent_evaluation_item USING btree (agent_version_handle);

CREATE INDEX ai_agent_item_model_handle_index ON public.ai_agent_item USING btree (model_handle);

CREATE INDEX ai_agent_item_provider_handle_index ON public.ai_agent_item USING btree (provider_handle);

CREATE INDEX ai_agent_item_roles_role_item_handle_index ON public.ai_agent_item_roles USING btree (role_item_handle);

CREATE INDEX ai_agent_memory_item_agent_handle_index ON public.ai_agent_memory_item USING btree (agent_handle);

CREATE INDEX ai_agent_memory_item_roles_role_item_handle_index ON public.ai_agent_memory_item_roles USING btree (role_item_handle);

CREATE INDEX ai_agent_playbook_item_agent_handle_index ON public.ai_agent_playbook_item USING btree (agent_handle);

CREATE INDEX ai_agent_run_item_agent_handle_index ON public.ai_agent_run_item USING btree (agent_handle);

CREATE INDEX ai_agent_run_item_agent_version_handle_index ON public.ai_agent_run_item USING btree (agent_version_handle);

CREATE INDEX ai_agent_run_item_message_handle_index ON public.ai_agent_run_item USING btree (message_handle);

CREATE INDEX ai_agent_run_item_person_handle_started_at_index ON public.ai_agent_run_item USING btree (person_handle, started_at);

CREATE INDEX ai_agent_run_item_playbook_handle_index ON public.ai_agent_run_item USING btree (playbook_handle);

CREATE INDEX ai_agent_run_item_session_handle_started_at_index ON public.ai_agent_run_item USING btree (session_handle, started_at);

CREATE INDEX ai_agent_version_item_agent_handle_index ON public.ai_agent_version_item USING btree (agent_handle);

CREATE INDEX ai_agent_version_item_model_handle_index ON public.ai_agent_version_item USING btree (model_handle);

CREATE INDEX ai_agent_version_item_provider_handle_index ON public.ai_agent_version_item USING btree (provider_handle);

CREATE INDEX ai_chat_attachment_item_document_handle_index ON public.ai_chat_attachment_item USING btree (document_handle);

CREATE INDEX ai_chat_attachment_item_import_batch_handle_index ON public.ai_chat_attachment_item USING btree (import_batch_handle);

CREATE INDEX ai_chat_attachment_item_message_handle_index ON public.ai_chat_attachment_item USING btree (message_handle);

CREATE INDEX ai_chat_attachment_item_person_handle_index ON public.ai_chat_attachment_item USING btree (person_handle);

CREATE INDEX ai_chat_attachment_item_session_handle_handle_index ON public.ai_chat_attachment_item USING btree (session_handle, handle);

CREATE INDEX ai_chat_message_item_person_handle_index ON public.ai_chat_message_item USING btree (person_handle);

CREATE INDEX ai_chat_message_item_session_handle_sequence_index ON public.ai_chat_message_item USING btree (session_handle, sequence);

CREATE INDEX ai_chat_queued_input_item_session_handle_status_mo_348f2_index ON public.ai_chat_queued_input_item USING btree (session_handle, status, mode, created_at);

CREATE INDEX ai_chat_session_context_entity_context_record_updated_at_index ON public.ai_chat_session_item USING btree (context_entity_handle, context_record_handle, updated_at);

CREATE INDEX ai_chat_session_item_agent_handle_index ON public.ai_chat_session_item USING btree (agent_handle);

CREATE INDEX ai_chat_session_item_agent_version_handle_index ON public.ai_chat_session_item USING btree (agent_version_handle);

CREATE INDEX ai_chat_session_item_model_handle_index ON public.ai_chat_session_item USING btree (model_handle);

CREATE INDEX ai_chat_session_item_playbook_handle_index ON public.ai_chat_session_item USING btree (playbook_handle);

CREATE INDEX ai_chat_session_item_provider_handle_index ON public.ai_chat_session_item USING btree (provider_handle);

CREATE INDEX ai_chat_session_item_response_status_index ON public.ai_chat_session_item USING btree (response_status);

CREATE INDEX ai_chat_session_prs_is_archived_updated_at_index ON public.ai_chat_session_item USING btree (person_handle, is_archived, updated_at);

CREATE INDEX ai_chat_tool_action_item_agent_handle_index ON public.ai_chat_tool_action_item USING btree (agent_handle);

CREATE INDEX ai_chat_tool_action_item_message_handle_index ON public.ai_chat_tool_action_item USING btree (message_handle);

CREATE INDEX ai_chat_tool_action_item_person_handle_index ON public.ai_chat_tool_action_item USING btree (person_handle);

CREATE INDEX ai_chat_tool_action_item_session_handle_created_at_index ON public.ai_chat_tool_action_item USING btree (session_handle, created_at);

CREATE INDEX ai_chat_transcription_item_document_handle_index ON public.ai_chat_transcription_item USING btree (document_handle);

CREATE INDEX ai_chat_transcription_item_message_handle_index ON public.ai_chat_transcription_item USING btree (message_handle);

CREATE INDEX ai_chat_transcription_item_model_handle_index ON public.ai_chat_transcription_item USING btree (model_handle);

CREATE INDEX ai_chat_transcription_item_person_handle_index ON public.ai_chat_transcription_item USING btree (person_handle);

CREATE INDEX ai_chat_transcription_item_provider_handle_index ON public.ai_chat_transcription_item USING btree (provider_handle);

CREATE INDEX ai_chat_transcription_item_session_handle_index ON public.ai_chat_transcription_item USING btree (session_handle);

CREATE INDEX ai_entity_generation_template_item_model_handle_index ON public.ai_entity_generation_template_item USING btree (model_handle);

CREATE INDEX ai_entity_generation_template_item_provider_handle_index ON public.ai_entity_generation_template_item USING btree (provider_handle);

CREATE INDEX ai_entity_generation_template_item_source_entity_handle_index ON public.ai_entity_generation_template_item USING btree (source_entity_handle);

CREATE INDEX ai_entity_generation_template_item_target_entity_handle_index ON public.ai_entity_generation_template_item USING btree (target_entity_handle);

CREATE INDEX ai_provider_model_item_provider_handle_index ON public.ai_provider_model_item USING btree (provider_handle);

CREATE INDEX ai_usage_event_environment_time_idx ON public.ai_usage_event_item USING btree (environment_handle, occurred_at);

CREATE INDEX ai_usage_event_item_occurred_at_index ON public.ai_usage_event_item USING btree (occurred_at);

CREATE INDEX ai_usage_event_item_occurred_at_person_handle_index ON public.ai_usage_event_item USING btree (occurred_at, person_handle);

CREATE INDEX ai_usage_event_item_provider_model_occurred_at_index ON public.ai_usage_event_item USING btree (provider, model, occurred_at);

CREATE INDEX ai_usage_event_occurred_at_idx ON public.ai_usage_event_item USING btree (occurred_at);

CREATE INDEX ai_usage_event_person_time_idx ON public.ai_usage_event_item USING btree (person_handle, occurred_at);

CREATE INDEX ai_vector_document_provider_model_updated_at_index ON public.ai_vector_document_item USING btree (provider_handle, model_handle, updated_at);

CREATE INDEX ai_vector_document_source_entity_source_record_updated_idx ON public.ai_vector_document_item USING btree (source_entity_handle, source_record_handle, updated_at);

CREATE INDEX authentication_event_environment_time_idx ON public.authentication_event_item USING btree (environment_handle, occurred_at);

CREATE INDEX authentication_event_item_occurred_at_index ON public.authentication_event_item USING btree (occurred_at);

CREATE INDEX authentication_event_item_person_handle_occurred_at_index ON public.authentication_event_item USING btree (person_handle, occurred_at);

CREATE INDEX authentication_event_type_time_idx ON public.authentication_event_item USING btree (event_type, occurred_at);

CREATE INDEX automation_event_item_pending_idx ON public.automation_event_item USING btree (status, handle);

CREATE INDEX calendar_sync_subscription_item_default_event_category_handle_i ON public.calendar_sync_subscription_item USING btree (default_event_category_handle);

CREATE INDEX calendar_sync_subscription_item_default_event_type_handle_index ON public.calendar_sync_subscription_item USING btree (default_event_type_handle);

CREATE INDEX calendar_sync_subscription_item_is_active_last_run_at_index ON public.calendar_sync_subscription_item USING btree (is_active, last_run_at);

CREATE INDEX change_log_detail_item_log_handle_index ON public.change_log_detail_item USING btree (log_handle);

CREATE INDEX change_log_entity_reference_created_at_index ON public.change_log_item USING btree (entity_handle, reference, created_at, handle);

CREATE INDEX change_log_item_action_handle_index ON public.change_log_item USING btree (action_handle);

CREATE INDEX change_log_item_person_handle_created_at_index ON public.change_log_item USING btree (person_handle, created_at);

CREATE INDEX company_item_account_manager_handle_updated_at_index ON public.company_item USING btree (account_manager_handle, updated_at);

CREATE INDEX company_item_annual_revenue_class_handle_index ON public.company_item USING btree (annual_revenue_class_handle);

CREATE INDEX company_item_churn_risk_reason_handle_index ON public.company_item USING btree (churn_risk_reason_handle);

CREATE INDEX company_item_country_handle_index ON public.company_item USING btree (country_handle);

CREATE INDEX company_item_customer_success_manager_handle_updated_at_index ON public.company_item USING btree (customer_success_manager_handle, updated_at);

CREATE INDEX company_item_holiday_group_handle_index ON public.company_item USING btree (holiday_group_handle);

CREATE INDEX company_item_industry_handle_index ON public.company_item USING btree (industry_handle);

CREATE INDEX company_item_segment_handle_index ON public.company_item USING btree (segment_handle);

CREATE INDEX company_item_service_provider_handle_index ON public.company_item USING btree (service_provider_handle);

CREATE INDEX company_item_size_handle_index ON public.company_item USING btree (size_handle);

CREATE INDEX company_item_work_week_handle_index ON public.company_item USING btree (work_week_handle);

CREATE INDEX company_relationship_item_target_company_handle_index ON public.company_relationship_item USING btree (target_company_handle);

CREATE INDEX company_relationship_item_type_handle_index ON public.company_relationship_item USING btree (type_handle);

CREATE INDEX contract_item_company_handle_end_date_index ON public.contract_item USING btree (company_handle, end_date);

CREATE INDEX contract_item_default_support_queue_handle_index ON public.contract_item USING btree (default_support_queue_handle);

CREATE INDEX contract_item_default_support_team_handle_index ON public.contract_item USING btree (default_support_team_handle);

CREATE INDEX contract_item_products_product_item_handle_index ON public.contract_item_products USING btree (product_item_handle);

CREATE INDEX contract_item_service_level_handle_index ON public.contract_item USING btree (service_level_handle);

CREATE INDEX contract_item_sla_policy_handle_index ON public.contract_item USING btree (sla_policy_handle);

CREATE INDEX country_item_language_handle_index ON public.country_item USING btree (language_handle);

CREATE INDEX country_item_money_handle_index ON public.country_item USING btree (money_handle);

CREATE INDEX custom_field_definition_entity_active_order_key_index ON public.custom_field_definition_item USING btree (entity_handle, is_active, field_order, field_key);

CREATE INDEX custom_field_definition_item_field_type_handle_index ON public.custom_field_definition_item USING btree (field_type_handle);

CREATE INDEX custom_field_value_definition_record_reference_index ON public.custom_field_value_item USING btree (definition_handle, record_reference);

CREATE INDEX custom_field_value_item_boolean_filter_index ON public.custom_field_value_item USING btree (entity_handle, definition_handle, value_boolean);

CREATE INDEX custom_field_value_item_date_filter_index ON public.custom_field_value_item USING btree (entity_handle, definition_handle, value_date);

CREATE INDEX custom_field_value_item_datetime_filter_index ON public.custom_field_value_item USING btree (entity_handle, definition_handle, value_date_time);

CREATE INDEX custom_field_value_item_number_filter_index ON public.custom_field_value_item USING btree (entity_handle, definition_handle, value_number);

CREATE INDEX custom_field_value_item_string_filter_index ON public.custom_field_value_item USING btree (entity_handle, definition_handle, value_string);

CREATE INDEX dashboard_item_kpis_kpi_item_handle_index ON public.dashboard_item_kpis USING btree (kpi_item_handle);

CREATE INDEX dashboard_item_person_handle_updated_at_index ON public.dashboard_item USING btree (person_handle, updated_at);

CREATE INDEX dashboard_item_person_sort_order_index ON public.dashboard_item USING btree (person_handle, sort_order, handle);

CREATE INDEX dashboard_template_item_kpis_kpi_item_handle_index ON public.dashboard_template_item_kpis USING btree (kpi_item_handle);

CREATE INDEX dashboard_template_item_person_handle_index ON public.dashboard_template_item USING btree (person_handle);

CREATE INDEX document_item_entity_handle_reference_created_at_index ON public.document_item USING btree (entity_handle, reference, created_at);

CREATE INDEX document_item_person_handle_index ON public.document_item USING btree (person_handle);

CREATE INDEX document_item_type_handle_index ON public.document_item USING btree (type_handle);

CREATE INDEX dvelop_connection_item_default_object_definition_handle_index ON public.dvelop_connection_item USING btree (default_object_definition_handle);

CREATE INDEX dvelop_connection_item_repository_handle_index ON public.dvelop_connection_item USING btree (repository_handle);

CREATE INDEX dvelop_entity_mapping_item_connection_handle_index ON public.dvelop_entity_mapping_item USING btree (connection_handle);

CREATE INDEX dvelop_entity_mapping_item_entity_handle_index ON public.dvelop_entity_mapping_item USING btree (entity_handle);

CREATE INDEX dvelop_entity_mapping_item_object_definition_handle_index ON public.dvelop_entity_mapping_item USING btree (object_definition_handle);

CREATE INDEX dvelop_entity_mapping_property_item_mapping_handle_index ON public.dvelop_entity_mapping_property_item USING btree (mapping_handle);

CREATE INDEX dvelop_entity_mapping_property_item_property_handle_index ON public.dvelop_entity_mapping_property_item USING btree (property_handle);

CREATE INDEX dvelop_entity_mapping_search_category_item_mapping_handle_index ON public.dvelop_entity_mapping_search_category_item USING btree (mapping_handle);

CREATE INDEX dvelop_entity_mapping_search_category_item_object_definition_ha ON public.dvelop_entity_mapping_search_category_item USING btree (object_definition_handle);

CREATE INDEX dvelop_object_definition_item_connection_handle_index ON public.dvelop_object_definition_item USING btree (connection_handle);

CREATE INDEX dvelop_property_item_connection_handle_index ON public.dvelop_property_item USING btree (connection_handle);

CREATE INDEX dvelop_property_item_object_definition_handle_index ON public.dvelop_property_item USING btree (object_definition_handle);

CREATE INDEX dvelop_repository_item_connection_handle_index ON public.dvelop_repository_item USING btree (connection_handle);

CREATE INDEX effort_est_assignee_prs_is_active_status_index ON public.effort_estimate_item USING btree (assignee_person_handle, is_active, status_handle);

CREATE INDEX effort_estimate_item_assignee_company_handle_index ON public.effort_estimate_item USING btree (assignee_company_handle);

CREATE INDEX effort_estimate_item_creator_company_handle_index ON public.effort_estimate_item USING btree (creator_company_handle);

CREATE INDEX effort_estimate_item_creator_person_handle_index ON public.effort_estimate_item USING btree (creator_person_handle);

CREATE INDEX effort_estimate_item_sales_opportunity_handle_updated_at_index ON public.effort_estimate_item USING btree (sales_opportunity_handle, updated_at);

CREATE INDEX effort_estimate_item_status_handle_index ON public.effort_estimate_item USING btree (status_handle);

CREATE INDEX effort_estimate_item_ticket_handle_updated_at_index ON public.effort_estimate_item USING btree (ticket_handle, updated_at);

CREATE INDEX effort_estimate_position_item_estimate_handle_index ON public.effort_estimate_position_item USING btree (estimate_handle);

CREATE INDEX effort_estimate_position_item_template_handle_index ON public.effort_estimate_position_item USING btree (template_handle);

CREATE UNIQUE INDEX email_delivery_item_automation_deduplication_key_unique ON public.email_delivery_item USING btree (automation_deduplication_key);

CREATE INDEX email_delivery_item_created_by_handle_index ON public.email_delivery_item USING btree (created_by_handle);

CREATE INDEX email_delivery_item_customer_company_handle_index ON public.email_delivery_item USING btree (customer_company_handle);

CREATE INDEX email_delivery_item_customer_person_handle_index ON public.email_delivery_item USING btree (customer_person_handle);

CREATE INDEX email_delivery_item_entity_handle_index ON public.email_delivery_item USING btree (entity_handle);

CREATE INDEX email_delivery_item_status_handle_next_retry_at_index ON public.email_delivery_item USING btree (status_handle, next_retry_at);

CREATE INDEX email_delivery_item_subscription_handle_index ON public.email_delivery_item USING btree (subscription_handle);

CREATE INDEX email_delivery_item_template_handle_index ON public.email_delivery_item USING btree (template_handle);

CREATE INDEX email_inbox_subscription_due_index ON public.email_inbox_subscription_item USING btree (is_active, last_run_at);

CREATE INDEX email_inbox_subscription_mailbox_index ON public.email_inbox_subscription_item USING btree (mailbox_handle);

CREATE INDEX email_inbox_subscription_person_index ON public.email_inbox_subscription_item USING btree (processing_person_handle);

CREATE INDEX email_list_item_companies_company_item_handle_index ON public.email_list_item_companies USING btree (company_item_handle);

CREATE INDEX email_list_item_mail_template_handle_index ON public.email_list_item USING btree (mail_template_handle);

CREATE INDEX email_list_item_persons_person_item_handle_index ON public.email_list_item_persons USING btree (person_item_handle);

CREATE INDEX email_signature_rotation_idx ON public.email_signature_item USING btree (person_handle, is_active, use_in_rotation, last_used_at, handle);

CREATE INDEX email_subscription_condition_item_subscription_handle_index ON public.email_subscription_condition_item USING btree (subscription_handle);

CREATE INDEX email_subscription_item_entity_handle_index ON public.email_subscription_item USING btree (entity_handle);

CREATE INDEX email_subscription_item_sender_mailbox_handle_index ON public.email_subscription_item USING btree (sender_mailbox_handle);

CREATE INDEX email_subscription_item_sender_person_handle_index ON public.email_subscription_item USING btree (sender_person_handle);

CREATE INDEX email_subscription_item_template_handle_index ON public.email_subscription_item USING btree (template_handle);

CREATE INDEX email_subscription_item_type_handle_index ON public.email_subscription_item USING btree (type_handle);

CREATE INDEX email_template_item_entity_handle_index ON public.email_template_item USING btree (entity_handle);

CREATE INDEX entity_group_item_parent_handle_index ON public.entity_group_item USING btree (parent_handle);

CREATE INDEX entity_item_group_handle_sort_order_handle_index ON public.entity_item USING btree (group_handle, sort_order, handle);

CREATE INDEX entity_route_item_entity_handle_route_index ON public.entity_route_item USING btree (entity_handle, route);

CREATE INDEX entity_route_item_group_handle_index ON public.entity_route_item USING btree (group_handle);

CREATE INDEX event_assignee_prs_status_start_date_index ON public.event_item USING btree (assignee_person_handle, status_handle, start_date);

CREATE INDEX event_delivery_item_event_handle_index ON public.event_delivery_item USING btree (event_handle);

CREATE INDEX event_delivery_item_status_handle_event_handle_index ON public.event_delivery_item USING btree (status_handle, event_handle);

CREATE INDEX event_item_assignee_company_handle_index ON public.event_item USING btree (assignee_company_handle);

CREATE INDEX event_item_category_handle_index ON public.event_item USING btree (category_handle);

CREATE INDEX event_item_created_at_index ON public.event_item USING btree (created_at);

CREATE INDEX event_item_creator_company_handle_index ON public.event_item USING btree (creator_company_handle);

CREATE INDEX event_item_creator_person_handle_index ON public.event_item USING btree (creator_person_handle);

CREATE INDEX event_item_effort_estimate_handle_index ON public.event_item USING btree (effort_estimate_handle);

CREATE INDEX event_item_end_date_index ON public.event_item USING btree (end_date);

CREATE INDEX event_item_internal_case_handle_index ON public.event_item USING btree (internal_case_handle);

CREATE INDEX event_item_private_creator_index ON public.event_item USING btree (is_private, creator_person_handle);

CREATE INDEX event_item_sales_opportunity_handle_start_date_index ON public.event_item USING btree (sales_opportunity_handle, start_date);

CREATE INDEX event_item_start_date_index ON public.event_item USING btree (start_date);

CREATE INDEX event_item_status_handle_start_date_end_date_index ON public.event_item USING btree (status_handle, start_date, end_date);

CREATE INDEX event_item_ticket_handle_start_date_index ON public.event_item USING btree (ticket_handle, start_date);

CREATE INDEX event_item_type_handle_index ON public.event_item USING btree (type_handle);

CREATE INDEX event_item_updated_at_index ON public.event_item USING btree (updated_at);

CREATE INDEX external_record_link_entity_external_key_hash_index ON public.external_record_link_item USING btree (entity_handle, external_key_hash);

CREATE INDEX external_record_link_item_entity_reference_index ON public.external_record_link_item USING btree (entity_handle, reference);

CREATE INDEX external_record_link_item_first_import_batch_handle_index ON public.external_record_link_item USING btree (first_import_batch_handle);

CREATE INDEX external_record_link_item_last_import_batch_handle_index ON public.external_record_link_item USING btree (last_import_batch_handle);

CREATE INDEX favorite_item_entity_handle_index ON public.favorite_item USING btree (entity_handle);

CREATE INDEX favorite_item_entity_route_handle_index ON public.favorite_item USING btree (entity_route_handle);

CREATE INDEX favorite_item_person_handle_entity_handle_index ON public.favorite_item USING btree (person_handle, entity_handle);

CREATE INDEX favorite_template_item_entity_handle_index ON public.favorite_template_item USING btree (entity_handle);

CREATE INDEX favorite_template_item_entity_route_handle_index ON public.favorite_template_item USING btree (entity_route_handle);

CREATE INDEX field_permission_item_permission_handle_index ON public.field_permission_item USING btree (permission_handle);

CREATE INDEX global_search_index_item_scope_idx ON public.global_search_index_item USING btree (entity_handle, field_path);

CREATE INDEX global_search_index_item_value_trgm_idx ON public.global_search_index_item USING gin (normalized_value public.gin_trgm_ops);

CREATE INDEX holiday_item_group_handle_index ON public.holiday_item USING btree (group_handle);

CREATE INDEX http_metric_bucket_item_bucket_start_index ON public.http_metric_bucket_item USING btree (bucket_start);

CREATE INDEX http_metric_bucket_item_bucket_start_person_handle_index ON public.http_metric_bucket_item USING btree (bucket_start, person_handle);

CREATE INDEX http_metric_bucket_person_idx ON public.http_metric_bucket_item USING btree (person_handle, bucket_start);

CREATE INDEX http_metric_bucket_person_resolution_time_idx ON public.http_metric_bucket_item USING btree (person_handle, resolution, bucket_start);

CREATE INDEX http_metric_bucket_resolution_time_idx ON public.http_metric_bucket_item USING btree (resolution, bucket_start);

CREATE UNIQUE INDEX http_metric_bucket_unique ON public.http_metric_bucket_item USING btree (environment_handle, bucket_start, resolution, attribution_key, route_group, operation, request_kind, resource_key, auth_kind);

CREATE INDEX import_batch_item_created_by_handle_index ON public.import_batch_item USING btree (created_by_handle);

CREATE INDEX import_batch_item_import_template_handle_index ON public.import_batch_item USING btree (import_template_handle);

CREATE INDEX import_batch_item_source_handle_index ON public.import_batch_item USING btree (source_handle);

CREATE INDEX import_batch_item_target_entity_handle_updated_at_index ON public.import_batch_item USING btree (target_entity_handle, updated_at);

CREATE INDEX import_batch_row_item_batch_handle_row_number_index ON public.import_batch_row_item USING btree (batch_handle, row_number);

CREATE INDEX import_batch_row_item_batch_handle_status_index ON public.import_batch_row_item USING btree (batch_handle, status);

CREATE INDEX import_template_item_source_handle_index ON public.import_template_item USING btree (source_handle);

CREATE INDEX import_template_item_target_entity_handle_index ON public.import_template_item USING btree (target_entity_handle);

CREATE INDEX import_template_value_mapping_item_import_template_handle_index ON public.import_template_value_mapping_item USING btree (import_template_handle);

CREATE INDEX inbound_email_company_received_index ON public.inbound_email_item USING btree (company_handle, received_at);

CREATE INDEX inbound_email_conversation_index ON public.inbound_email_item USING btree (provider, conversation_id);

CREATE INDEX inbound_email_office_task_received_index ON public.inbound_email_item USING btree (office_task_handle, received_at);

CREATE INDEX inbound_email_person_received_index ON public.inbound_email_item USING btree (person_handle, received_at);

CREATE INDEX inbound_email_sales_opportunity_received_index ON public.inbound_email_item USING btree (sales_opportunity_handle, received_at);

CREATE INDEX inbound_email_status_received_index ON public.inbound_email_item USING btree (status_handle, received_at);

CREATE INDEX inbound_email_subscription_received_index ON public.inbound_email_item USING btree (subscription_handle, received_at);

CREATE INDEX inbound_email_ticket_received_index ON public.inbound_email_item USING btree (ticket_handle, received_at);

CREATE INDEX inbox_notif_recipient_prs_is_read_created_at_index ON public.inbox_notification_item USING btree (recipient_person_handle, is_read, created_at, handle);

CREATE INDEX inbox_notification_item_created_by_handle_index ON public.inbox_notification_item USING btree (created_by_handle);

CREATE INDEX inbox_notification_item_entity_handle_reference_handle_index ON public.inbox_notification_item USING btree (entity_handle, reference_handle);

CREATE INDEX inbox_notification_item_subscription_handle_index ON public.inbox_notification_item USING btree (subscription_handle);

CREATE INDEX inbox_notification_item_template_handle_index ON public.inbox_notification_item USING btree (template_handle);

CREATE INDEX inbox_subscription_item_entity_handle_index ON public.inbox_subscription_item USING btree (entity_handle);

CREATE INDEX inbox_subscription_item_template_handle_index ON public.inbox_subscription_item USING btree (template_handle);

CREATE INDEX inbox_subscription_item_type_handle_index ON public.inbox_subscription_item USING btree (type_handle);

CREATE INDEX inbox_template_item_entity_handle_index ON public.inbox_template_item USING btree (entity_handle);

CREATE INDEX information_item_person_handle_index ON public.information_item USING btree (person_handle);

CREATE INDEX internal_case_item_category_handle_index ON public.internal_case_item USING btree (category_handle);

CREATE INDEX internal_case_item_customer_company_handle_updated_at_index ON public.internal_case_item USING btree (customer_company_handle, updated_at);

CREATE INDEX internal_case_item_customer_person_handle_updated_at_index ON public.internal_case_item USING btree (customer_person_handle, updated_at);

CREATE INDEX internal_case_item_effort_estimate_handle_index ON public.internal_case_item USING btree (effort_estimate_handle);

CREATE INDEX internal_case_item_responsible_company_handle_index ON public.internal_case_item USING btree (responsible_company_handle);

CREATE INDEX internal_case_item_sales_opportunity_handle_updated_at_index ON public.internal_case_item USING btree (sales_opportunity_handle, updated_at);

CREATE INDEX internal_case_item_status_handle_index ON public.internal_case_item USING btree (status_handle);

CREATE INDEX internal_case_item_ticket_handle_updated_at_index ON public.internal_case_item USING btree (ticket_handle, updated_at);

CREATE INDEX internal_case_responsible_prs_status_index ON public.internal_case_item USING btree (responsible_person_handle, status_handle);

CREATE INDEX knowledge_article_item_author_person_handle_index ON public.knowledge_article_item USING btree (author_person_handle);

CREATE INDEX knowledge_article_item_category_handle_index ON public.knowledge_article_item USING btree (category_handle);

CREATE INDEX knowledge_article_item_product_handle_updated_at_index ON public.knowledge_article_item USING btree (product_handle, updated_at);

CREATE INDEX knowledge_article_item_reviewer_person_handle_index ON public.knowledge_article_item USING btree (reviewer_person_handle);

CREATE INDEX knowledge_article_item_source_effort_estimate_handle_index ON public.knowledge_article_item USING btree (source_effort_estimate_handle);

CREATE INDEX knowledge_article_item_source_sales_opportunity_handle_index ON public.knowledge_article_item USING btree (source_sales_opportunity_handle);

CREATE INDEX knowledge_article_item_source_ticket_handle_index ON public.knowledge_article_item USING btree (source_ticket_handle);

CREATE INDEX knowledge_article_item_status_handle_updated_at_index ON public.knowledge_article_item USING btree (status_handle, updated_at);

CREATE INDEX knowledge_article_item_visibility_handle_index ON public.knowledge_article_item USING btree (visibility_handle);

CREATE INDEX kpi_item_aggregation_handle_index ON public.kpi_item USING btree (aggregation_handle);

CREATE INDEX kpi_item_relation_handle_index ON public.kpi_item USING btree (relation_handle);

CREATE INDEX kpi_item_target_entity_handle_type_handle_index ON public.kpi_item USING btree (target_entity_handle, type_handle);

CREATE INDEX kpi_item_timeframe_handle_timeframe_interval_handle_index ON public.kpi_item USING btree (timeframe_handle, timeframe_interval_handle);

CREATE INDEX kpi_item_timeframe_interval_handle_index ON public.kpi_item USING btree (timeframe_interval_handle);

CREATE INDEX kpi_item_type_handle_index ON public.kpi_item USING btree (type_handle);

CREATE INDEX marketing_campaign_item_email_template_handle_index ON public.marketing_campaign_item USING btree (email_template_handle);

CREATE INDEX marketing_campaign_item_opportunity_source_handle_index ON public.marketing_campaign_item USING btree (opportunity_source_handle);

CREATE INDEX marketing_campaign_item_status_handle_index ON public.marketing_campaign_item USING btree (status_handle);

CREATE INDEX marketing_campaign_item_target_list_handle_index ON public.marketing_campaign_item USING btree (target_list_handle);

CREATE INDEX marketing_campaign_item_type_handle_index ON public.marketing_campaign_item USING btree (type_handle);

CREATE INDEX marketing_campaign_owner_prs_status_index ON public.marketing_campaign_item USING btree (owner_person_handle, status_handle);

CREATE INDEX note_item_group_handle_index ON public.note_item USING btree (group_handle);

CREATE INDEX note_item_person_handle_updated_at_index ON public.note_item USING btree (person_handle, updated_at);

CREATE INDEX permission_item_role_handle_index ON public.permission_item USING btree (role_handle);

CREATE INDEX person_api_token_item_person_handle_index ON public.person_api_token_item USING btree (person_handle);

CREATE INDEX person_item_company_handle_updated_at_index ON public.person_item USING btree (company_handle, updated_at);

CREATE INDEX person_item_decision_role_handle_index ON public.person_item USING btree (decision_role_handle);

CREATE INDEX person_item_department_handle_index ON public.person_item USING btree (department_handle);

CREATE INDEX person_item_events_event_item_handle_index ON public.person_item_events USING btree (event_item_handle);

CREATE INDEX person_item_holiday_group_handle_index ON public.person_item USING btree (holiday_group_handle);

CREATE INDEX person_item_job_function_handle_index ON public.person_item USING btree (job_function_handle);

CREATE INDEX person_item_job_title_handle_index ON public.person_item USING btree (job_title_handle);

CREATE INDEX person_item_language_handle_index ON public.person_item USING btree (language_handle);

CREATE INDEX person_item_roles_role_item_handle_index ON public.person_item_roles USING btree (role_item_handle);

CREATE INDEX person_item_salutation_handle_index ON public.person_item USING btree (salutation_handle);

CREATE INDEX person_item_title_handle_index ON public.person_item USING btree (title_handle);

CREATE INDEX person_item_type_handle_index ON public.person_item USING btree (type_handle);

CREATE INDEX person_item_work_week_handle_index ON public.person_item USING btree (work_week_handle);

CREATE INDEX person_passkey_item_person_handle_index ON public.person_passkey_item USING btree (person_handle);

CREATE INDEX person_session_item_person_handle_updated_at_index ON public.person_session_item USING btree (person_handle, updated_at);

CREATE INDEX phone_call_item_entity_handle_reference_created_at_index ON public.phone_call_item USING btree (entity_handle, reference, created_at);

CREATE INDEX phone_call_item_person_handle_index ON public.phone_call_item USING btree (person_handle);

CREATE INDEX role_item_stage_handle_index ON public.role_item USING btree (stage_handle);

CREATE INDEX role_item_starter_dashboard_templates_dashboard_te_32fca_index ON public.role_item_starter_dashboard_templates USING btree (dashboard_template_item_handle);

CREATE INDEX role_item_starter_favorite_templates_favorite_temp_50784_index ON public.role_item_starter_favorite_templates USING btree (favorite_template_item_handle);

CREATE INDEX sales_opp_assignee_prs_is_active_type_index ON public.sales_opportunity_item USING btree (assignee_person_handle, is_active, type_handle);

CREATE INDEX sales_opportunity_item_assignee_company_handle_index ON public.sales_opportunity_item USING btree (assignee_company_handle);

CREATE INDEX sales_opportunity_item_close_date_index ON public.sales_opportunity_item USING btree (close_date);

CREATE INDEX sales_opportunity_item_competitors_company_item_handle_index ON public.sales_opportunity_item_competitors USING btree (company_item_handle);

CREATE INDEX sales_opportunity_item_created_at_index ON public.sales_opportunity_item USING btree (created_at);

CREATE INDEX sales_opportunity_item_creator_company_handle_updated_at_index ON public.sales_opportunity_item USING btree (creator_company_handle, updated_at);

CREATE INDEX sales_opportunity_item_creator_person_handle_index ON public.sales_opportunity_item USING btree (creator_person_handle);

CREATE INDEX sales_opportunity_item_forecast_handle_index ON public.sales_opportunity_item USING btree (forecast_handle);

CREATE INDEX sales_opportunity_item_is_active_index ON public.sales_opportunity_item USING btree (is_active);

CREATE INDEX sales_opportunity_item_loss_reason_handle_index ON public.sales_opportunity_item USING btree (loss_reason_handle);

CREATE INDEX sales_opportunity_item_result_status_handle_index ON public.sales_opportunity_item USING btree (result_status_handle);

CREATE INDEX sales_opportunity_item_source_handle_index ON public.sales_opportunity_item USING btree (source_handle);

CREATE INDEX sales_opportunity_item_type_handle_index ON public.sales_opportunity_item USING btree (type_handle);

CREATE INDEX sales_opportunity_item_updated_at_index ON public.sales_opportunity_item USING btree (updated_at);

CREATE INDEX sapling_form_config_entity_prs_scope_is_default_index ON public.sapling_form_config_item USING btree (entity_handle, person_handle, scope, is_default);

CREATE INDEX sapling_form_config_item_person_handle_index ON public.sapling_form_config_item USING btree (person_handle);

CREATE INDEX script_button_item_entity_handle_index ON public.script_button_item USING btree (entity_handle);

CREATE INDEX server_landscape_item_company_handle_index ON public.server_landscape_item USING btree (company_handle);

CREATE INDEX server_landscape_item_type_handle_index ON public.server_landscape_item USING btree (type_handle);

CREATE INDEX server_landscape_item_usage_handle_index ON public.server_landscape_item USING btree (usage_handle);

CREATE INDEX session_store_item_expires_at_index ON public.session_store_item USING btree (expires_at);

CREATE INDEX session_store_item_last_seen_at_index ON public.session_store_item USING btree (last_seen_at);

CREATE INDEX session_store_item_updated_at_index ON public.session_store_item USING btree (updated_at);

CREATE INDEX session_store_person_idx ON public.session_store_item USING btree (person_handle);

CREATE INDEX shared_mailbox_context_item_mailbox_handle_index ON public.shared_mailbox_context_item USING btree (mailbox_handle);

CREATE INDEX shared_mailbox_context_item_template_handle_index ON public.shared_mailbox_context_item USING btree (template_handle);

CREATE INDEX shared_mailbox_group_item_persons_person_item_handle_index ON public.shared_mailbox_group_item_persons USING btree (person_item_handle);

CREATE INDEX shared_mailbox_item_group_handle_index ON public.shared_mailbox_item USING btree (group_handle);

CREATE INDEX shared_mailbox_item_provider_handle_index ON public.shared_mailbox_item USING btree (provider_handle);

CREATE INDEX sla_policy_item_holiday_group_handle_index ON public.sla_policy_item USING btree (holiday_group_handle);

CREATE INDEX sla_policy_item_work_week_handle_index ON public.sla_policy_item USING btree (work_week_handle);

CREATE INDEX social_media_item_person_handle_index ON public.social_media_item USING btree (person_handle);

CREATE INDEX social_media_item_type_handle_index ON public.social_media_item USING btree (type_handle);

CREATE INDEX support_queue_item_default_sla_policy_handle_index ON public.support_queue_item USING btree (default_sla_policy_handle);

CREATE INDEX support_queue_item_team_handle_index ON public.support_queue_item USING btree (team_handle);

CREATE INDEX system_alert_incident_environment_state_time_idx ON public.system_alert_incident_item USING btree (environment_handle, state, last_seen_at);

CREATE INDEX system_alert_incident_item_correlation_key_index ON public.system_alert_incident_item USING btree (correlation_key);

CREATE INDEX system_alert_incident_item_fingerprint_index ON public.system_alert_incident_item USING btree (fingerprint);

CREATE INDEX system_alert_incident_item_last_seen_at_index ON public.system_alert_incident_item USING btree (last_seen_at);

CREATE INDEX system_alert_incident_item_state_last_seen_at_index ON public.system_alert_incident_item USING btree (state, last_seen_at);

CREATE INDEX system_alert_incident_state_resolved_idx ON public.system_alert_incident_item USING btree (state, resolved_at);

CREATE UNIQUE INDEX system_canary_record_item_marker_unique ON public.system_canary_record_item USING btree (marker);

CREATE INDEX system_check_run_item_environment_handle_check_key_68b3a_index ON public.system_check_run_item USING btree (environment_handle, check_key, started_at);

CREATE INDEX system_check_run_item_started_at_index ON public.system_check_run_item USING btree (started_at);

CREATE UNIQUE INDEX system_error_group_environment_fingerprint_unique ON public.system_error_group_item USING btree (environment_handle, fingerprint);

CREATE INDEX system_error_group_item_last_seen_at_index ON public.system_error_group_item USING btree (last_seen_at);

CREATE INDEX system_error_group_item_status_last_seen_at_index ON public.system_error_group_item USING btree (status, last_seen_at);

CREATE INDEX system_error_occurrence_item_correlation_id_index ON public.system_error_occurrence_item USING btree (correlation_id);

CREATE INDEX system_error_occurrence_item_environment_handle_oc_98482_index ON public.system_error_occurrence_item USING btree (environment_handle, occurred_at);

CREATE INDEX system_error_occurrence_item_group_handle_occurred_at_index ON public.system_error_occurrence_item USING btree (group_handle, occurred_at);

CREATE INDEX system_error_occurrence_item_occurred_at_index ON public.system_error_occurrence_item USING btree (occurred_at);

CREATE INDEX system_error_occurrence_item_request_id_index ON public.system_error_occurrence_item USING btree (request_id);

CREATE INDEX system_metric_bucket_item_bucket_start_index ON public.system_metric_bucket_item USING btree (bucket_start);

CREATE INDEX system_metric_bucket_item_metric_key_resolution_bu_6b325_index ON public.system_metric_bucket_item USING btree (metric_key, resolution, bucket_start);

CREATE INDEX system_metric_bucket_resolution_time_idx ON public.system_metric_bucket_item USING btree (resolution, bucket_start);

CREATE UNIQUE INDEX system_metric_bucket_unique ON public.system_metric_bucket_item USING btree (instance_handle, bucket_start, resolution, metric_key, dimension_key);

CREATE INDEX system_remediation_execution_item_environment_hand_9f822_index ON public.system_remediation_execution_item USING btree (environment_handle, started_at);

CREATE UNIQUE INDEX system_remediation_execution_item_idempotency_key_unique ON public.system_remediation_execution_item USING btree (idempotency_key);

CREATE INDEX system_remediation_execution_item_started_at_index ON public.system_remediation_execution_item USING btree (started_at);

CREATE INDEX system_telemetry_environment_item_last_seen_at_index ON public.system_telemetry_environment_item USING btree (last_seen_at);

CREATE UNIQUE INDEX system_telemetry_instance_item_boot_id_unique ON public.system_telemetry_instance_item USING btree (boot_id);

CREATE INDEX system_telemetry_instance_item_environment_handle__7af8e_index ON public.system_telemetry_instance_item USING btree (environment_handle, process_slot, status);

CREATE INDEX system_telemetry_instance_item_last_sample_at_index ON public.system_telemetry_instance_item USING btree (last_sample_at);

CREATE INDEX system_telemetry_instance_item_status_index ON public.system_telemetry_instance_item USING btree (status);

CREATE INDEX teams_delivery_item_created_by_handle_index ON public.teams_delivery_item USING btree (created_by_handle);

CREATE INDEX teams_delivery_item_entity_handle_index ON public.teams_delivery_item USING btree (entity_handle);

CREATE INDEX teams_delivery_item_recipient_person_handle_index ON public.teams_delivery_item USING btree (recipient_person_handle);

CREATE INDEX teams_delivery_item_status_handle_next_retry_at_index ON public.teams_delivery_item USING btree (status_handle, next_retry_at);

CREATE INDEX teams_delivery_item_subscription_handle_index ON public.teams_delivery_item USING btree (subscription_handle);

CREATE INDEX teams_delivery_item_template_handle_index ON public.teams_delivery_item USING btree (template_handle);

CREATE INDEX teams_subscription_item_entity_handle_index ON public.teams_subscription_item USING btree (entity_handle);

CREATE INDEX teams_subscription_item_template_handle_index ON public.teams_subscription_item USING btree (template_handle);

CREATE INDEX teams_subscription_item_type_handle_index ON public.teams_subscription_item USING btree (type_handle);

CREATE INDEX teams_template_item_entity_handle_index ON public.teams_template_item USING btree (entity_handle);

CREATE INDEX ticket_assignee_prs_status_deadline_date_index ON public.ticket_item USING btree (assignee_person_handle, status_handle, deadline_date);

CREATE INDEX ticket_category_item_type_handle_index ON public.ticket_category_item USING btree (type_handle);

CREATE INDEX ticket_item_assignee_company_handle_index ON public.ticket_item USING btree (assignee_company_handle);

CREATE INDEX ticket_item_category_handle_index ON public.ticket_item USING btree (category_handle);

CREATE INDEX ticket_item_contract_handle_updated_at_index ON public.ticket_item USING btree (contract_handle, updated_at);

CREATE INDEX ticket_item_created_at_index ON public.ticket_item USING btree (created_at);

CREATE INDEX ticket_item_creator_company_handle_updated_at_index ON public.ticket_item USING btree (creator_company_handle, updated_at);

CREATE INDEX ticket_item_creator_person_handle_index ON public.ticket_item USING btree (creator_person_handle);

CREATE INDEX ticket_item_deadline_date_index ON public.ticket_item USING btree (deadline_date);

CREATE INDEX ticket_item_end_date_index ON public.ticket_item USING btree (end_date);

CREATE INDEX ticket_item_priority_handle_index ON public.ticket_item USING btree (priority_handle);

CREATE INDEX ticket_item_sales_opportunity_handle_updated_at_index ON public.ticket_item USING btree (sales_opportunity_handle, updated_at);

CREATE INDEX ticket_item_sla_policy_handle_index ON public.ticket_item USING btree (sla_policy_handle);

CREATE INDEX ticket_item_source_handle_index ON public.ticket_item USING btree (source_handle);

CREATE INDEX ticket_item_start_date_index ON public.ticket_item USING btree (start_date);

CREATE INDEX ticket_item_status_handle_index ON public.ticket_item USING btree (status_handle);

CREATE INDEX ticket_item_support_queue_handle_index ON public.ticket_item USING btree (support_queue_handle);

CREATE INDEX ticket_item_support_team_handle_index ON public.ticket_item USING btree (support_team_handle);

CREATE INDEX ticket_item_type_handle_index ON public.ticket_item USING btree (type_handle);

CREATE INDEX ticket_item_updated_at_index ON public.ticket_item USING btree (updated_at);

CREATE INDEX ticket_time_tracking_item_person_handle_index ON public.ticket_time_tracking_item USING btree (person_handle);

CREATE INDEX ticket_time_tracking_item_ticket_handle_created_at_index ON public.ticket_time_tracking_item USING btree (ticket_handle, created_at);

CREATE INDEX translation_item_language_handle_entity_property_index ON public.translation_item USING btree (language_handle, entity, property);

CREATE INDEX webhook_delivery_item_status_handle_next_retry_at_index ON public.webhook_delivery_item USING btree (status_handle, next_retry_at);

CREATE INDEX webhook_delivery_item_subscription_handle_index ON public.webhook_delivery_item USING btree (subscription_handle);

CREATE INDEX webhook_subscription_item_authentication_api_key_handle_index ON public.webhook_subscription_item USING btree (authentication_api_key_handle);

CREATE INDEX webhook_subscription_item_authentication_basic_handle_index ON public.webhook_subscription_item USING btree (authentication_basic_handle);

CREATE INDEX webhook_subscription_item_authentication_oauth2_handle_index ON public.webhook_subscription_item USING btree (authentication_oauth2_handle);

CREATE INDEX webhook_subscription_item_authentication_type_handle_index ON public.webhook_subscription_item USING btree (authentication_type_handle);

CREATE INDEX webhook_subscription_item_entity_handle_index ON public.webhook_subscription_item USING btree (entity_handle);

CREATE INDEX webhook_subscription_item_method_handle_index ON public.webhook_subscription_item USING btree (method_handle);

CREATE INDEX webhook_subscription_item_payload_type_handle_index ON public.webhook_subscription_item USING btree (payload_type_handle);

CREATE INDEX webhook_subscription_item_type_handle_index ON public.webhook_subscription_item USING btree (type_handle);

CREATE INDEX work_hour_week_item_friday_handle_index ON public.work_hour_week_item USING btree (friday_handle);

CREATE INDEX work_hour_week_item_monday_handle_index ON public.work_hour_week_item USING btree (monday_handle);

CREATE INDEX work_hour_week_item_saturday_handle_index ON public.work_hour_week_item USING btree (saturday_handle);

CREATE INDEX work_hour_week_item_sunday_handle_index ON public.work_hour_week_item USING btree (sunday_handle);

CREATE INDEX work_hour_week_item_thursday_handle_index ON public.work_hour_week_item USING btree (thursday_handle);

CREATE INDEX work_hour_week_item_tuesday_handle_index ON public.work_hour_week_item USING btree (tuesday_handle);

CREATE INDEX work_hour_week_item_wednesday_handle_index ON public.work_hour_week_item USING btree (wednesday_handle);

CREATE TRIGGER immutable_prompt_version BEFORE DELETE OR UPDATE ON public.ai_prompt_version_item FOR EACH ROW EXECUTE FUNCTION public.sapling_immutable_prompt_version();

ALTER TABLE ONLY public.address_item
    ADD CONSTRAINT address_item_company_handle_foreign FOREIGN KEY (company_handle) REFERENCES public.company_item(handle);

ALTER TABLE ONLY public.address_item
    ADD CONSTRAINT address_item_country_handle_foreign FOREIGN KEY (country_handle) REFERENCES public.country_item(handle);

ALTER TABLE ONLY public.address_item
    ADD CONSTRAINT address_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.address_type_item(handle);

ALTER TABLE ONLY public.ai_agent_evaluation_item
    ADD CONSTRAINT ai_agent_evaluation_item_agent_handle_foreign FOREIGN KEY (agent_handle) REFERENCES public.ai_agent_item(handle);

ALTER TABLE ONLY public.ai_agent_evaluation_item
    ADD CONSTRAINT ai_agent_evaluation_item_agent_version_handle_foreign FOREIGN KEY (agent_version_handle) REFERENCES public.ai_agent_version_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_item
    ADD CONSTRAINT ai_agent_item_model_handle_foreign FOREIGN KEY (model_handle) REFERENCES public.ai_provider_model_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_item
    ADD CONSTRAINT ai_agent_item_provider_handle_foreign FOREIGN KEY (provider_handle) REFERENCES public.ai_provider_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_item_roles
    ADD CONSTRAINT ai_agent_item_roles_ai_agent_item_handle_foreign FOREIGN KEY (ai_agent_item_handle) REFERENCES public.ai_agent_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_agent_item_roles
    ADD CONSTRAINT ai_agent_item_roles_role_item_handle_foreign FOREIGN KEY (role_item_handle) REFERENCES public.role_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_agent_item
    ADD CONSTRAINT ai_agent_item_web_search_model_handle_foreign FOREIGN KEY (web_search_model_handle) REFERENCES public.ai_provider_model_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_item
    ADD CONSTRAINT ai_agent_item_web_search_provider_handle_foreign FOREIGN KEY (web_search_provider_handle) REFERENCES public.ai_provider_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_memory_item
    ADD CONSTRAINT ai_agent_memory_item_agent_handle_foreign FOREIGN KEY (agent_handle) REFERENCES public.ai_agent_item(handle);

ALTER TABLE ONLY public.ai_agent_memory_item_roles
    ADD CONSTRAINT ai_agent_memory_item_roles_ai_agent_memory_item_handle_foreign FOREIGN KEY (ai_agent_memory_item_handle) REFERENCES public.ai_agent_memory_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_agent_memory_item_roles
    ADD CONSTRAINT ai_agent_memory_item_roles_role_item_handle_foreign FOREIGN KEY (role_item_handle) REFERENCES public.role_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_agent_playbook_item
    ADD CONSTRAINT ai_agent_playbook_item_agent_handle_foreign FOREIGN KEY (agent_handle) REFERENCES public.ai_agent_item(handle);

ALTER TABLE ONLY public.ai_agent_run_item
    ADD CONSTRAINT ai_agent_run_item_agent_handle_foreign FOREIGN KEY (agent_handle) REFERENCES public.ai_agent_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_run_item
    ADD CONSTRAINT ai_agent_run_item_agent_version_handle_foreign FOREIGN KEY (agent_version_handle) REFERENCES public.ai_agent_version_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_run_item
    ADD CONSTRAINT ai_agent_run_item_message_handle_foreign FOREIGN KEY (message_handle) REFERENCES public.ai_chat_message_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_run_item
    ADD CONSTRAINT ai_agent_run_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.ai_agent_run_item
    ADD CONSTRAINT ai_agent_run_item_playbook_handle_foreign FOREIGN KEY (playbook_handle) REFERENCES public.ai_agent_playbook_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_run_item
    ADD CONSTRAINT ai_agent_run_item_session_handle_foreign FOREIGN KEY (session_handle) REFERENCES public.ai_chat_session_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_version_item
    ADD CONSTRAINT ai_agent_version_item_agent_handle_foreign FOREIGN KEY (agent_handle) REFERENCES public.ai_agent_item(handle);

ALTER TABLE ONLY public.ai_agent_version_item
    ADD CONSTRAINT ai_agent_version_item_model_handle_foreign FOREIGN KEY (model_handle) REFERENCES public.ai_provider_model_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_version_item
    ADD CONSTRAINT ai_agent_version_item_provider_handle_foreign FOREIGN KEY (provider_handle) REFERENCES public.ai_provider_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_version_item
    ADD CONSTRAINT ai_agent_version_item_web_search_model_handle_foreign FOREIGN KEY (web_search_model_handle) REFERENCES public.ai_provider_model_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_agent_version_item
    ADD CONSTRAINT ai_agent_version_item_web_search_provider_handle_foreign FOREIGN KEY (web_search_provider_handle) REFERENCES public.ai_provider_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_attachment_item
    ADD CONSTRAINT ai_chat_attachment_item_document_handle_foreign FOREIGN KEY (document_handle) REFERENCES public.document_item(handle);

ALTER TABLE ONLY public.ai_chat_attachment_item
    ADD CONSTRAINT ai_chat_attachment_item_import_batch_handle_foreign FOREIGN KEY (import_batch_handle) REFERENCES public.import_batch_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_attachment_item
    ADD CONSTRAINT ai_chat_attachment_item_message_handle_foreign FOREIGN KEY (message_handle) REFERENCES public.ai_chat_message_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_attachment_item
    ADD CONSTRAINT ai_chat_attachment_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.ai_chat_attachment_item
    ADD CONSTRAINT ai_chat_attachment_item_session_handle_foreign FOREIGN KEY (session_handle) REFERENCES public.ai_chat_session_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_message_item
    ADD CONSTRAINT ai_chat_message_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.ai_chat_message_item
    ADD CONSTRAINT ai_chat_message_item_session_handle_foreign FOREIGN KEY (session_handle) REFERENCES public.ai_chat_session_item(handle);

ALTER TABLE ONLY public.ai_chat_queued_input_item
    ADD CONSTRAINT ai_chat_queued_input_item_assistant_message_handle_foreign FOREIGN KEY (assistant_message_handle) REFERENCES public.ai_chat_message_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_queued_input_item
    ADD CONSTRAINT ai_chat_queued_input_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.ai_chat_queued_input_item
    ADD CONSTRAINT ai_chat_queued_input_item_session_handle_foreign FOREIGN KEY (session_handle) REFERENCES public.ai_chat_session_item(handle);

ALTER TABLE ONLY public.ai_chat_queued_input_item
    ADD CONSTRAINT ai_chat_queued_input_item_user_message_handle_foreign FOREIGN KEY (user_message_handle) REFERENCES public.ai_chat_message_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_session_item
    ADD CONSTRAINT ai_chat_session_item_agent_handle_foreign FOREIGN KEY (agent_handle) REFERENCES public.ai_agent_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_session_item
    ADD CONSTRAINT ai_chat_session_item_agent_version_handle_foreign FOREIGN KEY (agent_version_handle) REFERENCES public.ai_agent_version_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_session_item
    ADD CONSTRAINT ai_chat_session_item_model_handle_foreign FOREIGN KEY (model_handle) REFERENCES public.ai_provider_model_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_session_item
    ADD CONSTRAINT ai_chat_session_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.ai_chat_session_item
    ADD CONSTRAINT ai_chat_session_item_playbook_handle_foreign FOREIGN KEY (playbook_handle) REFERENCES public.ai_agent_playbook_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_session_item
    ADD CONSTRAINT ai_chat_session_item_provider_handle_foreign FOREIGN KEY (provider_handle) REFERENCES public.ai_provider_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_tool_action_item
    ADD CONSTRAINT ai_chat_tool_action_item_agent_handle_foreign FOREIGN KEY (agent_handle) REFERENCES public.ai_agent_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_tool_action_item
    ADD CONSTRAINT ai_chat_tool_action_item_message_handle_foreign FOREIGN KEY (message_handle) REFERENCES public.ai_chat_message_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_tool_action_item
    ADD CONSTRAINT ai_chat_tool_action_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.ai_chat_tool_action_item
    ADD CONSTRAINT ai_chat_tool_action_item_session_handle_foreign FOREIGN KEY (session_handle) REFERENCES public.ai_chat_session_item(handle);

ALTER TABLE ONLY public.ai_chat_transcription_item
    ADD CONSTRAINT ai_chat_transcription_item_document_handle_foreign FOREIGN KEY (document_handle) REFERENCES public.document_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_transcription_item
    ADD CONSTRAINT ai_chat_transcription_item_message_handle_foreign FOREIGN KEY (message_handle) REFERENCES public.ai_chat_message_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_transcription_item
    ADD CONSTRAINT ai_chat_transcription_item_model_handle_foreign FOREIGN KEY (model_handle) REFERENCES public.ai_provider_model_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_transcription_item
    ADD CONSTRAINT ai_chat_transcription_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.ai_chat_transcription_item
    ADD CONSTRAINT ai_chat_transcription_item_provider_handle_foreign FOREIGN KEY (provider_handle) REFERENCES public.ai_provider_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_chat_transcription_item
    ADD CONSTRAINT ai_chat_transcription_item_session_handle_foreign FOREIGN KEY (session_handle) REFERENCES public.ai_chat_session_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_entity_generation_template_item
    ADD CONSTRAINT ai_entity_generation_template_item_model_handle_foreign FOREIGN KEY (model_handle) REFERENCES public.ai_provider_model_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_entity_generation_template_item
    ADD CONSTRAINT ai_entity_generation_template_item_provider_handle_foreign FOREIGN KEY (provider_handle) REFERENCES public.ai_provider_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_entity_generation_template_item
    ADD CONSTRAINT ai_entity_generation_template_item_source_entity_handle_foreign FOREIGN KEY (source_entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.ai_entity_generation_template_item
    ADD CONSTRAINT ai_entity_generation_template_item_target_entity_handle_foreign FOREIGN KEY (target_entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.ai_prompt_template_item
    ADD CONSTRAINT ai_prompt_template_item_published_version_handle_foreign FOREIGN KEY (published_version_handle) REFERENCES public.ai_prompt_version_item(handle) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ai_prompt_version_item
    ADD CONSTRAINT ai_prompt_version_item_author_handle_foreign FOREIGN KEY (author_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_prompt_version_item
    ADD CONSTRAINT ai_prompt_version_item_template_handle_foreign FOREIGN KEY (template_handle) REFERENCES public.ai_prompt_template_item(handle) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ai_provider_model_item
    ADD CONSTRAINT ai_provider_model_item_provider_handle_foreign FOREIGN KEY (provider_handle) REFERENCES public.ai_provider_type_item(handle);

ALTER TABLE ONLY public.ai_usage_event_item
    ADD CONSTRAINT ai_usage_event_item_environment_handle_foreign FOREIGN KEY (environment_handle) REFERENCES public.system_telemetry_environment_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.ai_usage_event_item
    ADD CONSTRAINT ai_usage_event_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.authentication_event_item
    ADD CONSTRAINT authentication_event_item_environment_handle_foreign FOREIGN KEY (environment_handle) REFERENCES public.system_telemetry_environment_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.authentication_event_item
    ADD CONSTRAINT authentication_event_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.automation_event_item
    ADD CONSTRAINT automation_event_item_actor_handle_foreign FOREIGN KEY (actor_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.automation_event_item
    ADD CONSTRAINT automation_event_item_source_entity_handle_foreign FOREIGN KEY (source_entity_handle) REFERENCES public.entity_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.automation_execution_item
    ADD CONSTRAINT automation_execution_item_event_handle_foreign FOREIGN KEY (event_handle) REFERENCES public.automation_event_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.automation_execution_item
    ADD CONSTRAINT automation_execution_item_target_entity_handle_foreign FOREIGN KEY (target_entity_handle) REFERENCES public.entity_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.calendar_sync_subscription_item
    ADD CONSTRAINT calendar_sync_subscription_item_default_event_ca_44daa_foreign FOREIGN KEY (default_event_category_handle) REFERENCES public.event_category_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.calendar_sync_subscription_item
    ADD CONSTRAINT calendar_sync_subscription_item_default_event_ty_d8955_foreign FOREIGN KEY (default_event_type_handle) REFERENCES public.event_type_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.calendar_sync_subscription_item
    ADD CONSTRAINT calendar_sync_subscription_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.change_log_detail_item
    ADD CONSTRAINT change_log_detail_item_log_handle_foreign FOREIGN KEY (log_handle) REFERENCES public.change_log_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.change_log_item
    ADD CONSTRAINT change_log_item_action_handle_foreign FOREIGN KEY (action_handle) REFERENCES public.change_log_action_item(handle);

ALTER TABLE ONLY public.change_log_item
    ADD CONSTRAINT change_log_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.change_log_item
    ADD CONSTRAINT change_log_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_account_manager_handle_foreign FOREIGN KEY (account_manager_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL DEFERRABLE;

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_annual_revenue_class_handle_foreign FOREIGN KEY (annual_revenue_class_handle) REFERENCES public.company_annual_revenue_class_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.company_item_automatic_cc_persons
    ADD CONSTRAINT company_item_automatic_cc_persons_company_item_handle_foreign FOREIGN KEY (company_item_handle) REFERENCES public.company_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.company_item_automatic_cc_persons
    ADD CONSTRAINT company_item_automatic_cc_persons_person_item_handle_foreign FOREIGN KEY (person_item_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_churn_risk_reason_handle_foreign FOREIGN KEY (churn_risk_reason_handle) REFERENCES public.company_churn_risk_reason_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_country_handle_foreign FOREIGN KEY (country_handle) REFERENCES public.country_item(handle);

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_customer_success_manager_handle_foreign FOREIGN KEY (customer_success_manager_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL DEFERRABLE;

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_holiday_group_handle_foreign FOREIGN KEY (holiday_group_handle) REFERENCES public.holiday_group_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_industry_handle_foreign FOREIGN KEY (industry_handle) REFERENCES public.company_industry_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_segment_handle_foreign FOREIGN KEY (segment_handle) REFERENCES public.company_segment_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_service_provider_handle_foreign FOREIGN KEY (service_provider_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_size_handle_foreign FOREIGN KEY (size_handle) REFERENCES public.company_size_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.company_item
    ADD CONSTRAINT company_item_work_week_handle_foreign FOREIGN KEY (work_week_handle) REFERENCES public.work_hour_week_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.company_relationship_item
    ADD CONSTRAINT company_relationship_item_source_company_handle_foreign FOREIGN KEY (source_company_handle) REFERENCES public.company_item(handle);

ALTER TABLE ONLY public.company_relationship_item
    ADD CONSTRAINT company_relationship_item_target_company_handle_foreign FOREIGN KEY (target_company_handle) REFERENCES public.company_item(handle);

ALTER TABLE ONLY public.company_relationship_item
    ADD CONSTRAINT company_relationship_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.company_relationship_type_item(handle);

ALTER TABLE ONLY public.contract_item
    ADD CONSTRAINT contract_item_company_handle_foreign FOREIGN KEY (company_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.contract_item
    ADD CONSTRAINT contract_item_default_support_queue_handle_foreign FOREIGN KEY (default_support_queue_handle) REFERENCES public.support_queue_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.contract_item
    ADD CONSTRAINT contract_item_default_support_team_handle_foreign FOREIGN KEY (default_support_team_handle) REFERENCES public.support_team_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.contract_item_products
    ADD CONSTRAINT contract_item_products_contract_item_handle_foreign FOREIGN KEY (contract_item_handle) REFERENCES public.contract_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.contract_item_products
    ADD CONSTRAINT contract_item_products_product_item_handle_foreign FOREIGN KEY (product_item_handle) REFERENCES public.product_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.contract_item
    ADD CONSTRAINT contract_item_service_level_handle_foreign FOREIGN KEY (service_level_handle) REFERENCES public.contract_service_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.contract_item
    ADD CONSTRAINT contract_item_sla_policy_handle_foreign FOREIGN KEY (sla_policy_handle) REFERENCES public.sla_policy_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.country_item
    ADD CONSTRAINT country_item_language_handle_foreign FOREIGN KEY (language_handle) REFERENCES public.language_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.country_item
    ADD CONSTRAINT country_item_money_handle_foreign FOREIGN KEY (money_handle) REFERENCES public.money_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.custom_field_definition_item
    ADD CONSTRAINT custom_field_definition_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.custom_field_definition_item
    ADD CONSTRAINT custom_field_definition_item_field_type_handle_foreign FOREIGN KEY (field_type_handle) REFERENCES public.custom_field_type_item(handle);

ALTER TABLE ONLY public.custom_field_value_item
    ADD CONSTRAINT custom_field_value_item_definition_handle_foreign FOREIGN KEY (definition_handle) REFERENCES public.custom_field_definition_item(handle);

ALTER TABLE ONLY public.custom_field_value_item
    ADD CONSTRAINT custom_field_value_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.dashboard_item_kpis
    ADD CONSTRAINT dashboard_item_kpis_dashboard_item_handle_foreign FOREIGN KEY (dashboard_item_handle) REFERENCES public.dashboard_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.dashboard_item_kpis
    ADD CONSTRAINT dashboard_item_kpis_kpi_item_handle_foreign FOREIGN KEY (kpi_item_handle) REFERENCES public.kpi_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.dashboard_item
    ADD CONSTRAINT dashboard_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.dashboard_template_item_kpis
    ADD CONSTRAINT dashboard_template_item_kpis_dashboard_template__45778_foreign FOREIGN KEY (dashboard_template_item_handle) REFERENCES public.dashboard_template_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.dashboard_template_item_kpis
    ADD CONSTRAINT dashboard_template_item_kpis_kpi_item_handle_foreign FOREIGN KEY (kpi_item_handle) REFERENCES public.kpi_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.dashboard_template_item
    ADD CONSTRAINT dashboard_template_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.document_item
    ADD CONSTRAINT document_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.document_item
    ADD CONSTRAINT document_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.document_item
    ADD CONSTRAINT document_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.document_type_item(handle);

ALTER TABLE ONLY public.dvelop_connection_item
    ADD CONSTRAINT dvelop_connection_item_default_object_definition_handle_foreign FOREIGN KEY (default_object_definition_handle) REFERENCES public.dvelop_object_definition_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.dvelop_connection_item
    ADD CONSTRAINT dvelop_connection_item_repository_handle_foreign FOREIGN KEY (repository_handle) REFERENCES public.dvelop_repository_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.dvelop_entity_mapping_item
    ADD CONSTRAINT dvelop_entity_mapping_item_connection_handle_foreign FOREIGN KEY (connection_handle) REFERENCES public.dvelop_connection_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.dvelop_entity_mapping_item
    ADD CONSTRAINT dvelop_entity_mapping_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.dvelop_entity_mapping_item
    ADD CONSTRAINT dvelop_entity_mapping_item_object_definition_handle_foreign FOREIGN KEY (object_definition_handle) REFERENCES public.dvelop_object_definition_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.dvelop_entity_mapping_property_item
    ADD CONSTRAINT dvelop_entity_mapping_property_item_mapping_handle_foreign FOREIGN KEY (mapping_handle) REFERENCES public.dvelop_entity_mapping_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.dvelop_entity_mapping_property_item
    ADD CONSTRAINT dvelop_entity_mapping_property_item_property_handle_foreign FOREIGN KEY (property_handle) REFERENCES public.dvelop_property_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.dvelop_entity_mapping_search_category_item
    ADD CONSTRAINT dvelop_entity_mapping_search_category_item_mappi_e6b27_foreign FOREIGN KEY (mapping_handle) REFERENCES public.dvelop_entity_mapping_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.dvelop_entity_mapping_search_category_item
    ADD CONSTRAINT dvelop_entity_mapping_search_category_item_objec_901f8_foreign FOREIGN KEY (object_definition_handle) REFERENCES public.dvelop_object_definition_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.dvelop_object_definition_item
    ADD CONSTRAINT dvelop_object_definition_item_connection_handle_foreign FOREIGN KEY (connection_handle) REFERENCES public.dvelop_connection_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.dvelop_property_item
    ADD CONSTRAINT dvelop_property_item_connection_handle_foreign FOREIGN KEY (connection_handle) REFERENCES public.dvelop_connection_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.dvelop_property_item
    ADD CONSTRAINT dvelop_property_item_object_definition_handle_foreign FOREIGN KEY (object_definition_handle) REFERENCES public.dvelop_object_definition_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.dvelop_repository_item
    ADD CONSTRAINT dvelop_repository_item_connection_handle_foreign FOREIGN KEY (connection_handle) REFERENCES public.dvelop_connection_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.effort_estimate_item
    ADD CONSTRAINT effort_estimate_item_assignee_company_handle_foreign FOREIGN KEY (assignee_company_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.effort_estimate_item
    ADD CONSTRAINT effort_estimate_item_assignee_person_handle_foreign FOREIGN KEY (assignee_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.effort_estimate_item
    ADD CONSTRAINT effort_estimate_item_creator_company_handle_foreign FOREIGN KEY (creator_company_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.effort_estimate_item
    ADD CONSTRAINT effort_estimate_item_creator_person_handle_foreign FOREIGN KEY (creator_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.effort_estimate_item
    ADD CONSTRAINT effort_estimate_item_sales_opportunity_handle_foreign FOREIGN KEY (sales_opportunity_handle) REFERENCES public.sales_opportunity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.effort_estimate_item
    ADD CONSTRAINT effort_estimate_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.effort_estimate_status_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.effort_estimate_item
    ADD CONSTRAINT effort_estimate_item_ticket_handle_foreign FOREIGN KEY (ticket_handle) REFERENCES public.ticket_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.effort_estimate_position_item
    ADD CONSTRAINT effort_estimate_position_item_estimate_handle_foreign FOREIGN KEY (estimate_handle) REFERENCES public.effort_estimate_item(handle);

ALTER TABLE ONLY public.effort_estimate_position_item
    ADD CONSTRAINT effort_estimate_position_item_template_handle_foreign FOREIGN KEY (template_handle) REFERENCES public.effort_estimate_position_template_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_delivery_item
    ADD CONSTRAINT email_delivery_item_created_by_handle_foreign FOREIGN KEY (created_by_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.email_delivery_item
    ADD CONSTRAINT email_delivery_item_customer_company_handle_foreign FOREIGN KEY (customer_company_handle) REFERENCES public.company_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.email_delivery_item
    ADD CONSTRAINT email_delivery_item_customer_person_handle_foreign FOREIGN KEY (customer_person_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.email_delivery_item
    ADD CONSTRAINT email_delivery_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.email_delivery_item
    ADD CONSTRAINT email_delivery_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.email_delivery_status_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_delivery_item
    ADD CONSTRAINT email_delivery_item_subscription_handle_foreign FOREIGN KEY (subscription_handle) REFERENCES public.email_subscription_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_delivery_item
    ADD CONSTRAINT email_delivery_item_template_handle_foreign FOREIGN KEY (template_handle) REFERENCES public.email_template_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_inbox_subscription_item
    ADD CONSTRAINT email_inbox_subscription_item_agent_handle_foreign FOREIGN KEY (agent_handle) REFERENCES public.ai_agent_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.email_inbox_subscription_item
    ADD CONSTRAINT email_inbox_subscription_item_mailbox_handle_foreign FOREIGN KEY (mailbox_handle) REFERENCES public.shared_mailbox_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.email_inbox_subscription_item
    ADD CONSTRAINT email_inbox_subscription_item_processing_mode_handle_foreign FOREIGN KEY (processing_mode_handle) REFERENCES public.email_inbox_processing_mode_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.email_inbox_subscription_item
    ADD CONSTRAINT email_inbox_subscription_item_processing_person_handle_foreign FOREIGN KEY (processing_person_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.email_list_item_companies
    ADD CONSTRAINT email_list_item_companies_company_item_handle_foreign FOREIGN KEY (company_item_handle) REFERENCES public.company_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.email_list_item_companies
    ADD CONSTRAINT email_list_item_companies_email_list_item_handle_foreign FOREIGN KEY (email_list_item_handle) REFERENCES public.email_list_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.email_list_item
    ADD CONSTRAINT email_list_item_mail_template_handle_foreign FOREIGN KEY (mail_template_handle) REFERENCES public.email_template_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_list_item_persons
    ADD CONSTRAINT email_list_item_persons_email_list_item_handle_foreign FOREIGN KEY (email_list_item_handle) REFERENCES public.email_list_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.email_list_item_persons
    ADD CONSTRAINT email_list_item_persons_person_item_handle_foreign FOREIGN KEY (person_item_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.email_signature_item
    ADD CONSTRAINT email_signature_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.email_subscription_condition_item
    ADD CONSTRAINT email_subscription_condition_item_subscription_handle_foreign FOREIGN KEY (subscription_handle) REFERENCES public.email_subscription_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_subscription_item
    ADD CONSTRAINT email_subscription_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.email_subscription_item
    ADD CONSTRAINT email_subscription_item_sender_mailbox_handle_foreign FOREIGN KEY (sender_mailbox_handle) REFERENCES public.shared_mailbox_item(handle);

ALTER TABLE ONLY public.email_subscription_item
    ADD CONSTRAINT email_subscription_item_sender_person_handle_foreign FOREIGN KEY (sender_person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.email_subscription_item
    ADD CONSTRAINT email_subscription_item_template_handle_foreign FOREIGN KEY (template_handle) REFERENCES public.email_template_item(handle);

ALTER TABLE ONLY public.email_subscription_item
    ADD CONSTRAINT email_subscription_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.webhook_subscription_type_item(handle);

ALTER TABLE ONLY public.email_template_item
    ADD CONSTRAINT email_template_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.entity_group_item
    ADD CONSTRAINT entity_group_item_parent_handle_foreign FOREIGN KEY (parent_handle) REFERENCES public.entity_group_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.entity_item
    ADD CONSTRAINT entity_item_group_handle_foreign FOREIGN KEY (group_handle) REFERENCES public.entity_group_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.entity_route_item
    ADD CONSTRAINT entity_route_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.entity_route_item
    ADD CONSTRAINT entity_route_item_group_handle_foreign FOREIGN KEY (group_handle) REFERENCES public.entity_group_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_azure_item
    ADD CONSTRAINT event_azure_item_event_handle_foreign FOREIGN KEY (event_handle) REFERENCES public.event_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_delivery_item
    ADD CONSTRAINT event_delivery_item_event_handle_foreign FOREIGN KEY (event_handle) REFERENCES public.event_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_delivery_item
    ADD CONSTRAINT event_delivery_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.event_delivery_status_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_google_item
    ADD CONSTRAINT event_google_item_event_handle_foreign FOREIGN KEY (event_handle) REFERENCES public.event_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_assignee_company_handle_foreign FOREIGN KEY (assignee_company_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_assignee_person_handle_foreign FOREIGN KEY (assignee_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_category_handle_foreign FOREIGN KEY (category_handle) REFERENCES public.event_category_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_creator_company_handle_foreign FOREIGN KEY (creator_company_handle) REFERENCES public.company_item(handle);

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_creator_person_handle_foreign FOREIGN KEY (creator_person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_effort_estimate_handle_foreign FOREIGN KEY (effort_estimate_handle) REFERENCES public.effort_estimate_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_internal_case_handle_foreign FOREIGN KEY (internal_case_handle) REFERENCES public.internal_case_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_sales_opportunity_handle_foreign FOREIGN KEY (sales_opportunity_handle) REFERENCES public.sales_opportunity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.event_status_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_ticket_handle_foreign FOREIGN KEY (ticket_handle) REFERENCES public.ticket_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.event_item
    ADD CONSTRAINT event_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.event_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.external_record_link_item
    ADD CONSTRAINT external_record_link_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.external_record_link_item
    ADD CONSTRAINT external_record_link_item_first_import_batch_handle_foreign FOREIGN KEY (first_import_batch_handle) REFERENCES public.import_batch_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.external_record_link_item
    ADD CONSTRAINT external_record_link_item_last_import_batch_handle_foreign FOREIGN KEY (last_import_batch_handle) REFERENCES public.import_batch_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.external_record_link_item
    ADD CONSTRAINT external_record_link_item_source_handle_foreign FOREIGN KEY (source_handle) REFERENCES public.import_source_item(handle);

ALTER TABLE ONLY public.favorite_item
    ADD CONSTRAINT favorite_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.favorite_item
    ADD CONSTRAINT favorite_item_entity_route_handle_foreign FOREIGN KEY (entity_route_handle) REFERENCES public.entity_route_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.favorite_item
    ADD CONSTRAINT favorite_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.favorite_template_item
    ADD CONSTRAINT favorite_template_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.favorite_template_item
    ADD CONSTRAINT favorite_template_item_entity_route_handle_foreign FOREIGN KEY (entity_route_handle) REFERENCES public.entity_route_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.field_automation_item
    ADD CONSTRAINT field_automation_item_operation_handle_foreign FOREIGN KEY (operation_handle) REFERENCES public.webhook_subscription_type_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.field_automation_item
    ADD CONSTRAINT field_automation_item_source_entity_handle_foreign FOREIGN KEY (source_entity_handle) REFERENCES public.entity_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.field_automation_item
    ADD CONSTRAINT field_automation_item_target_entity_handle_foreign FOREIGN KEY (target_entity_handle) REFERENCES public.entity_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.field_permission_item
    ADD CONSTRAINT field_permission_item_permission_handle_foreign FOREIGN KEY (permission_handle) REFERENCES public.permission_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.holiday_item
    ADD CONSTRAINT holiday_item_group_handle_foreign FOREIGN KEY (group_handle) REFERENCES public.holiday_group_item(handle);

ALTER TABLE ONLY public.http_metric_bucket_item
    ADD CONSTRAINT http_metric_bucket_item_api_token_handle_foreign FOREIGN KEY (api_token_handle) REFERENCES public.person_api_token_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.http_metric_bucket_item
    ADD CONSTRAINT http_metric_bucket_item_environment_handle_foreign FOREIGN KEY (environment_handle) REFERENCES public.system_telemetry_environment_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.http_metric_bucket_item
    ADD CONSTRAINT http_metric_bucket_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.import_batch_item
    ADD CONSTRAINT import_batch_item_created_by_handle_foreign FOREIGN KEY (created_by_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.import_batch_item
    ADD CONSTRAINT import_batch_item_import_template_handle_foreign FOREIGN KEY (import_template_handle) REFERENCES public.import_template_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.import_batch_item
    ADD CONSTRAINT import_batch_item_source_handle_foreign FOREIGN KEY (source_handle) REFERENCES public.import_source_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.import_batch_item
    ADD CONSTRAINT import_batch_item_target_entity_handle_foreign FOREIGN KEY (target_entity_handle) REFERENCES public.entity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.import_batch_row_item
    ADD CONSTRAINT import_batch_row_item_batch_handle_foreign FOREIGN KEY (batch_handle) REFERENCES public.import_batch_item(handle);

ALTER TABLE ONLY public.import_template_item
    ADD CONSTRAINT import_template_item_source_handle_foreign FOREIGN KEY (source_handle) REFERENCES public.import_source_item(handle);

ALTER TABLE ONLY public.import_template_item
    ADD CONSTRAINT import_template_item_target_entity_handle_foreign FOREIGN KEY (target_entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.import_template_value_mapping_item
    ADD CONSTRAINT import_template_value_mapping_item_import_templa_39513_foreign FOREIGN KEY (import_template_handle) REFERENCES public.import_template_item(handle);

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_agent_handle_foreign FOREIGN KEY (agent_handle) REFERENCES public.ai_agent_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_ai_message_handle_foreign FOREIGN KEY (ai_message_handle) REFERENCES public.ai_chat_message_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_ai_session_handle_foreign FOREIGN KEY (ai_session_handle) REFERENCES public.ai_chat_session_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_company_handle_foreign FOREIGN KEY (company_handle) REFERENCES public.company_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_mailbox_handle_foreign FOREIGN KEY (mailbox_handle) REFERENCES public.shared_mailbox_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_office_task_handle_foreign FOREIGN KEY (office_task_handle) REFERENCES public.event_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_sales_opportunity_handle_foreign FOREIGN KEY (sales_opportunity_handle) REFERENCES public.sales_opportunity_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_source_document_handle_foreign FOREIGN KEY (source_document_handle) REFERENCES public.document_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.inbound_email_status_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_subscription_handle_foreign FOREIGN KEY (subscription_handle) REFERENCES public.email_inbox_subscription_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.inbound_email_item
    ADD CONSTRAINT inbound_email_item_ticket_handle_foreign FOREIGN KEY (ticket_handle) REFERENCES public.ticket_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbox_notification_item
    ADD CONSTRAINT inbox_notification_item_created_by_handle_foreign FOREIGN KEY (created_by_handle) REFERENCES public.person_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.inbox_notification_item
    ADD CONSTRAINT inbox_notification_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.inbox_notification_item
    ADD CONSTRAINT inbox_notification_item_recipient_person_handle_foreign FOREIGN KEY (recipient_person_handle) REFERENCES public.person_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.inbox_notification_item
    ADD CONSTRAINT inbox_notification_item_subscription_handle_foreign FOREIGN KEY (subscription_handle) REFERENCES public.inbox_subscription_item(handle);

ALTER TABLE ONLY public.inbox_notification_item
    ADD CONSTRAINT inbox_notification_item_template_handle_foreign FOREIGN KEY (template_handle) REFERENCES public.inbox_template_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.inbox_subscription_item
    ADD CONSTRAINT inbox_subscription_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.inbox_subscription_item
    ADD CONSTRAINT inbox_subscription_item_source_entity_handle_foreign FOREIGN KEY (source_entity_handle) REFERENCES public.entity_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.inbox_subscription_item
    ADD CONSTRAINT inbox_subscription_item_template_handle_foreign FOREIGN KEY (template_handle) REFERENCES public.inbox_template_item(handle);

ALTER TABLE ONLY public.inbox_subscription_item
    ADD CONSTRAINT inbox_subscription_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.webhook_subscription_type_item(handle);

ALTER TABLE ONLY public.inbox_template_item
    ADD CONSTRAINT inbox_template_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.information_item
    ADD CONSTRAINT information_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.information_item
    ADD CONSTRAINT information_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_category_handle_foreign FOREIGN KEY (category_handle) REFERENCES public.internal_case_category_item(handle);

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_customer_company_handle_foreign FOREIGN KEY (customer_company_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_customer_person_handle_foreign FOREIGN KEY (customer_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_effort_estimate_handle_foreign FOREIGN KEY (effort_estimate_handle) REFERENCES public.effort_estimate_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_responsible_company_handle_foreign FOREIGN KEY (responsible_company_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_responsible_person_handle_foreign FOREIGN KEY (responsible_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_sales_opportunity_handle_foreign FOREIGN KEY (sales_opportunity_handle) REFERENCES public.sales_opportunity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.internal_case_status_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.internal_case_item
    ADD CONSTRAINT internal_case_item_ticket_handle_foreign FOREIGN KEY (ticket_handle) REFERENCES public.ticket_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_author_person_handle_foreign FOREIGN KEY (author_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_category_handle_foreign FOREIGN KEY (category_handle) REFERENCES public.knowledge_article_category_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_product_handle_foreign FOREIGN KEY (product_handle) REFERENCES public.product_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_reviewer_person_handle_foreign FOREIGN KEY (reviewer_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_source_effort_estimate_handle_foreign FOREIGN KEY (source_effort_estimate_handle) REFERENCES public.effort_estimate_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_source_sales_opportunity_handle_foreign FOREIGN KEY (source_sales_opportunity_handle) REFERENCES public.sales_opportunity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_source_ticket_handle_foreign FOREIGN KEY (source_ticket_handle) REFERENCES public.ticket_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.knowledge_article_status_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.knowledge_article_item
    ADD CONSTRAINT knowledge_article_item_visibility_handle_foreign FOREIGN KEY (visibility_handle) REFERENCES public.knowledge_article_visibility_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.kpi_item
    ADD CONSTRAINT kpi_item_aggregation_handle_foreign FOREIGN KEY (aggregation_handle) REFERENCES public.kpi_aggregation_item(handle);

ALTER TABLE ONLY public.kpi_item
    ADD CONSTRAINT kpi_item_relation_handle_foreign FOREIGN KEY (relation_handle) REFERENCES public.entity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.kpi_item
    ADD CONSTRAINT kpi_item_secondary_aggregation_handle_foreign FOREIGN KEY (secondary_aggregation_handle) REFERENCES public.kpi_aggregation_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.kpi_item
    ADD CONSTRAINT kpi_item_secondary_target_entity_handle_foreign FOREIGN KEY (secondary_target_entity_handle) REFERENCES public.entity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.kpi_item
    ADD CONSTRAINT kpi_item_target_entity_handle_foreign FOREIGN KEY (target_entity_handle) REFERENCES public.entity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.kpi_item
    ADD CONSTRAINT kpi_item_timeframe_handle_foreign FOREIGN KEY (timeframe_handle) REFERENCES public.kpi_timeframe_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.kpi_item
    ADD CONSTRAINT kpi_item_timeframe_interval_handle_foreign FOREIGN KEY (timeframe_interval_handle) REFERENCES public.kpi_timeframe_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.kpi_item
    ADD CONSTRAINT kpi_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.kpi_type_item(handle);

ALTER TABLE ONLY public.marketing_campaign_item
    ADD CONSTRAINT marketing_campaign_item_email_template_handle_foreign FOREIGN KEY (email_template_handle) REFERENCES public.email_template_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.marketing_campaign_item
    ADD CONSTRAINT marketing_campaign_item_opportunity_source_handle_foreign FOREIGN KEY (opportunity_source_handle) REFERENCES public.sales_opportunity_source_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.marketing_campaign_item
    ADD CONSTRAINT marketing_campaign_item_owner_person_handle_foreign FOREIGN KEY (owner_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.marketing_campaign_item
    ADD CONSTRAINT marketing_campaign_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.marketing_campaign_status_item(handle);

ALTER TABLE ONLY public.marketing_campaign_item
    ADD CONSTRAINT marketing_campaign_item_target_list_handle_foreign FOREIGN KEY (target_list_handle) REFERENCES public.email_list_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.marketing_campaign_item
    ADD CONSTRAINT marketing_campaign_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.marketing_campaign_type_item(handle);

ALTER TABLE ONLY public.note_item
    ADD CONSTRAINT note_item_group_handle_foreign FOREIGN KEY (group_handle) REFERENCES public.note_group_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.note_item
    ADD CONSTRAINT note_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.permission_item
    ADD CONSTRAINT permission_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.permission_item
    ADD CONSTRAINT permission_item_role_handle_foreign FOREIGN KEY (role_handle) REFERENCES public.role_item(handle);

ALTER TABLE ONLY public.person_api_token_item
    ADD CONSTRAINT person_api_token_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_company_handle_foreign FOREIGN KEY (company_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL DEFERRABLE;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_decision_role_handle_foreign FOREIGN KEY (decision_role_handle) REFERENCES public.person_decision_role_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_default_email_signature_handle_foreign FOREIGN KEY (default_email_signature_handle) REFERENCES public.email_signature_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_department_handle_foreign FOREIGN KEY (department_handle) REFERENCES public.person_department_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item_events
    ADD CONSTRAINT person_item_events_event_item_handle_foreign FOREIGN KEY (event_item_handle) REFERENCES public.event_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.person_item_events
    ADD CONSTRAINT person_item_events_person_item_handle_foreign FOREIGN KEY (person_item_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_holiday_group_handle_foreign FOREIGN KEY (holiday_group_handle) REFERENCES public.holiday_group_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_job_function_handle_foreign FOREIGN KEY (job_function_handle) REFERENCES public.person_function_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_job_title_handle_foreign FOREIGN KEY (job_title_handle) REFERENCES public.person_job_title_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_language_handle_foreign FOREIGN KEY (language_handle) REFERENCES public.language_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item_roles
    ADD CONSTRAINT person_item_roles_person_item_handle_foreign FOREIGN KEY (person_item_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.person_item_roles
    ADD CONSTRAINT person_item_roles_role_item_handle_foreign FOREIGN KEY (role_item_handle) REFERENCES public.role_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_salutation_handle_foreign FOREIGN KEY (salutation_handle) REFERENCES public.person_salutation_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_title_handle_foreign FOREIGN KEY (title_handle) REFERENCES public.person_title_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.person_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_item
    ADD CONSTRAINT person_item_work_week_handle_foreign FOREIGN KEY (work_week_handle) REFERENCES public.work_hour_week_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.person_passkey_item
    ADD CONSTRAINT person_passkey_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.person_session_item
    ADD CONSTRAINT person_session_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.phone_call_item
    ADD CONSTRAINT phone_call_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.phone_call_item
    ADD CONSTRAINT phone_call_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.role_item
    ADD CONSTRAINT role_item_stage_handle_foreign FOREIGN KEY (stage_handle) REFERENCES public.role_stage_item(handle);

ALTER TABLE ONLY public.role_item_starter_dashboard_templates
    ADD CONSTRAINT role_item_starter_dashboard_templates_dashboard__7942f_foreign FOREIGN KEY (dashboard_template_item_handle) REFERENCES public.dashboard_template_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.role_item_starter_dashboard_templates
    ADD CONSTRAINT role_item_starter_dashboard_templates_role_item_handle_foreign FOREIGN KEY (role_item_handle) REFERENCES public.role_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.role_item_starter_favorite_templates
    ADD CONSTRAINT role_item_starter_favorite_templates_favorite_te_3edaa_foreign FOREIGN KEY (favorite_template_item_handle) REFERENCES public.favorite_template_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.role_item_starter_favorite_templates
    ADD CONSTRAINT role_item_starter_favorite_templates_role_item_handle_foreign FOREIGN KEY (role_item_handle) REFERENCES public.role_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_assignee_company_handle_foreign FOREIGN KEY (assignee_company_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_assignee_person_handle_foreign FOREIGN KEY (assignee_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.sales_opportunity_item_competitors
    ADD CONSTRAINT sales_opportunity_item_competitors_company_item_handle_foreign FOREIGN KEY (company_item_handle) REFERENCES public.company_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.sales_opportunity_item_competitors
    ADD CONSTRAINT sales_opportunity_item_competitors_sales_opportu_fbc76_foreign FOREIGN KEY (sales_opportunity_item_handle) REFERENCES public.sales_opportunity_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_creator_company_handle_foreign FOREIGN KEY (creator_company_handle) REFERENCES public.company_item(handle);

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_creator_person_handle_foreign FOREIGN KEY (creator_person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_forecast_handle_foreign FOREIGN KEY (forecast_handle) REFERENCES public.sales_opportunity_forecast_item(handle);

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_loss_reason_handle_foreign FOREIGN KEY (loss_reason_handle) REFERENCES public.sales_opportunity_loss_reason_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_result_status_handle_foreign FOREIGN KEY (result_status_handle) REFERENCES public.sales_opportunity_result_status_item(handle);

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_source_handle_foreign FOREIGN KEY (source_handle) REFERENCES public.sales_opportunity_source_item(handle);

ALTER TABLE ONLY public.sales_opportunity_item
    ADD CONSTRAINT sales_opportunity_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.sales_opportunity_stage_item(handle);

ALTER TABLE ONLY public.sapling_form_config_item
    ADD CONSTRAINT sapling_form_config_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.sapling_form_config_item
    ADD CONSTRAINT sapling_form_config_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.script_button_item
    ADD CONSTRAINT script_button_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.server_landscape_item
    ADD CONSTRAINT server_landscape_item_company_handle_foreign FOREIGN KEY (company_handle) REFERENCES public.company_item(handle);

ALTER TABLE ONLY public.server_landscape_item
    ADD CONSTRAINT server_landscape_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.server_landscape_type_item(handle);

ALTER TABLE ONLY public.server_landscape_item
    ADD CONSTRAINT server_landscape_item_usage_handle_foreign FOREIGN KEY (usage_handle) REFERENCES public.server_landscape_type_usage_item(handle);

ALTER TABLE ONLY public.session_store_item
    ADD CONSTRAINT session_store_person_fk FOREIGN KEY (person_handle) REFERENCES public.person_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.shared_mailbox_context_item
    ADD CONSTRAINT shared_mailbox_context_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.shared_mailbox_context_item
    ADD CONSTRAINT shared_mailbox_context_item_mailbox_handle_foreign FOREIGN KEY (mailbox_handle) REFERENCES public.shared_mailbox_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.shared_mailbox_context_item
    ADD CONSTRAINT shared_mailbox_context_item_template_handle_foreign FOREIGN KEY (template_handle) REFERENCES public.email_template_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.shared_mailbox_group_item_persons
    ADD CONSTRAINT shared_mailbox_group_item_persons_person_item_handle_foreign FOREIGN KEY (person_item_handle) REFERENCES public.person_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.shared_mailbox_group_item_persons
    ADD CONSTRAINT shared_mailbox_group_item_persons_shared_mailbox_c547c_foreign FOREIGN KEY (shared_mailbox_group_item_handle) REFERENCES public.shared_mailbox_group_item(handle) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.shared_mailbox_item
    ADD CONSTRAINT shared_mailbox_item_group_handle_foreign FOREIGN KEY (group_handle) REFERENCES public.shared_mailbox_group_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.shared_mailbox_item
    ADD CONSTRAINT shared_mailbox_item_provider_handle_foreign FOREIGN KEY (provider_handle) REFERENCES public.person_type_item(handle);

ALTER TABLE ONLY public.sla_policy_item
    ADD CONSTRAINT sla_policy_item_holiday_group_handle_foreign FOREIGN KEY (holiday_group_handle) REFERENCES public.holiday_group_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.sla_policy_item
    ADD CONSTRAINT sla_policy_item_work_week_handle_foreign FOREIGN KEY (work_week_handle) REFERENCES public.work_hour_week_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.social_media_item
    ADD CONSTRAINT social_media_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.social_media_item
    ADD CONSTRAINT social_media_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.social_media_type_item(handle);

ALTER TABLE ONLY public.support_queue_item
    ADD CONSTRAINT support_queue_item_default_sla_policy_handle_foreign FOREIGN KEY (default_sla_policy_handle) REFERENCES public.sla_policy_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.support_queue_item
    ADD CONSTRAINT support_queue_item_team_handle_foreign FOREIGN KEY (team_handle) REFERENCES public.support_team_item(handle);

ALTER TABLE ONLY public.system_alert_incident_item
    ADD CONSTRAINT system_alert_incident_item_environment_handle_foreign FOREIGN KEY (environment_handle) REFERENCES public.system_telemetry_environment_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.system_alert_incident_item
    ADD CONSTRAINT system_alert_incident_item_rule_handle_foreign FOREIGN KEY (rule_handle) REFERENCES public.system_alert_rule_item(handle) ON DELETE RESTRICT;

ALTER TABLE ONLY public.system_check_run_item
    ADD CONSTRAINT system_check_run_item_environment_handle_foreign FOREIGN KEY (environment_handle) REFERENCES public.system_telemetry_environment_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.system_error_group_item
    ADD CONSTRAINT system_error_group_item_environment_handle_foreign FOREIGN KEY (environment_handle) REFERENCES public.system_telemetry_environment_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.system_error_occurrence_item
    ADD CONSTRAINT system_error_occurrence_item_environment_handle_foreign FOREIGN KEY (environment_handle) REFERENCES public.system_telemetry_environment_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.system_error_occurrence_item
    ADD CONSTRAINT system_error_occurrence_item_group_handle_foreign FOREIGN KEY (group_handle) REFERENCES public.system_error_group_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.system_error_occurrence_item
    ADD CONSTRAINT system_error_occurrence_item_instance_handle_foreign FOREIGN KEY (instance_handle) REFERENCES public.system_telemetry_instance_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.system_metric_bucket_item
    ADD CONSTRAINT system_metric_bucket_item_instance_handle_foreign FOREIGN KEY (instance_handle) REFERENCES public.system_telemetry_instance_item(handle) ON DELETE CASCADE;

ALTER TABLE ONLY public.system_remediation_execution_item
    ADD CONSTRAINT system_remediation_execution_item_approved_by_handle_foreign FOREIGN KEY (approved_by_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.system_remediation_execution_item
    ADD CONSTRAINT system_remediation_execution_item_environment_handle_foreign FOREIGN KEY (environment_handle) REFERENCES public.system_telemetry_environment_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.system_remediation_execution_item
    ADD CONSTRAINT system_remediation_execution_item_incident_handle_foreign FOREIGN KEY (incident_handle) REFERENCES public.system_alert_incident_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.system_telemetry_instance_item
    ADD CONSTRAINT system_telemetry_instance_item_environment_handle_foreign FOREIGN KEY (environment_handle) REFERENCES public.system_telemetry_environment_item(handle) ON UPDATE CASCADE;

ALTER TABLE ONLY public.teams_delivery_item
    ADD CONSTRAINT teams_delivery_item_created_by_handle_foreign FOREIGN KEY (created_by_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.teams_delivery_item
    ADD CONSTRAINT teams_delivery_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.teams_delivery_item
    ADD CONSTRAINT teams_delivery_item_recipient_person_handle_foreign FOREIGN KEY (recipient_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.teams_delivery_item
    ADD CONSTRAINT teams_delivery_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.teams_delivery_status_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.teams_delivery_item
    ADD CONSTRAINT teams_delivery_item_subscription_handle_foreign FOREIGN KEY (subscription_handle) REFERENCES public.teams_subscription_item(handle);

ALTER TABLE ONLY public.teams_delivery_item
    ADD CONSTRAINT teams_delivery_item_template_handle_foreign FOREIGN KEY (template_handle) REFERENCES public.teams_template_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.teams_subscription_item
    ADD CONSTRAINT teams_subscription_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.teams_subscription_item
    ADD CONSTRAINT teams_subscription_item_source_entity_handle_foreign FOREIGN KEY (source_entity_handle) REFERENCES public.entity_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.teams_subscription_item
    ADD CONSTRAINT teams_subscription_item_template_handle_foreign FOREIGN KEY (template_handle) REFERENCES public.teams_template_item(handle);

ALTER TABLE ONLY public.teams_subscription_item
    ADD CONSTRAINT teams_subscription_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.webhook_subscription_type_item(handle);

ALTER TABLE ONLY public.teams_template_item
    ADD CONSTRAINT teams_template_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.ticket_category_item
    ADD CONSTRAINT ticket_category_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.ticket_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_assignee_company_handle_foreign FOREIGN KEY (assignee_company_handle) REFERENCES public.company_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_assignee_person_handle_foreign FOREIGN KEY (assignee_person_handle) REFERENCES public.person_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_category_handle_foreign FOREIGN KEY (category_handle) REFERENCES public.ticket_category_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_contract_handle_foreign FOREIGN KEY (contract_handle) REFERENCES public.contract_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_creator_company_handle_foreign FOREIGN KEY (creator_company_handle) REFERENCES public.company_item(handle);

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_creator_person_handle_foreign FOREIGN KEY (creator_person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_priority_handle_foreign FOREIGN KEY (priority_handle) REFERENCES public.ticket_priority_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_sales_opportunity_handle_foreign FOREIGN KEY (sales_opportunity_handle) REFERENCES public.sales_opportunity_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_sla_policy_handle_foreign FOREIGN KEY (sla_policy_handle) REFERENCES public.sla_policy_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_source_handle_foreign FOREIGN KEY (source_handle) REFERENCES public.ticket_source_item(handle);

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.ticket_status_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_support_queue_handle_foreign FOREIGN KEY (support_queue_handle) REFERENCES public.support_queue_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_support_team_handle_foreign FOREIGN KEY (support_team_handle) REFERENCES public.support_team_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.ticket_item
    ADD CONSTRAINT ticket_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.ticket_type_item(handle);

ALTER TABLE ONLY public.ticket_time_tracking_item
    ADD CONSTRAINT ticket_time_tracking_item_person_handle_foreign FOREIGN KEY (person_handle) REFERENCES public.person_item(handle);

ALTER TABLE ONLY public.ticket_time_tracking_item
    ADD CONSTRAINT ticket_time_tracking_item_ticket_handle_foreign FOREIGN KEY (ticket_handle) REFERENCES public.ticket_item(handle);

ALTER TABLE ONLY public.translation_item
    ADD CONSTRAINT translation_item_language_handle_foreign FOREIGN KEY (language_handle) REFERENCES public.language_item(handle);

ALTER TABLE ONLY public.webhook_delivery_item
    ADD CONSTRAINT webhook_delivery_item_status_handle_foreign FOREIGN KEY (status_handle) REFERENCES public.webhook_delivery_status_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.webhook_delivery_item
    ADD CONSTRAINT webhook_delivery_item_subscription_handle_foreign FOREIGN KEY (subscription_handle) REFERENCES public.webhook_subscription_item(handle);

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_authentication_api_key_handle_foreign FOREIGN KEY (authentication_api_key_handle) REFERENCES public.webhook_authentication_api_key_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_authentication_basic_handle_foreign FOREIGN KEY (authentication_basic_handle) REFERENCES public.webhook_authentication_basic_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_authentication_oauth2_handle_foreign FOREIGN KEY (authentication_oauth2_handle) REFERENCES public.webhook_authentication_oauth2item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_authentication_type_handle_foreign FOREIGN KEY (authentication_type_handle) REFERENCES public.webhook_authentication_type_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_entity_handle_foreign FOREIGN KEY (entity_handle) REFERENCES public.entity_item(handle);

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_method_handle_foreign FOREIGN KEY (method_handle) REFERENCES public.webhook_subscription_method_item(handle);

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_payload_type_handle_foreign FOREIGN KEY (payload_type_handle) REFERENCES public.webhook_subscription_payload_type(handle);

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_source_entity_handle_foreign FOREIGN KEY (source_entity_handle) REFERENCES public.entity_item(handle) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.webhook_subscription_item
    ADD CONSTRAINT webhook_subscription_item_type_handle_foreign FOREIGN KEY (type_handle) REFERENCES public.webhook_subscription_type_item(handle);

ALTER TABLE ONLY public.work_hour_week_item
    ADD CONSTRAINT work_hour_week_item_friday_handle_foreign FOREIGN KEY (friday_handle) REFERENCES public.work_hour_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.work_hour_week_item
    ADD CONSTRAINT work_hour_week_item_monday_handle_foreign FOREIGN KEY (monday_handle) REFERENCES public.work_hour_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.work_hour_week_item
    ADD CONSTRAINT work_hour_week_item_saturday_handle_foreign FOREIGN KEY (saturday_handle) REFERENCES public.work_hour_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.work_hour_week_item
    ADD CONSTRAINT work_hour_week_item_sunday_handle_foreign FOREIGN KEY (sunday_handle) REFERENCES public.work_hour_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.work_hour_week_item
    ADD CONSTRAINT work_hour_week_item_thursday_handle_foreign FOREIGN KEY (thursday_handle) REFERENCES public.work_hour_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.work_hour_week_item
    ADD CONSTRAINT work_hour_week_item_tuesday_handle_foreign FOREIGN KEY (tuesday_handle) REFERENCES public.work_hour_item(handle) ON DELETE SET NULL;

ALTER TABLE ONLY public.work_hour_week_item
    ADD CONSTRAINT work_hour_week_item_wednesday_handle_foreign FOREIGN KEY (wednesday_handle) REFERENCES public.work_hour_item(handle) ON DELETE SET NULL;`);
  }

  override down(): void {
    this.addSql(`drop table if exists "address_item" cascade;
drop table if exists "company_item_automatic_cc_persons" cascade;
drop table if exists "company_relationship_item" cascade;
drop table if exists "contract_item_products" cascade;
drop table if exists "effort_estimate_position_item" cascade;
drop table if exists "event_azure_item" cascade;
drop table if exists "event_delivery_item" cascade;
drop table if exists "event_google_item" cascade;
drop table if exists "inbound_email_item" cascade;
drop table if exists "person_item_events" cascade;
drop table if exists "event_item" cascade;
drop table if exists "internal_case_item" cascade;
drop table if exists "knowledge_article_item" cascade;
drop table if exists "effort_estimate_item" cascade;
drop table if exists "ticket_time_tracking_item" cascade;
drop table if exists "ticket_item" cascade;
drop table if exists "contract_item" cascade;
drop table if exists "email_list_item_companies" cascade;
drop table if exists "email_delivery_item" cascade;
drop table if exists "ai_agent_run_item" cascade;
drop table if exists "ai_chat_attachment_item" cascade;
drop table if exists "ai_chat_queued_input_item" cascade;
drop table if exists "ai_chat_tool_action_item" cascade;
drop table if exists "ai_chat_transcription_item" cascade;
drop table if exists "ai_chat_message_item" cascade;
drop table if exists "ai_chat_session_item" cascade;
drop table if exists "ai_prompt_version_item" cascade;
drop table if exists "ai_prompt_template_item" cascade;
drop table if exists "ai_usage_event_item" cascade;
drop table if exists "authentication_event_item" cascade;
drop table if exists "automation_execution_item" cascade;
drop table if exists "automation_event_item" cascade;
drop table if exists "calendar_sync_subscription_item" cascade;
drop table if exists "change_log_detail_item" cascade;
drop table if exists "change_log_item" cascade;
drop table if exists "dashboard_item_kpis" cascade;
drop table if exists "dashboard_item" cascade;
drop table if exists "dashboard_template_item_kpis" cascade;
drop table if exists "role_item_starter_dashboard_templates" cascade;
drop table if exists "dashboard_template_item" cascade;
drop table if exists "document_item" cascade;
drop table if exists "email_list_item_persons" cascade;
drop table if exists "email_inbox_subscription_item" cascade;
drop table if exists "email_signature_item" cascade;
drop table if exists "email_subscription_condition_item" cascade;
drop table if exists "email_subscription_item" cascade;
drop table if exists "favorite_item" cascade;
drop table if exists "http_metric_bucket_item" cascade;
drop table if exists "external_record_link_item" cascade;
drop table if exists "import_batch_row_item" cascade;
drop table if exists "import_batch_item" cascade;
drop table if exists "inbox_notification_item" cascade;
drop table if exists "information_item" cascade;
drop table if exists "marketing_campaign_item" cascade;
drop table if exists "note_item" cascade;
drop table if exists "person_item_roles" cascade;
drop table if exists "person_api_token_item" cascade;
drop table if exists "person_passkey_item" cascade;
drop table if exists "person_session_item" cascade;
drop table if exists "phone_call_item" cascade;
drop table if exists "sales_opportunity_item_competitors" cascade;
drop table if exists "sales_opportunity_item" cascade;
drop table if exists "sapling_form_config_item" cascade;
drop table if exists "session_store_item" cascade;
drop table if exists "shared_mailbox_group_item_persons" cascade;
drop table if exists "social_media_item" cascade;
drop table if exists "system_remediation_execution_item" cascade;
drop table if exists "teams_delivery_item" cascade;
drop table if exists "person_item" cascade;
drop table if exists "server_landscape_item" cascade;
drop table if exists "company_item" cascade;
drop table if exists "support_queue_item" cascade;
drop table if exists "sla_policy_item" cascade;
drop table if exists "work_hour_week_item" cascade;
drop table if exists "work_hour_item" cascade;
drop table if exists "field_automation_item" cascade;
drop table if exists "inbox_subscription_item" cascade;
drop table if exists "teams_subscription_item" cascade;
drop table if exists "webhook_delivery_item" cascade;
drop table if exists "webhook_subscription_item" cascade;
drop table if exists "webhook_subscription_type_item" cascade;
drop table if exists "webhook_subscription_payload_type" cascade;
drop table if exists "webhook_subscription_method_item" cascade;
drop table if exists "webhook_delivery_status_item" cascade;
drop table if exists "webhook_authentication_type_item" cascade;
drop table if exists "webhook_authentication_oauth2item" cascade;
drop table if exists "webhook_authentication_basic_item" cascade;
drop table if exists "webhook_authentication_api_key_item" cascade;
drop table if exists "translation_item" cascade;
drop table if exists "ticket_category_item" cascade;
drop table if exists "ticket_type_item" cascade;
drop table if exists "ticket_status_item" cascade;
drop table if exists "ticket_source_item" cascade;
drop table if exists "ticket_priority_item" cascade;
drop table if exists "teams_template_item" cascade;
drop table if exists "teams_delivery_status_item" cascade;
drop table if exists "system_error_occurrence_item" cascade;
drop table if exists "system_metric_bucket_item" cascade;
drop table if exists "system_telemetry_instance_item" cascade;
drop table if exists "system_alert_incident_item" cascade;
drop table if exists "system_check_run_item" cascade;
drop table if exists "system_error_group_item" cascade;
drop table if exists "system_telemetry_environment_item" cascade;
drop table if exists "system_canary_record_item" cascade;
drop table if exists "system_alert_rule_item" cascade;
drop table if exists "support_team_item" cascade;
drop table if exists "social_media_type_item" cascade;
drop table if exists "shared_mailbox_context_item" cascade;
drop table if exists "shared_mailbox_item" cascade;
drop table if exists "shared_mailbox_group_item" cascade;
drop table if exists "server_landscape_type_usage_item" cascade;
drop table if exists "server_landscape_type_item" cascade;
drop table if exists "seed_script_item" cascade;
drop table if exists "script_button_item" cascade;
drop table if exists "sales_opportunity_stage_item" cascade;
drop table if exists "sales_opportunity_source_item" cascade;
drop table if exists "sales_opportunity_result_status_item" cascade;
drop table if exists "sales_opportunity_loss_reason_item" cascade;
drop table if exists "sales_opportunity_forecast_item" cascade;
drop table if exists "ai_agent_item_roles" cascade;
drop table if exists "ai_agent_memory_item_roles" cascade;
drop table if exists "field_permission_item" cascade;
drop table if exists "permission_item" cascade;
drop table if exists "role_item_starter_favorite_templates" cascade;
drop table if exists "role_item" cascade;
drop table if exists "role_stage_item" cascade;
drop table if exists "product_item" cascade;
drop table if exists "person_type_item" cascade;
drop table if exists "person_title_item" cascade;
drop table if exists "person_salutation_item" cascade;
drop table if exists "person_job_title_item" cascade;
drop table if exists "person_function_item" cascade;
drop table if exists "person_department_item" cascade;
drop table if exists "person_decision_role_item" cascade;
drop table if exists "note_group_item" cascade;
drop table if exists "country_item" cascade;
drop table if exists "money_item" cascade;
drop table if exists "mcp_server_config_item" cascade;
drop table if exists "marketing_campaign_type_item" cascade;
drop table if exists "marketing_campaign_status_item" cascade;
drop table if exists "language_item" cascade;
drop table if exists "kpi_item" cascade;
drop table if exists "kpi_type_item" cascade;
drop table if exists "kpi_timeframe_item" cascade;
drop table if exists "kpi_aggregation_item" cascade;
drop table if exists "knowledge_article_visibility_item" cascade;
drop table if exists "knowledge_article_status_item" cascade;
drop table if exists "knowledge_article_category_item" cascade;
drop table if exists "internal_case_status_item" cascade;
drop table if exists "internal_case_category_item" cascade;
drop table if exists "inbox_template_item" cascade;
drop table if exists "inbound_email_status_item" cascade;
drop table if exists "import_template_value_mapping_item" cascade;
drop table if exists "import_template_item" cascade;
drop table if exists "import_source_item" cascade;
drop table if exists "holiday_item" cascade;
drop table if exists "holiday_group_item" cascade;
drop table if exists "global_search_index_item" cascade;
drop table if exists "favorite_template_item" cascade;
drop table if exists "event_type_item" cascade;
drop table if exists "event_status_item" cascade;
drop table if exists "event_delivery_status_item" cascade;
drop table if exists "event_category_item" cascade;
drop table if exists "entity_route_item" cascade;
drop table if exists "ai_entity_generation_template_item" cascade;
drop table if exists "custom_field_value_item" cascade;
drop table if exists "custom_field_definition_item" cascade;
drop table if exists "dvelop_entity_mapping_property_item" cascade;
drop table if exists "dvelop_entity_mapping_search_category_item" cascade;
drop table if exists "dvelop_entity_mapping_item" cascade;
drop table if exists "email_list_item" cascade;
drop table if exists "email_template_item" cascade;
drop table if exists "entity_item" cascade;
drop table if exists "entity_group_item" cascade;
drop table if exists "email_inbox_processing_mode_item" cascade;
drop table if exists "email_delivery_status_item" cascade;
drop table if exists "effort_estimate_status_item" cascade;
drop table if exists "effort_estimate_position_template_item" cascade;
drop table if exists "dvelop_property_item" cascade;
drop table if exists "dvelop_object_definition_item" cascade;
drop table if exists "dvelop_repository_item" cascade;
drop table if exists "dvelop_connection_item" cascade;
drop table if exists "document_type_item" cascade;
drop table if exists "custom_field_type_item" cascade;
drop table if exists "contract_service_item" cascade;
drop table if exists "company_size_item" cascade;
drop table if exists "company_segment_item" cascade;
drop table if exists "company_relationship_type_item" cascade;
drop table if exists "company_industry_item" cascade;
drop table if exists "company_churn_risk_reason_item" cascade;
drop table if exists "company_annual_revenue_class_item" cascade;
drop table if exists "change_log_action_item" cascade;
drop table if exists "ai_vector_document_item" cascade;
drop table if exists "ai_agent_evaluation_item" cascade;
drop table if exists "ai_agent_memory_item" cascade;
drop table if exists "ai_agent_playbook_item" cascade;
drop table if exists "ai_agent_version_item" cascade;
drop table if exists "ai_agent_item" cascade;
drop table if exists "ai_provider_model_item" cascade;
drop table if exists "ai_provider_type_item" cascade;
drop table if exists "address_type_item" cascade;
`);
    this.addSql(`drop function if exists sapling_immutable_prompt_version();`);
  }
}
