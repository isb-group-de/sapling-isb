import { Injectable } from '@nestjs/common';
import type { FunctionCall, Part } from '@google/generative-ai';
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
import {
  buildGeminiFunctionDeclarations,
  buildToolCallSignature,
  buildToolRegistry,
  buildUnknownToolError,
  isToolErrorPayload,
  normalizeFunctionCallArgs,
  resolveToolRegistryEntry,
} from './ai-tool-call.utils';
import {
  AI_GEMINI_REPEATED_TOOL_CALL_ABORT_MESSAGE,
  AI_GEMINI_TOOL_CALL_LIMIT_MESSAGE,
  buildToolResultEnvelope,
  buildToolFailureAssistantMessage,
} from './prompts/ai.prompts';
import {
  AiChatRuntimeOperations,
  appendUsageEntry,
  assertNotAborted,
  buildUsagePayload,
  isRecord,
  normalizeAbortError,
  normalizeCallbacks,
} from './ai-chat-runtime.operations';

export type AiRuntimeToolExecutor = (
  entry: AiToolRegistryEntry,
  args: Record<string, unknown>,
) => Promise<AiRuntimeToolExecution>;
type AiRuntimeToolExecution = Awaited<
  ReturnType<AiChatRuntimeService['executeAutomaticToolCall']>
>;
export type DeltaHandler =
  ((delta: string) => Promise<void>) | AiRuntimeStreamCallbacks;

@Injectable()
export class AiChatRuntimeService extends AiChatRuntimeOperations {
  constructor(mcpService: McpService) {
    super(mcpService);
  }

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
                response: buildToolResultEnvelope(toolError),
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
              response: buildToolResultEnvelope(execution.result.modelResult),
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
}
