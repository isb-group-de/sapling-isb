import { promptText } from './ai-prompt-context';
import type { PersonItem } from '../../../entity/PersonItem';
import type { McpToolDescriptor } from '../mcp.service';
import type {
  AiClientTimeContext,
  AiToolErrorPayload,
  AiToolRegistryEntry,
} from '../ai.types';

export const AI_SYSTEM_PROMPT_BASE = () =>
  promptText('chat.ai_system_prompt_base');

export const AI_SYSTEM_PROMPT_TOOL_GUIDANCE = () =>
  promptText('chat.ai_system_prompt_tool_guidance');

export const AI_TOOL_RESULT_SECURITY_NOTICE = () =>
  promptText('chat.ai_tool_result_security_notice');

export function buildToolResultEnvelope(data: unknown): {
  source: 'tool';
  trust: 'untrusted-data';
  securityNotice: string;
  data: unknown;
} {
  return {
    source: 'tool',
    trust: 'untrusted-data',
    securityNotice: AI_TOOL_RESULT_SECURITY_NOTICE(),
    data,
  };
}

export function serializeToolResultForModel(
  data: unknown,
  maxCharacters = Number.POSITIVE_INFINITY,
): string {
  let normalizedData = data;

  if (typeof data === 'string') {
    try {
      normalizedData = JSON.parse(data) as unknown;
    } catch {
      normalizedData = data;
    }
  }

  const serialized = JSON.stringify(buildToolResultEnvelope(normalizedData));
  if (serialized.length <= maxCharacters) {
    return serialized;
  }

  const serializedData = JSON.stringify(normalizedData);
  const truncatedData = {
    truncated: true,
    originalCharacters: serialized.length,
    continuationHint:
      'Repeat the tool call with narrower filters, a smaller limit, and successive pages when the complete result is required.',
    preview: '',
  };
  const emptyPreview = JSON.stringify(buildToolResultEnvelope(truncatedData));
  let previewCharacters = Math.max(0, maxCharacters - emptyPreview.length);
  let truncated: string;

  do {
    truncatedData.preview = serializedData.slice(0, previewCharacters);
    truncated = JSON.stringify(buildToolResultEnvelope(truncatedData));
    previewCharacters = Math.max(
      0,
      previewCharacters - Math.max(1, truncated.length - maxCharacters),
    );
  } while (truncated.length > maxCharacters && previewCharacters > 0);

  return truncated;
}

export const AI_SYSTEM_PROMPT_VECTOR_GUIDANCE = () =>
  promptText('chat.ai_system_prompt_vector_guidance');

export const AI_SYSTEM_PROMPT_KNOWLEDGE_GUIDANCE = () =>
  promptText('chat.ai_system_prompt_knowledge_guidance');

export const AI_SYSTEM_PROMPT_WEB_GUIDANCE = () =>
  promptText('chat.ai_system_prompt_web_guidance');

export const AI_ASSISTANT_SPEECH_INSTRUCTIONS = () =>
  promptText('chat.ai_assistant_speech_instructions');

export const AI_MARKDOWN_PREPARATION_INSTRUCTIONS = () =>
  promptText('chat.ai_markdown_preparation_instructions');

export const AI_GEMINI_REPEATED_TOOL_CALL_ABORT_MESSAGE = () =>
  promptText('chat.ai_gemini_repeated_tool_call_abort_message');

export const AI_GEMINI_TOOL_CALL_LIMIT_MESSAGE = () =>
  promptText('chat.ai_gemini_tool_call_limit_message');

export function buildToolFailureAssistantMessage(
  toolErrors: AiToolErrorPayload[],
): string {
  const firstError = toolErrors[0];
  const errorLine = firstError?.error
    ? promptText('chat.text1', { value0: firstError.error })
    : promptText('chat.fragment1');
  const hintLine = firstError?.hints?.[0]
    ? `Hinweis: ${firstError.hints[0]}`
    : promptText('chat.text2');

  return `${errorLine} ${hintLine}`.trim();
}

export function buildSystemInstruction(options?: {
  includeToolGuidance?: boolean;
  user?: PersonItem;
  clientTimeContext?: AiClientTimeContext;
  referenceDate?: Date;
  agentInstruction?: string | null;
}): string {
  const referenceDate = options?.referenceDate ?? new Date();
  const toolInstruction = options?.includeToolGuidance
    ? promptText('chat.text3', {
        value0: AI_SYSTEM_PROMPT_TOOL_GUIDANCE(),
        value1: AI_SYSTEM_PROMPT_VECTOR_GUIDANCE(),
        value2: AI_SYSTEM_PROMPT_KNOWLEDGE_GUIDANCE(),
        value3: AI_SYSTEM_PROMPT_WEB_GUIDANCE(),
      })
    : '';
  const agentInstruction = options?.agentInstruction?.trim()
    ? promptText('chat.fragment2', { value0: options.agentInstruction.trim() })
    : '';
  const responseLanguageInstruction = buildResponseLanguageInstruction(
    options?.user,
  );

  return promptText('chat.text4', {
    value0: AI_SYSTEM_PROMPT_BASE(),
    value1: agentInstruction,
    value2: toolInstruction,
    value3: responseLanguageInstruction,
    value4: buildCurrentDateInstruction(
      referenceDate,
      options?.user,
      options?.clientTimeContext,
    ),
  }).trim();
}

