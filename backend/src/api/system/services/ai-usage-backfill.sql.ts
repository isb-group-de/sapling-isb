// Only fixed, internal column/key names are passed to this SQL builder.
function tokenValue(keys: string[]): string {
  return `coalesce(${keys
    .map(
      (key) =>
        `case when jsonb_typeof(source.usage->'${key}') = 'number' then greatest(0, round((source.usage->>'${key}')::numeric)) end`,
    )
    .join(', ')})`;
}

export const AI_USAGE_BACKFILL_SQL = `
with source as (
  select 'agentRun:' || run.handle as source_key, run.person_handle,
    coalesce(run.purpose, 'agent') as operation,
    case when run.session_handle is not null or run.purpose = 'markdown'
      then 'interactive' else 'background' end as execution_type,
    coalesce(run.provider, run.usage_payload->>'provider') as provider,
    coalesce(run.model, run.usage_payload->>'model') as model,
    run.status, run.duration_ms, run.usage_payload as usage,
    coalesce(run.completed_at, run.started_at, run.created_at) as occurred_at
  from ai_agent_run_item run
  where coalesce(run.completed_at, run.started_at, run.created_at) >= now() - interval '90 days'
  union all
  select 'transcription:' || transcription.handle, transcription.person_handle,
    'transcription', 'interactive', transcription.provider_handle,
    coalesce(model.provider_model, transcription.response_payload->>'modelHandle'),
    case when transcription.status = 'processing' then 'running' else transcription.status end,
    null::integer, transcription.response_payload->'usage', transcription.created_at
  from ai_chat_transcription_item transcription
  left join ai_provider_model_item model on model.handle = transcription.model_handle
  where transcription.created_at >= now() - interval '90 days'
), normalized as (
  select source.*,
    ${tokenValue(['inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens', 'promptTokenCount'])} as input_tokens,
    ${tokenValue(['outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens', 'candidatesTokenCount'])} as output_tokens,
    ${tokenValue(['totalTokens', 'total_tokens', 'totalTokenCount'])} as reported_total_tokens
  from source
), totals as (
  select normalized.*,
    coalesce(reported_total_tokens,
      case when input_tokens is not null or output_tokens is not null
        then coalesce(input_tokens, 0) + coalesce(output_tokens, 0) end) as total_tokens
  from normalized
), repaired_runs as (
  update ai_agent_run_item run
  set usage_payload = coalesce(run.usage_payload, '{}'::jsonb) || canonical.usage
  from totals
  cross join lateral (select jsonb_strip_nulls(jsonb_build_object(
    'inputTokens', totals.input_tokens, 'outputTokens', totals.output_tokens,
    'totalTokens', totals.total_tokens
  )) as usage) canonical
  where totals.source_key = 'agentRun:' || run.handle
    and canonical.usage <> '{}'::jsonb
    and run.usage_payload is distinct from coalesce(run.usage_payload, '{}'::jsonb) || canonical.usage
  returning run.handle
)
insert into ai_usage_event_item (
  environment_handle, source_key, person_handle, operation, execution_type,
  provider, model, status, duration_ms, input_tokens, output_tokens, total_tokens,
  usage_reported, occurred_at, created_at
)
select ?, source_key, person_handle, operation, execution_type,
  provider, model, status, duration_ms, input_tokens, output_tokens, total_tokens,
  input_tokens is not null or output_tokens is not null or total_tokens is not null,
  occurred_at, now()
from totals
on conflict (source_key) do update set
  person_handle = excluded.person_handle, operation = excluded.operation,
  execution_type = excluded.execution_type,
  provider = excluded.provider, model = excluded.model,
  status = excluded.status, duration_ms = excluded.duration_ms,
  input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens,
  total_tokens = excluded.total_tokens, usage_reported = excluded.usage_reported
`;
