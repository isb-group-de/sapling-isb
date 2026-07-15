import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { PersonItem } from '../../entity/PersonItem';
import { AiAgentContextService } from './ai-agent-context.service';
import { extractClientTimeContext } from './ai-client-time.utils';
import { AiChatPersistenceService } from './ai-chat-persistence.service';
import { AiChatSessionService } from './ai-chat-session.service';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import {
  extractModelHandle,
  extractProviderHandle,
  sanitizeChatMessage,
  sanitizeChatSession,
} from './ai-response.utils';
import {
  AiChatMessageListMetaDto,
  AiChatMessageListResponseDto,
  CreateAiChatMessageDto,
  ListAiChatMessagesQueryDto,
} from './dto/chat.dto';

@Injectable()
export class AiChatMessageService {
  constructor(
    private readonly em: EntityManager,
    private readonly providerRegistry: AiProviderRegistryService,
    private readonly agentContext: AiAgentContextService,
    private readonly chatPersistence: AiChatPersistenceService,
    private readonly chatSession: AiChatSessionService,
  ) {}

  async listChatMessages(
    sessionHandle: number,
    user: PersonItem,
    query: ListAiChatMessagesQueryDto = new ListAiChatMessagesQueryDto(),
  ): Promise<AiChatMessageListResponseDto> {
    const userHandle = this.chatPersistence.requireUserHandle(user);
    await this.chatPersistence.findOwnedSession(sessionHandle, user);
    const page = await this.chatPersistence.fetchChatMessagePage(
      sessionHandle,
      userHandle,
      { limit: query.limit, beforeSequence: query.beforeSequence },
    );

    const response = new AiChatMessageListResponseDto();
    response.data = page.messages.map((message) =>
      sanitizeChatMessage(message),
    );
    response.meta = Object.assign(new AiChatMessageListMetaDto(), page.meta);
    return response;
  }

  async createChatMessage(
    dto: CreateAiChatMessageDto,
    user: PersonItem,
  ): Promise<{ session: AiChatSessionItem; message: AiChatMessageItem }> {
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
    const clientTimeContext = extractClientTimeContext(dto);
    const attachments =
      await this.chatPersistence.resolveChatAttachmentsForMessage(
        dto.attachmentHandles,
        session,
        user,
      );
    const attachmentContext =
      this.chatPersistence.buildChatAttachmentContext(attachments);
    const latestMessage = await this.em.find(
      AiChatMessageItem,
      { session: { handle: session.handle } },
      { orderBy: { sequence: 'DESC' }, limit: 1 },
    );
    const contextPayload = this.chatPersistence.mergeMessageContextPayload(
      dto.contextPayload,
      attachmentContext,
    );
    const message = this.em.create(AiChatMessageItem, {
      session,
      person,
      role: 'user',
      status: 'persisted',
      sequence: (latestMessage[0]?.sequence ?? 0) + 1,
      content: dto.content,
      contextPayload,
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
        contextPayload,
      },
    });

    session.lastMessageAt = new Date();
    session.provider = runtimeTarget.provider;
    session.model = runtimeTarget.model;
    session.agent = runtimeContext.agent;
    session.agentVersion = runtimeContext.version;
    session.playbook = runtimeContext.playbook;
    session.contextEntityHandle =
      dto.contextEntityHandle ?? session.contextEntityHandle ?? null;
    session.contextRecordHandle =
      dto.contextRecordHandle ?? session.contextRecordHandle ?? null;
    if (!session.title?.trim()) {
      session.title = this.chatSession.buildSessionTitle(dto.content);
    }

    this.em.persist(message);
    await this.em.flush();
    await this.chatPersistence.linkAttachmentsToMessage(
      attachments,
      session,
      message,
    );
    await this.chatPersistence.linkTranscriptionToMessage(
      dto.transcriptionHandle,
      session,
      message,
      user,
    );
    await this.chatPersistence.populateChatSession(session);
    return {
      session: sanitizeChatSession(session),
      message: sanitizeChatMessage(message),
    };
  }
}
