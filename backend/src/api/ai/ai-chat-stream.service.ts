import { EntityManager } from '@mikro-orm/core';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { PersonItem } from '../../entity/PersonItem';
import { AiAgentContextService } from './ai-agent-context.service';
import { AiAgentRunLifecycleService } from './ai-agent-run-lifecycle.service';
import { extractClientTimeContext } from './ai-client-time.utils';
import { AiChatPersistenceService } from './ai-chat-persistence.service';
import { AiChatRuntimeService } from './ai-chat-runtime.service';
import { AiChatSessionService } from './ai-chat-session.service';
import { AiChatToolActionService } from './ai-chat-tool-action.service';
import {
  alignAssistantContentWithNavigationLinks,
  buildNavigationLinks,
} from './ai-navigation.utils';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import {
  extractModelHandle,
  extractProviderHandle,
  sanitizeAgentPlaybook,
  sanitizeAgentRun,
  sanitizeAgentVersion,
  sanitizeChatMessage,
  sanitizeChatSession,
  sanitizeToolAction,
} from './ai-response.utils';
import { resolveMaxToolCallIterations } from './ai-tool-call.utils';
import {
  buildAiExecutedToolCallTrace,
  toAiToolCallRunTrace,
} from './ai-tool-trace.utils';
import type { AiStreamResult } from './ai.types';
import { CreateAiChatMessageDto } from './dto/chat.dto';
import { McpService } from './mcp.service';

@Injectable()
export class AiChatStreamService {
  constructor(
    private readonly em: EntityManager,
    @Inject(forwardRef(() => McpService))
    private readonly mcpService: McpService,
    private readonly providerRegistry: AiProviderRegistryService,
    private readonly chatRuntime: AiChatRuntimeService,
    private readonly agentRunLifecycle: AiAgentRunLifecycleService,
    private readonly agentContext: AiAgentContextService,
    private readonly chatPersistence: AiChatPersistenceService,
    private readonly chatSession: AiChatSessionService,
    private readonly toolActions: AiChatToolActionService,
  ) {}