export function buildResponseLanguageInstruction(user?: PersonItem): string {
  const accountLanguage = resolveAccountLanguage(user);
  const configuredLanguage = accountLanguage
    ? ` is ${JSON.stringify(accountLanguage.name)}`
    : '';

  return promptText('chat.text5', { value0: configuredLanguage });
}

export function buildCurrentDateInstruction(
  referenceDate: Date = new Date(),
  user?: PersonItem,
  clientTimeContext?: AiClientTimeContext,
): string {
  const offsetMinutes = -referenceDate.getTimezoneOffset();
  const localeTimeZone = resolveUserTimeZone(user, clientTimeContext);
  const localeName = resolveUserLocale(user, clientTimeContext);
  const clientReferenceDate = clientTimeContext?.currentDate ?? referenceDate;
  const clientReportedLine = clientTimeContext?.currentDate
    ? promptText('chat.text6', {
        value0: clientTimeContext.currentDate.toISOString(),
      })
    : null;
  const clientOffsetLine = Number.isFinite(clientTimeContext?.utcOffsetMinutes)
    ? promptText('chat.text7', {
        value0: formatUtcOffset(clientTimeContext?.utcOffsetMinutes ?? 0),
      })
    : null;

  return [
    promptText('chat.fragment3', { value0: referenceDate.toISOString() }),
    promptText('chat.fragment4', { value0: formatLocalDate(referenceDate) }),
    promptText('chat.fragment5', { value0: formatUtcOffset(offsetMinutes) }),
    clientReportedLine,
    clientOffsetLine,
    promptText('chat.text8', {
      value0: formatZonedDateTime(
        clientReferenceDate,
        localeTimeZone,
        localeName,
      ),
      value1: localeTimeZone,
    }),
    promptText('chat.text9', { value0: localeTimeZone }),
    promptText('chat.text10', {
      value0: localeTimeZone,
      value1: localeTimeZone,
    }),
  ]
    .filter((line): line is string => !!line)
    .join(' ');
}

export function buildToolSummary(availableTools: McpToolDescriptor[]): string {
  if (availableTools.length === 0) {
    return '';
  }

  return promptText('chat.text11', {
    value0: availableTools
      .map((tool) => `${tool.serverName}.${tool.toolName}`)
      .join(', '),
  });
}

export function buildGeminiJsonStringDescription(description: unknown): string {
  const prefix =
    typeof description === 'string' && description.trim()
      ? `${description.trim()} `
      : '';

  return promptText('chat.fragment6', { value0: prefix }).trim();
}

export function buildGeminiToolPayloadDescription(
  entry: AiToolRegistryEntry,
): string {
  const schema = normalizeJsonSchema(entry.descriptor.inputSchema);
  const properties =
    schema?.properties && typeof schema.properties === 'object'
      ? Object.keys(schema.properties)
      : [];
  const propertyHint =
    properties.length > 0
      ? promptText('chat.fragment7', { value0: properties.join(', ') })
      : promptText('chat.fragment8');

  return promptText('chat.fragment9', { value0: propertyHint });
}

export function normalizeJsonSchema(
  schema?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!schema || typeof schema !== 'object') {
    return null;
  }

  const anyOf = Array.isArray(schema.anyOf) ? schema.anyOf : null;

  if (anyOf) {
    const firstObjectSchema = anyOf.find(
      (item): item is Record<string, unknown> =>
        item != null &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).type === 'object',
    );

    if (firstObjectSchema) {
      return normalizeJsonSchema(firstObjectSchema);
    }
  }

  return schema;
}

function resolveUserLocale(
  user?: PersonItem,
  clientTimeContext?: AiClientTimeContext,
): string {
  if (clientTimeContext?.locale?.trim()) {
    return clientTimeContext.locale.trim();
  }

  const languageHandle =
    user?.language && typeof user.language !== 'string'
      ? user.language.handle
      : undefined;

  return languageHandle === 'de' || !languageHandle ? 'de-DE' : languageHandle;
}

function resolveAccountLanguage(user?: PersonItem): { name: string } | null {
  const language = user?.language as unknown;

  if (language && typeof language === 'object') {
    const languageRecord = language as { name?: unknown };
    const name =
      typeof languageRecord.name === 'string' ? languageRecord.name.trim() : '';

    if (name) {
      return { name };
    }
  }

  return null;
}

function resolveUserTimeZone(
  user?: PersonItem,
  clientTimeContext?: AiClientTimeContext,
): string {
  if (isValidTimeZone(clientTimeContext?.timeZone)) {
    return clientTimeContext.timeZone?.trim() ?? 'UTC';
  }

  void user;
  const serverTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(serverTimeZone) ? serverTimeZone : 'UTC';
}

function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(Math.trunc(offsetMinutes));
  const hours = Math.floor(absoluteMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (absoluteMinutes % 60).toString().padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatZonedDateTime(
  date: Date,
  timeZone: string,
  locale: string,
): string {
  const offset = formatTimeZoneOffset(date, timeZone);
  const dateTime = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

  return `${dateTime} UTC${offset}`;
}

function formatTimeZoneOffset(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const offset = parts.find((part) => part.type === 'timeZoneName')?.value;
  const match = offset?.match(/GMT([+-]\d{2}:\d{2})/);

  return match?.[1] ?? '+00:00';
}

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}
