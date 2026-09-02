import type { Content } from '@google/generative-ai';
import type { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import type { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';
import type { PersonItem } from '../../entity/PersonItem';
import { createOpenAiClient } from './openai-ai.runtime';
import { McpService, type McpToolDescriptor } from './mcp.service';
import type {
  AiClientTimeContext,
  AiExecutedToolCall,
  AiRuntimeStreamCallbacks,
  AiStreamResult,
  AiToolErrorPayload,
  AiToolRegistryEntry,
} from './ai.types';
import { AiChatInterruptedError } from './ai.types';
import type {
  AiRuntimeToolExecutor,
  DeltaHandler,
} from './ai-chat-runtime.service';
import {
  buildOpenAiResponsesTools,
  buildOpenAiTools,
  buildToolRegistry,
  buildUnknownToolError,
  parseToolArguments,
  resolveToolRegistryEntry,
} from './ai-tool-call.utils';
import { buildAiExecutedToolCallTrace } from './ai-tool-trace.utils';
import { extractClientTimeContextFromHistory } from './ai-client-time.utils';
import {
  buildSystemInstruction,
  buildToolFailureAssistantMessage,
  serializeToolResultForModel,
} from './prompts/ai.prompts';

export class AiChatRuntimeOperations {
  constructor(protected readonly mcpService: McpService) {}

  buildSystemInstruction(options?: {
    includeToolGuidance?: boolean;
    user?: PersonItem;
    clientTimeContext?: AiClientTimeContext;
    agentInstruction?: string | null;
  }): string {
    return buildSystemInstruction({
      includeToolGuidance: options?.includeToolGuidance,
      user: options?.user,
      clientTimeContext: options?.clientTimeContext,
      agentInstruction: options?.agentInstruction,
      referenceDate: new Date(),
    });
  }

  async executeAutomaticToolCall(
    toolRegistry: AiToolRegistryEntry[],
    encodedName: string,
    args: Record<string, unknown>,
    user: PersonItem,
  ) {
    const entry = resolveToolRegistryEntry(toolRegistry, encodedName);
    if (!entry) throw new Error(`ai.toolNotFound:${encodedName}`);
    return this.mcpService.executeTool(
      entry.descriptor.serverName,
      entry.descriptor.toolName,
      args,
      user,
    );
  }

  protected async streamOpenAiResponses(options: {
    history: AiChatMessageItem[];
    provider: AiProviderTypeItem;
    model: string;
    availableTools: McpToolDescriptor[];
    user: PersonItem;
    maxToolCallIterations: number;
    clientTimeContext?: AiClientTimeContext;
    callbacks: AiRuntimeStreamCallbacks;
    supportsTools: boolean;
    agentInstruction?: string | null;
    toolExecutor?: AiRuntimeToolExecutor;
    supportsReasoningSummary: boolean;
  }): Promise<AiStreamResult> {
    const toolRegistry = options.supportsTools
      ? buildToolRegistry(options.availableTools)
      : [];
    const input = this.normalizeHistory(options.history).map((message) => ({
      role: message.role,
      content: this.buildMessageContent(message),
    })) as Array<Record<string, unknown>>;
    const executedToolCalls: AiExecutedToolCall[] = [];
    const usageEntries: Record<string, unknown>[] = [];
    let consecutiveUnknownToolIterations = 0;

    for (
      let iteration = 0;
      iteration < options.maxToolCallIterations;
      iteration += 1
    ) {
      assertNotAborted(options.callbacks.signal);
      const stream = await createOpenAiClient(
        options.provider,
      ).responses.create(
        {
          model: options.model,
          instructions: this.buildSystemInstruction({
            includeToolGuidance: toolRegistry.length > 0,
            user: options.user,
            clientTimeContext:
              options.clientTimeContext ??
              extractClientTimeContextFromHistory(options.history),
            agentInstruction: options.agentInstruction,
          }),
          input: input as never,
          stream: true,
          store: false,
          include: ['reasoning.encrypted_content' as const],
          ...(toolRegistry.length > 0
            ? {
                tools: buildOpenAiResponsesTools(toolRegistry),
                tool_choice: 'auto' as const,
              }
            : {}),
          ...(options.supportsReasoningSummary
            ? {
                reasoning: { summary: 'auto' as const },
              }
            : {}),
        },
        { signal: options.callbacks.signal },
      );
      let completedResponse: Record<string, unknown> | null = null;

      for await (const event of stream) {
        assertNotAborted(options.callbacks.signal);
        if (event.type === 'response.output_text.delta') {
          await options.callbacks.onTextDelta(event.delta);
        } else if (event.type === 'response.reasoning_summary_text.delta') {
          await options.callbacks.onReasoningDelta?.(event.delta);
        } else if (event.type === 'response.completed') {
          completedResponse = event.response as unknown as Record<
            string,
            unknown
          >;
        } else if (event.type === 'response.failed') {
          throw new Error('ai.providerResponseFailed');
        }
      }
      if (!completedResponse) throw new Error('ai.emptyResponse');
      appendUsageEntry(usageEntries, completedResponse.usage);
      const output = Array.isArray(completedResponse.output)
        ? (completedResponse.output as Array<Record<string, unknown>>)
        : [];
      input.push(...output);
      const functionCalls = output.filter(
        (item) => item.type === 'function_call',
      );
      if (functionCalls.length === 0) {
        return {
          toolCalls: executedToolCalls,
          usagePayload: buildUsagePayload(usageEntries),
        };
      }
      let unknownToolCount = 0;
      const unknownToolErrors: AiToolErrorPayload[] = [];
      for (const functionCall of functionCalls) {
        assertNotAborted(options.callbacks.signal);
        const name =
          typeof functionCall.name === 'string' ? functionCall.name : '';
        const entry = resolveToolRegistryEntry(toolRegistry, name);
        if (!entry) {
          const toolError = buildUnknownToolError(toolRegistry, name);
          unknownToolCount += 1;
          unknownToolErrors.push(toolError);
          input.push({
            type: 'function_call_output',
            call_id:
              typeof functionCall.call_id === 'string'
                ? functionCall.call_id
                : '',
            output: serializeToolResultForModel(toolError),
          });
          continue;
        }
        const serializedArguments =
          typeof functionCall.arguments === 'string'
            ? functionCall.arguments
            : '{}';
        const args = parseToolArguments(serializedArguments);
        const execution = await this.executeTool(
          entry,
          args,
          options.user,
          iteration,
          toolRegistry,
          options.toolExecutor,
        );
        executedToolCalls.push(execution.trace);
        input.push({
          type: 'function_call_output',
          call_id:
            typeof functionCall.call_id === 'string'
              ? functionCall.call_id
              : '',
          output: serializeToolResultForModel(execution.result.content),
        });
      }
      consecutiveUnknownToolIterations =
        unknownToolCount === functionCalls.length
          ? consecutiveUnknownToolIterations + 1
          : 0;
      if (consecutiveUnknownToolIterations >= 2) {
        await options.callbacks.onTextDelta(
          buildToolFailureAssistantMessage(unknownToolErrors),
        );
        return {
          toolCalls: executedToolCalls,
          usagePayload: buildUsagePayload(usageEntries),
        };
      }
    }
    throw new Error('ai.toolCallLimitExceeded');
  }

  protected async streamOpenAiCompatible(options: {
    history: AiChatMessageItem[];
    provider: AiProviderTypeItem;
    model: string;
    availableTools: McpToolDescriptor[];
    user: PersonItem;
    maxToolCallIterations: number;
    clientTimeContext?: AiClientTimeContext;
    callbacks: AiRuntimeStreamCallbacks;
    supportsTools: boolean;
    agentInstruction?: string | null;
    toolExecutor?: AiRuntimeToolExecutor;
  }): Promise<AiStreamResult> {
    const toolRegistry = options.supportsTools
      ? buildToolRegistry(options.availableTools)
      : [];
    const messages = this.buildOpenAiMessages(
      options.history,
      options.user,
      options.clientTimeContext,
      toolRegistry.length > 0,
      options.agentInstruction,
    );
    const executedToolCalls: AiExecutedToolCall[] = [];
    const usageEntries: Record<string, unknown>[] = [];
    let consecutiveUnknownToolIterations = 0;

    for (
      let iteration = 0;
      iteration < options.maxToolCallIterations;
      iteration += 1
    ) {
      assertNotAborted(options.callbacks.signal);
      const response = await createOpenAiClient(
        options.provider,
      ).chat.completions.create(
        {
          model: options.model,
          messages: messages as never,
          stream: true,
          stream_options: { include_usage: true },
          ...(toolRegistry.length > 0
            ? {
                tools: buildOpenAiTools(toolRegistry),
                tool_choice: 'auto' as const,
              }
            : {}),
        },
        { signal: options.callbacks.signal },
      );
      const toolCalls = new Map<
        number,
        { id: string; name: string; arguments: string }
      >();
      let receivedFinishReason = false;
      try {
        for await (const chunk of response) {
          assertNotAborted(options.callbacks.signal);
          appendUsageEntry(usageEntries, chunk.usage);
          receivedFinishReason ||= chunk.choices.some(
            (choice) => choice.finish_reason != null,
          );
          const delta = chunk.choices[0]?.delta;
          if (delta?.content)
            await options.callbacks.onTextDelta(delta.content);
          for (const callDelta of delta?.tool_calls ?? []) {
            const current = toolCalls.get(callDelta.index) ?? {
              id: '',
              name: '',
              arguments: '',
            };
            current.id = callDelta.id ?? current.id;
            current.name = callDelta.function?.name ?? current.name;
            current.arguments += callDelta.function?.arguments ?? '';
            toolCalls.set(callDelta.index, current);
          }
        }
      } catch (error) {
        assertNotAborted(options.callbacks.signal);
        if (!receivedFinishReason) throw error;
      }
      if (toolCalls.size === 0) {
        return {
          toolCalls: executedToolCalls,
          usagePayload: buildUsagePayload(usageEntries),
        };
      }
      const calls = [...toolCalls.values()];
      messages.push({
        role: 'assistant',
        content: '',
        tool_calls: calls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        })),
      });
      let unknownToolCount = 0;
      const unknownToolErrors: AiToolErrorPayload[] = [];
      for (const call of calls) {
        const entry = resolveToolRegistryEntry(toolRegistry, call.name);
        if (!entry) {
          const toolError = buildUnknownToolError(toolRegistry, call.name);
          unknownToolCount += 1;
          unknownToolErrors.push(toolError);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: serializeToolResultForModel(toolError),
          });
          continue;
        }
        const args = parseToolArguments(call.arguments);
        const execution = await this.executeTool(
          entry,
          args,
          options.user,
          iteration,
          toolRegistry,
          options.toolExecutor,
        );
        executedToolCalls.push(execution.trace);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: serializeToolResultForModel(execution.result.content),
        });
      }
      consecutiveUnknownToolIterations =
        unknownToolCount === calls.length
          ? consecutiveUnknownToolIterations + 1
          : 0;
      if (consecutiveUnknownToolIterations >= 2) {
        await options.callbacks.onTextDelta(
          buildToolFailureAssistantMessage(unknownToolErrors),
        );
        return {
          toolCalls: executedToolCalls,
          usagePayload: buildUsagePayload(usageEntries),
        };
      }
    }
    throw new Error('ai.toolCallLimitExceeded');
  }

  protected async executeTool(
    entry: AiToolRegistryEntry,
    args: Record<string, unknown>,
    user: PersonItem,
    iteration: number,
    toolRegistry: AiToolRegistryEntry[],
    toolExecutor?: AiRuntimeToolExecutor,
  ) {
    const startedAt = Date.now();
    const result = toolExecutor
      ? await toolExecutor(entry, args)
      : await this.executeAutomaticToolCall(
          toolRegistry,
          entry.encodedName,
          args,
          user,
        );
    return {
      result,
      trace: buildAiExecutedToolCallTrace(result, {
        arguments: args,
        iteration: iteration + 1,
        startedAt,
      }),
    };
  }

  protected buildOpenAiMessages(
    history: AiChatMessageItem[],
    user?: PersonItem,
    clientTimeContext?: AiClientTimeContext,
    includeToolGuidance = true,
    agentInstruction?: string | null,
  ) {
    const messages: Array<Record<string, unknown>> = [
      {
        role: 'system',
        content: this.buildSystemInstruction({
          includeToolGuidance,
          user,
          clientTimeContext:
            clientTimeContext ?? extractClientTimeContextFromHistory(history),
          agentInstruction,
        }),
      },
    ];
    for (const message of this.normalizeHistory(history)) {
      messages.push({
        role: message.role,
        content: this.buildMessageContent(message),
      });
    }
    return messages;
  }

  protected buildGeminiConversation(history: AiChatMessageItem[]): Content[] {
    return this.normalizeHistory(history).map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: this.buildMessageContent(message) }],
    }));
  }

  protected normalizeHistory(
    history: AiChatMessageItem[],
  ): AiChatMessageItem[] {
    return history.filter((message) => {
      if (message.role !== 'user' && message.role !== 'assistant') return false;
      return !(
        message.role === 'assistant' &&
        message.status === 'streaming' &&
        !message.content.trim()
      );
    });
  }

  protected buildMessageContent(message: AiChatMessageItem): string {
    if (
      message.role === 'assistant' &&
      isRecord(message.responsePayload) &&
      message.responsePayload.source === 'mcp-inline-tool'
    ) {
      return serializeToolResultForModel(message.content);
    }

    const contextPrefix =
      message.role === 'user' && message.contextPayload
        ? `\n\nContext: ${JSON.stringify(message.contextPayload)}`
        : '';
    return `${message.content}${contextPrefix}`;
  }
}

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