  async streamChatMessage(
    dto: CreateAiChatMessageDto,
    user: PersonItem,
    onEvent: (event: Record<string, unknown>) => Promise<void> | void,
  ): Promise<{
    session: AiChatSessionItem;
    userMessage: AiChatMessageItem;
    assistantMessage: AiChatMessageItem;
  }> {
    const person = await this.chatPersistence.requireManagedUser(user);
    const session = dto.sessionHandle
      ? await this.chatPersistence.findOwnedSession(dto.sessionHandle, user)
      : await this.chatSession.createManagedChatSession(
          {
            title:
              dto.sessionTitle ??
              this.chatSession.buildSessionTitle(dto.content),
            providerHandle: dto.providerHandle,
            modelHandle: dto.modelHandle,
            agentHandle: dto.agentHandle,
            agentVersionHandle: dto.agentVersionHandle,
            playbookHandle: dto.playbookHandle,
            contextEntityHandle: dto.contextEntityHandle,
            contextRecordHandle: dto.contextRecordHandle,
          },
          user,
        );

    const nextSequence = await this.chatPersistence.getNextSequence(
      session.handle ?? 0,
    );
    const runtimeContext = await this.agentContext.resolveAgentRuntimeContext(
      dto.agentHandle,
      dto.agentVersionHandle,
      dto.playbookHandle,
      dto.contextEntityHandle ?? session.contextEntityHandle ?? null,
      dto.contextRecordHandle ?? session.contextRecordHandle ?? null,
      session,
      user,
    );
    const runtimeTarget = await this.providerRegistry.resolveRuntimeTarget(
      dto.providerHandle ??
        extractProviderHandle(runtimeContext.version?.provider) ??
        extractProviderHandle(runtimeContext.agent?.provider) ??
        extractProviderHandle(session.provider),
      dto.modelHandle ??
        extractModelHandle(runtimeContext.version?.model) ??
        extractModelHandle(runtimeContext.agent?.model) ??
        extractModelHandle(session.model),
    );
    const availableTools = await this.mcpService.listActiveTools(
      user,
      runtimeContext.toolPolicy,
    );
    const clientTimeContext = extractClientTimeContext(dto);
    const attachments =
      await this.chatPersistence.resolveChatAttachmentsForMessage(
        dto.attachmentHandles,
        session,
        user,
      );
    const attachmentContext =
      this.chatPersistence.buildChatAttachmentContext(attachments);

    const userMessage = this.em.create(AiChatMessageItem, {
      session,
      person,
      role: 'user',
      status: 'persisted',
      sequence: nextSequence,
      content: dto.content,
      contextPayload: this.chatPersistence.mergeMessageContextPayload(
        dto.contextPayload,
        attachmentContext,
      ),
      provider: runtimeTarget.provider.handle,
      model: runtimeTarget.model.providerModel,
      url: dto.url ?? null,
      routeName: dto.routeName ?? null,
      pageTitle: dto.pageTitle ?? null,
      requestPayload: {
        routeName: dto.routeName ?? null,
        url: dto.url ?? null,
        pageTitle: dto.pageTitle ?? null,
        transcriptionHandle: dto.transcriptionHandle ?? null,
        attachmentHandles: attachments.map(
          (attachment) => attachment.handle ?? 0,
        ),
        importAttachments: attachmentContext,
        clientCurrentDateTime:
          clientTimeContext?.currentDate?.toISOString() ?? null,
        clientTimeZone: clientTimeContext?.timeZone ?? null,
        clientLocale: clientTimeContext?.locale ?? null,
        clientUtcOffsetMinutes: clientTimeContext?.utcOffsetMinutes ?? null,
        contextPayload: {
          ...(dto.contextPayload ?? {}),
          importAttachments: attachmentContext,
          contextEntityHandle:
            dto.contextEntityHandle ?? session.contextEntityHandle ?? null,
          contextRecordHandle:
            dto.contextRecordHandle ?? session.contextRecordHandle ?? null,
          playbookHandle: runtimeContext.playbook?.handle ?? null,
          agentVersionHandle: runtimeContext.version?.handle ?? null,
        },
      },
    });

    const assistantMessage = this.em.create(AiChatMessageItem, {
      session,
      person,
      role: 'assistant',
      status: 'streaming',
      sequence: nextSequence + 1,
      content: '',
      provider: runtimeTarget.provider.handle,
      model: runtimeTarget.model.providerModel,
      contextPayload: this.chatPersistence.mergeMessageContextPayload(
        dto.contextPayload,
        attachmentContext,
      ),
      url: dto.url ?? null,
      routeName: dto.routeName ?? null,
      pageTitle: dto.pageTitle ?? null,
    });

    session.provider = runtimeTarget.provider;
    session.model = runtimeTarget.model;
    session.agent = runtimeContext.agent;
    session.agentVersion = runtimeContext.version;
    session.playbook = runtimeContext.playbook;
    session.contextEntityHandle =
      dto.contextEntityHandle ?? session.contextEntityHandle ?? null;
    session.contextRecordHandle =
      dto.contextRecordHandle ?? session.contextRecordHandle ?? null;
    session.lastMessageAt = new Date();
    this.em.persist([userMessage, assistantMessage]);
    await this.em.flush();
    await this.chatPersistence.linkAttachmentsToMessage(
      attachments,
      session,
      userMessage,
    );
    await this.chatPersistence.linkTranscriptionToMessage(
      dto.transcriptionHandle,
      session,
      userMessage,
      user,
    );
    await this.chatPersistence.populateChatSession(session);

    await onEvent({
      type: 'session.upsert',
      session: sanitizeChatSession(session),
    });
    await onEvent({
      type: 'message.user',
      message: sanitizeChatMessage(userMessage),
    });
    await onEvent({
      type: 'message.assistant',
      message: sanitizeChatMessage(assistantMessage),
    });
    await onEvent({ type: 'mcp.tools', tools: availableTools });

    const run = await this.agentRunLifecycle.createRun({
      session,
      message: assistantMessage,
      person,
      agent: runtimeContext.agent,
      version: runtimeContext.version,
      playbook: runtimeContext.playbook,
      provider: runtimeTarget.provider.handle,
      model: runtimeTarget.model.providerModel,
      contextEntityHandle: session.contextEntityHandle ?? null,
      contextRecordHandle: session.contextRecordHandle ?? null,
    });

    const inlineToolStartedAt = Date.now();
    const inlineToolExecution =
      await this.mcpService.tryExecuteInlineToolCommand(
        dto.content,
        user,
        runtimeContext.toolPolicy,
      );

    if (inlineToolExecution) {
      const inlineToolCall = buildAiExecutedToolCallTrace(inlineToolExecution, {
        iteration: 1,
        startedAt: inlineToolStartedAt,
      });
      const inlineToolTrace = toAiToolCallRunTrace(inlineToolCall);
      const navigationLinks = buildNavigationLinks([inlineToolCall]);
      const sources = this.agentRunLifecycle.buildSources(
        [inlineToolCall],
        navigationLinks,
      );

      assistantMessage.content = inlineToolExecution.content;
      assistantMessage.status = 'completed';
      assistantMessage.toolCalls = [inlineToolTrace];
      assistantMessage.responsePayload = {
        source: 'mcp-inline-tool',
        provider: runtimeTarget.provider.handle,
        model: runtimeTarget.model.providerModel,
        rawResult: inlineToolExecution.rawResult,
        navigationLinks,
        sources,
        agentRun: sanitizeAgentRun(run),
      };
      this.agentRunLifecycle.completeRun(run, {
        status: 'completed',
        responseText: assistantMessage.content,
        toolCalls: assistantMessage.toolCalls as Record<string, unknown>[],
        sources,
        pendingActions: [],
      });
      await this.em.flush();
      await onEvent({
        type: 'message.completed',
        message: sanitizeChatMessage(assistantMessage),
        session: sanitizeChatSession(session),
      });
      return { session, userMessage, assistantMessage };
    }

    try {
      const history = await this.chatPersistence.loadSessionHistory(
        session.handle ?? 0,
        this.chatPersistence.requireUserHandle(person),
      );

      let streamResult: AiStreamResult;
      const maxToolCallIterations = resolveMaxToolCallIterations(
        runtimeTarget.model,
      );

      if (runtimeTarget.providerKind === 'gemini') {
        streamResult = await this.chatRuntime.streamGemini(
          history,
          runtimeTarget.provider,
          runtimeTarget.model.providerModel,
          availableTools,
          user,
          maxToolCallIterations,
          clientTimeContext,
          async (delta) => {
            if (!delta) {
              return;
            }

            assistantMessage.content += delta;
            await onEvent({
              type: 'message.delta',
              handle: assistantMessage.handle,
              delta,
            });
          },
          runtimeTarget.model.supportsTools,
          runtimeContext.instruction,
          (entry, args) =>
            this.toolActions.executePolicyAwareToolCall(
              entry,
              args,
              user,
              person,
              session,
              assistantMessage,
              runtimeContext.agent,
              runtimeContext.toolPolicy,
              onEvent,
            ),
        );
      } else {
        streamResult = await this.chatRuntime.streamOpenAi(
          history,
          runtimeTarget.provider,
          runtimeTarget.model.providerModel,
          availableTools,
          user,
          maxToolCallIterations,
          clientTimeContext,
          async (delta) => {
            if (!delta) {
              return;
            }

            assistantMessage.content += delta;
            await onEvent({
              type: 'message.delta',
              handle: assistantMessage.handle,
              delta,
            });
          },
          runtimeTarget.model.supportsTools,
          runtimeContext.instruction,
          (entry, args) =>
            this.toolActions.executePolicyAwareToolCall(
              entry,
              args,
              user,
              person,
              session,
              assistantMessage,
              runtimeContext.agent,
              runtimeContext.toolPolicy,
              onEvent,
            ),
        );
      }

      assistantMessage.toolCalls = streamResult.toolCalls.map((toolCall) =>
        toAiToolCallRunTrace(toolCall),
      );

      assistantMessage.status = 'completed';
      const navigationLinks = buildNavigationLinks(streamResult.toolCalls);
      const sources = this.agentRunLifecycle.buildSources(
        streamResult.toolCalls,
        navigationLinks,
      );
      const pendingToolActions =
        await this.toolActions.loadPendingToolActionsForMessage(
          assistantMessage,
          user,
        );
      assistantMessage.content = alignAssistantContentWithNavigationLinks(
        assistantMessage.content,
        navigationLinks,
        dto.url ?? null,
      );
      assistantMessage.responsePayload = {
        provider: runtimeTarget.provider.handle,
        model: runtimeTarget.model.providerModel,
        completedAt: new Date().toISOString(),
        navigationLinks,
        toolResults: streamResult.toolCalls.map((toolCall) => ({
          ...toAiToolCallRunTrace(toolCall),
          rawResult: toolCall.rawResult,
        })),
        pendingToolActions: pendingToolActions.map((action) =>
          sanitizeToolAction(action),
        ),
        agentRun: sanitizeAgentRun(run),
        agentVersion: runtimeContext.version
          ? sanitizeAgentVersion(runtimeContext.version)
          : null,
        playbook: runtimeContext.playbook
          ? sanitizeAgentPlaybook(runtimeContext.playbook)
          : null,
        sources,
      };
      this.agentRunLifecycle.completeRun(run, {
        status: 'completed',
        responseText: assistantMessage.content,
        toolCalls: assistantMessage.toolCalls as Record<string, unknown>[],
        sources,
        pendingActions: pendingToolActions.map((action) =>
          sanitizeToolAction(action),
        ) as unknown as Record<string, unknown>[],
        usagePayload: {
          provider: runtimeTarget.provider.handle,
          model: runtimeTarget.model.providerModel,
        },
      });
      await this.em.flush();

      await onEvent({
        type: 'message.completed',
        message: sanitizeChatMessage(assistantMessage),
        session: sanitizeChatSession(session),
      });
      return { session, userMessage, assistantMessage };
    } catch (error) {
      assistantMessage.status = 'failed';
      assistantMessage.responsePayload = {
        provider: runtimeTarget.provider.handle,
        model: runtimeTarget.model.providerModel,
        error: error instanceof Error ? error.message : 'ai.unknownError',
        agentRun: sanitizeAgentRun(run),
      };
      this.agentRunLifecycle.completeRun(run, {
        status: 'failed',
        errorPayload: {
          error: error instanceof Error ? error.message : 'ai.unknownError',
        },
      });
      await this.em.flush();
      throw error;
    }
  }
}
