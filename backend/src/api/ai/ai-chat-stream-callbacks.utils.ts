import type { EntityManager } from '@mikro-orm/core';
import { AI_CHAT_STREAM_CHECKPOINT_INTERVAL_MS } from '../../constants/project.constants';
import type { AiAgentRunItem } from '../../entity/AiAgentRunItem';
import type { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import type { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import type { AiAgentRunLifecycleService } from './ai-agent-run-lifecycle.service';
import { buildNavigationLinks } from './ai-navigation.utils';
import { sanitizeChatMessage, sanitizeChatSession } from './ai-response.utils';
import type { McpToolDescriptor } from './mcp.service';
import { toAiToolCallRunTrace } from './ai-tool-trace.utils';
import type {
  AiChatProgressPayload,
  AiExecutedToolCall,
  AiRuntimeStreamCallbacks,
} from './ai.types';

type EventHandler = (event: Record<string, unknown>) => Promise<void> | void;

export async function emitChatStreamStarted(options: {
  onEvent: EventHandler;
  session: AiChatSessionItem;
  userMessage: AiChatMessageItem;
  assistantMessage: AiChatMessageItem;
  availableTools: McpToolDescriptor[];
}): Promise<void> {
  await options.onEvent({
    type: 'session.upsert',
    session: sanitizeChatSession(options.session),
  });
  await options.onEvent({
    type: 'message.user',
    message: sanitizeChatMessage(options.userMessage),
  });
  await options.onEvent({
    type: 'message.assistant',
    message: sanitizeChatMessage(options.assistantMessage),
  });
  await options.onEvent({ type: 'mcp.tools', tools: options.availableTools });
}

export function buildCompletedToolCallRunContext(
  completedToolCalls: AiExecutedToolCall[],
  lifecycle: AiAgentRunLifecycleService,
): Pick<AiAgentRunItem, 'toolCalls' | 'sources'> {
  return {
    toolCalls: completedToolCalls.map((toolCall) =>
      toAiToolCallRunTrace(toolCall),
    ),
    sources: lifecycle.buildSources(
      completedToolCalls,
      buildNavigationLinks(completedToolCalls),
    ),
  };
}

export function createResponseCheckpoint(
  em: EntityManager,
  session: AiChatSessionItem,
): (force?: boolean) => Promise<void> {
  let lastCheckpointAt = Date.now();

  return async (force = false): Promise<void> => {
    const now = Date.now();
    const checkpointInterval = Number.isFinite(
      AI_CHAT_STREAM_CHECKPOINT_INTERVAL_MS,
    )
      ? Math.max(100, AI_CHAT_STREAM_CHECKPOINT_INTERVAL_MS)
      : 750;

    if (!force && now - lastCheckpointAt < checkpointInterval) return;

    session.responseActivityAt = new Date(now);
    await em.flush();
    lastCheckpointAt = now;
  };
}

export function createChatRuntimeCallbacks(options: {
  signal?: AbortSignal;
  assistantMessage: AiChatMessageItem;
  progress: AiChatProgressPayload;
  completedToolCalls: AiExecutedToolCall[];
  getRun: () => AiAgentRunItem | null;
  persistResponseCheckpoint: (force?: boolean) => Promise<void>;
  onEvent: EventHandler;
}): AiRuntimeStreamCallbacks {
  return {
    signal: options.signal,
    onTextDelta: async (delta: string) => {
      if (!delta) return;
      options.assistantMessage.content += delta;
      await options.persistResponseCheckpoint();
      await options.onEvent({
        type: 'message.delta',
        handle: options.assistantMessage.handle,
        delta,
      });
    },
    onReasoningDelta: async (delta: string) => {
      if (!delta) return;
      options.progress.reasoningSummary += delta;
      await options.persistResponseCheckpoint();
      await options.onEvent({
        type: 'progress.delta',
        handle: options.assistantMessage.handle,
        delta,
      });
    },
    onToolCallCompleted: async (toolCall: AiExecutedToolCall) => {
      options.completedToolCalls.push(toolCall);
      const persistedToolCalls = options.completedToolCalls.map((item) =>
        toAiToolCallRunTrace(item),
      );
      options.assistantMessage.toolCalls = persistedToolCalls;
      const run = options.getRun();
      if (run) run.toolCalls = persistedToolCalls;
      await options.persistResponseCheckpoint(true);
    },
  };
}
