import type { AiRuntimeStreamCallbacks } from './ai.types';
import { AiChatInterruptedError } from './ai.types';
import type { DeltaHandler } from './ai-chat-runtime.service';

export function normalizeCallbacks(
  handler: DeltaHandler,
): AiRuntimeStreamCallbacks {
  return typeof handler === 'function' ? { onTextDelta: handler } : handler;
}

export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AiChatInterruptedError();
}

export function normalizeAbortError(
  error: unknown,
  signal?: AbortSignal,
): unknown {
  return signal?.aborted ? new AiChatInterruptedError() : error;
}

export function appendUsageEntry(
  usageEntries: Record<string, unknown>[],
  usage: unknown,
): void {
  if (isRecord(usage)) usageEntries.push({ ...usage });
}

export function buildUsagePayload(
  usageEntries: Record<string, unknown>[],
): Record<string, unknown> | null {
  if (usageEntries.length === 0) return null;
  const inputTokens = sumUsageFields(usageEntries, [
    'inputTokens',
    'input_tokens',
    'promptTokens',
    'promptTokenCount',
    'prompt_tokens',
  ]);
  const outputTokens = sumUsageFields(usageEntries, [
    'outputTokens',
    'output_tokens',
    'completionTokens',
    'candidatesTokenCount',
    'completion_tokens',
  ]);
  const totalTokens = sumUsageFields(usageEntries, [
    'totalTokens',
    'totalTokenCount',
    'total_tokens',
  ]);
  return {
    entries: usageEntries,
    ...(inputTokens != null ? { inputTokens } : {}),
    ...(outputTokens != null ? { outputTokens } : {}),
    ...(totalTokens != null ? { totalTokens } : {}),
  };
}

export function sumUsageFields(
  usageEntries: Record<string, unknown>[],
  keys: string[],
): number | null {
  let total = 0;
  let hasValue = false;
  for (const entry of usageEntries) {
    for (const key of keys) {
      const value = entry[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        total += value;
        hasValue = true;
        break;
      }
    }
  }
  return hasValue ? total : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
