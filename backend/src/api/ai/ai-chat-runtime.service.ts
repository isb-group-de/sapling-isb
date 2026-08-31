import { Injectable } from '@nestjs/common';
import type { Content, FunctionCall, Part } from '@google/generative-ai';
import type { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import type { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';
import type { PersonItem } from '../../entity/PersonItem';
import {
  createGeminiClient,
  createGeminiStreamingClient,
} from './gemini-ai.runtime';
import { createOpenAiClient } from './openai-ai.runtime';
import { McpService, type McpToolDescriptor } from './mcp.service';
import type {
  AiClientTimeContext,
  AiExecutedToolCall,
  AiProviderKind,
  AiRuntimeStreamCallbacks,
  AiStreamResult,
  AiToolErrorPayload,
  AiToolRegistryEntry,
} from './ai.types';
import { AiChatInterruptedError } from './ai.types';
import {
  buildGeminiFunctionDeclarations,
  buildOpenAiResponsesTools,
  buildOpenAiTools,
  buildToolCallSignature,
  buildToolRegistry,
  buildUnknownToolError,
  isToolErrorPayload,
  normalizeFunctionCallArgs,
  parseToolArguments,
  resolveToolRegistryEntry,
} from './ai-tool-call.utils';
import { buildAiExecutedToolCallTrace } from './ai-tool-trace.utils';
import { extractClientTimeContextFromHistory } from './ai-client-time.utils';
import {
  AI_GEMINI_REPEATED_TOOL_CALL_ABORT_MESSAGE,
  AI_GEMINI_TOOL_CALL_LIMIT_MESSAGE,
  buildSystemInstruction,
  buildToolFailureAssistantMessage,
} from './prompts/ai.prompts';

type AiRuntimeToolExecutor = (
  entry: AiToolRegistryEntry,
  args: Record<string, unknown>,
) => Promise<AiRuntimeToolExecution>;
type AiRuntimeToolExecution = Awaited<
  ReturnType<AiChatRuntimeService['executeAutomaticToolCall']>
>;
type DeltaHandler =
  ((delta: string) => Promise<void>) | AiRuntimeStreamCallbacks;

@Injectable()
export class AiChatRuntimeService {
  constructor(private readonly mcpService: McpService) {}

  async completeText(options: {
    provider: AiProviderTypeItem;
    providerKind: AiProviderKind;
    model: string;
    systemInstruction: string;
    prompt: string;
  }): Promise<string> {
    if (options.providerKind === 'gemini') {
      const generativeModel = createGeminiClient(
        options.provider,
      ).getGenerativeModel({
        model: options.model,
        systemInstruction: options.systemInstruction,
      });
      const result = await generativeModel.generateContent(options.prompt);
      return result.response.text();
    }

    const response = await createOpenAiClient(
      options.provider,
    ).chat.completions.create({
      model: options.model,
      messages: [
        { role: 'system', content: options.systemInstruction },
        { role: 'user', content: options.prompt },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('ai.emptyResponse');
    return content;
  }

  async streamOpenAi(
    history: AiChatMessageItem[],
    provider: AiProviderTypeItem,
    model: string,
    availableTools: McpToolDescriptor[],
    user: PersonItem,
    maxToolCallIterations: number,
    clientTimeContext: AiClientTimeContext | undefined,
    handler: DeltaHandler,
    supportsTools = true,
    agentInstruction?: string | null,
    toolExecutor?: AiRuntimeToolExecutor,
    supportsReasoningSummary = false,
  ): Promise<AiStreamResult> {
    const callbacks = normalizeCallbacks(handler);
    try {
      if (provider.handle === 'openai') {
        return await this.streamOpenAiResponses({
          history,
          provider,
          model,
          availableTools,
          user,
          maxToolCallIterations,
          clientTimeContext,
          callbacks,
          supportsTools,
          agentInstruction,
          toolExecutor,
          supportsReasoningSummary,
        });
      }
      return await this.streamOpenAiCompatible({
        history,
        provider,
        model,
        availableTools,
        user,
        maxToolCallIterations,
        clientTimeContext,
        callbacks,
        supportsTools,
        agentInstruction,
        toolExecutor,
      });
    } catch (error) {
      throw normalizeAbortError(error, callbacks.signal);
    }
  }

  async streamGemini(
    history: AiChatMessageItem[],
    provider: AiProviderTypeItem,
    modelName: string,
    availableTools: McpToolDescriptor[],
    user: PersonItem,
    maxToolCallIterations: number,
    clientTimeContext: AiClientTimeContext | undefined,
    handler: DeltaHandler,
    supportsTools = true,
    agentInstruction?: string | null,
    toolExecutor?: AiRuntimeToolExecutor,
    supportsReasoningSummary = false,
  ): Promise<AiStreamResult> {
    const callbacks = normalizeCallbacks(handler);
    const toolRegistry = supportsTools ? buildToolRegistry(availableTools) : [];
    const conversation = this.buildGeminiConversation(history);
    const executedToolCalls: AiExecutedToolCall[] = [];
    const usageEntries: Record<string, unknown>[] = [];
    const repeatedCallCounts = new Map<string, number>();
    let consecutiveToolErrorIterations = 0;

    try {
      for (
        let iteration = 0;
        iteration < maxToolCallIterations;
        iteration += 1
      ) {
        assertNotAborted(callbacks.signal);
        const stream = await createGeminiStreamingClient(
          provider,
        ).models.generateContentStream({
          model: modelName,
          contents: conversation as never,
          config: {
            systemInstruction: this.buildSystemInstruction({
              includeToolGuidance: toolRegistry.length > 0,
              user,
              clientTimeContext,
              agentInstruction,
            }),
            ...(toolRegistry.length > 0
              ? {
                  tools: [
                    {
                      functionDeclarations:
                        buildGeminiFunctionDeclarations(toolRegistry),
                    },
                  ],
                }
              : {}),
            ...(supportsReasoningSummary
              ? { thinkingConfig: { includeThoughts: true } }
              : {}),
            ...(callbacks.signal ? { abortSignal: callbacks.signal } : {}),
          } as never,
        });
        const responseParts: Array<Record<string, unknown>> = [];
        const functionCalls: FunctionCall[] = [];
        const roundFunctionCallSignatures = new Set<string>();
        let roundUsage: Record<string, unknown> | null = null;

        for await (const chunk of stream) {
          assertNotAborted(callbacks.signal);
          if (isRecord(chunk.usageMetadata)) roundUsage = chunk.usageMetadata;
          const parts = chunk.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            responseParts.push(part as Record<string, unknown>);
            if (part.functionCall) {
              const functionCall = part.functionCall as FunctionCall;
              const signature = buildToolCallSignature(
                functionCall.name,
                normalizeFunctionCallArgs(functionCall),
              );
              if (!roundFunctionCallSignatures.has(signature)) {
                roundFunctionCallSignatures.add(signature);
                functionCalls.push(functionCall);
              }
            } else if (part.text) {
              if (part.thought) await callbacks.onReasoningDelta?.(part.text);
              else await callbacks.onTextDelta(part.text);
            }
          }
        }
        appendUsageEntry(usageEntries, roundUsage);
        conversation.push({ role: 'model', parts: responseParts } as never);
        if (functionCalls.length === 0) {
          return {
            toolCalls: executedToolCalls,
            usagePayload: buildUsagePayload(usageEntries),
          };
        }

        const functionResponses: Part[] = [];
        const toolErrors: AiToolErrorPayload[] = [];
        for (const functionCall of functionCalls) {
          assertNotAborted(callbacks.signal);
          const args = normalizeFunctionCallArgs(functionCall);
          const signature = buildToolCallSignature(functionCall.name, args);
          const repeatedCount = (repeatedCallCounts.get(signature) ?? 0) + 1;
          repeatedCallCounts.set(signature, repeatedCount);
          if (repeatedCount > 2) {
            await callbacks.onTextDelta(
              AI_GEMINI_REPEATED_TOOL_CALL_ABORT_MESSAGE,
            );
            return {
              toolCalls: executedToolCalls,
              usagePayload: buildUsagePayload(usageEntries),
            };
          }
          const entry = resolveToolRegistryEntry(
            toolRegistry,
            functionCall.name,
          );
          if (!entry) {
            const toolError = buildUnknownToolError(
              toolRegistry,
              functionCall.name,
            );
            toolErrors.push(toolError);
            functionResponses.push({
              functionResponse: {
                name: functionCall.name,
                response: { content: toolError },
              },
            });
            continue;
          }
          const execution = await this.executeTool(
            entry,
            args,
            user,
            iteration,
            toolRegistry,
            toolExecutor,
          );
          executedToolCalls.push(execution.trace);
          if (isToolErrorPayload(execution.result.rawResult))
            toolErrors.push(execution.result.rawResult);
          functionResponses.push({
            functionResponse: {
              name: functionCall.name,
              response: { content: execution.result.modelResult },
            },
          });
        }
        consecutiveToolErrorIterations =
          toolErrors.length === functionCalls.length
            ? consecutiveToolErrorIterations + 1
            : 0;
        if (consecutiveToolErrorIterations >= 2) {
          await callbacks.onTextDelta(
            buildToolFailureAssistantMessage(toolErrors),
          );
          return {
            toolCalls: executedToolCalls,
            usagePayload: buildUsagePayload(usageEntries),
          };
        }
        conversation.push({ role: 'user', parts: functionResponses });
      }
      await callbacks.onTextDelta(AI_GEMINI_TOOL_CALL_LIMIT_MESSAGE);
      return {
        toolCalls: executedToolCalls,
        usagePayload: buildUsagePayload(usageEntries),
      };
    } catch (error) {
      throw normalizeAbortError(error, callbacks.signal);
    }
  }

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

  private async streamOpenAiResponses(options: {
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
            output: JSON.stringify(toolError),
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
          output: execution.result.content,
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

  private async streamOpenAiCompatible(options: {
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
            content: JSON.stringify(toolError),
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
          content: execution.result.content,
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

  private async executeTool(
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

  private buildOpenAiMessages(
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

  private buildGeminiConversation(history: AiChatMessageItem[]): Content[] {
    return this.normalizeHistory(history).map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: this.buildMessageContent(message) }],
    }));
  }

  private normalizeHistory(history: AiChatMessageItem[]): AiChatMessageItem[] {
    return history.filter((message) => {
      if (message.role !== 'user' && message.role !== 'assistant') return false;
      return !(
        message.role === 'assistant' &&
        message.status === 'streaming' &&
        !message.content.trim()
      );
    });
  }

  private buildMessageContent(message: AiChatMessageItem): string {
    const contextPrefix =
      message.role === 'user' && message.contextPayload
        ? `\n\nContext: ${JSON.stringify(message.contextPayload)}`
        : '';
    return `${message.content}${contextPrefix}`;
  }
}

function normalizeCallbacks(handler: DeltaHandler): AiRuntimeStreamCallbacks {
  return typeof handler === 'function' ? { onTextDelta: handler } : handler;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AiChatInterruptedError();
}

function normalizeAbortError(error: unknown, signal?: AbortSignal): unknown {
  return signal?.aborted ? new AiChatInterruptedError() : error;
}

function appendUsageEntry(
  usageEntries: Record<string, unknown>[],
  usage: unknown,
): void {
  if (isRecord(usage)) usageEntries.push({ ...usage });
}

function buildUsagePayload(
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

function sumUsageFields(
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
