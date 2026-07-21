import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { PersonItem } from '../../entity/PersonItem';
import { AiAgentContextService } from './ai-agent-context.service';
import { AiAgentPolicyService } from './ai-agent-policy.service';
import { AiChatPersistenceService } from './ai-chat-persistence.service';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import {
  extractModelHandle,
  extractProviderHandle,
  sanitizeChatSession,
} from './ai-response.utils';
import {
  ApplyAiChatSessionPlaybookDto,
  CreateAiChatSessionDto,
  UpdateAiChatSessionDto,
} from './dto/chat.dto';

@Injectable()
export class AiChatSessionService {
  constructor(
    private readonly em: EntityManager,
    private readonly providerRegistry: AiProviderRegistryService,
    private readonly agentPolicy: AiAgentPolicyService,
    private readonly agentContext: AiAgentContextService,
    private readonly chatPersistence: AiChatPersistenceService,
  ) {}

  async listChatSessions(
    user: PersonItem,
    includeArchived = false,
  ): Promise<AiChatSessionItem[]> {
    const userHandle = this.chatPersistence.requireUserHandle(user);
    const sessions = await this.em.find(
      AiChatSessionItem,
      {
        person: { handle: userHandle },
        ...(includeArchived ? {} : { isArchived: false }),
      },
      {
        populate: [
          'provider',
          'model',
          'model.provider',
          'agent',
          'agent.provider',
          'agent.model',
          'agent.model.provider',
          'agentVersion',
          'agentVersion.provider',
          'agentVersion.model',
          'agentVersion.model.provider',
          'playbook',
        ],
        orderBy: { updatedAt: 'DESC' },
      },
    );

    return sessions.map((session) => sanitizeChatSession(session));
  }

  async createChatSession(
    dto: CreateAiChatSessionDto,
    user: PersonItem,
  ): Promise<AiChatSessionItem> {
    const session = await this.createManagedChatSession(dto, user);
    return sanitizeChatSession(session);
  }

  async createManagedChatSession(
    dto: CreateAiChatSessionDto,
    user: PersonItem,
  ): Promise<AiChatSessionItem> {
    const person = await this.chatPersistence.requireManagedUser(user);
    const agent = await this.agentPolicy.resolveAgentForChat(
      dto.agentHandle,
      null,
      user,
    );
    const agentVersion = await this.agentContext.resolveAgentVersionForChat(
      agent,
      dto.agentVersionHandle,
      null,
    );
    const playbook = await this.agentContext.resolveAgentPlaybookForChat(
      agent,
      dto.playbookHandle,
      null,
    );
    const runtimeTarget = await this.providerRegistry.resolveRuntimeTarget(
      dto.providerHandle ??
        extractProviderHandle(agentVersion?.provider) ??
        extractProviderHandle(agent?.provider) ??
        null,
      dto.modelHandle ??
        extractModelHandle(agentVersion?.model) ??
        extractModelHandle(agent?.model) ??
        null,
    );
    const session = this.em.create(AiChatSessionItem, {
      title: dto.title?.trim() || 'New Chat',
      isArchived: false,
      provider: runtimeTarget.provider,
      model: runtimeTarget.model,
      agent,
      agentVersion,
      playbook,
      contextEntityHandle: dto.contextEntityHandle?.trim() || null,
      contextRecordHandle:
        dto.contextRecordHandle != null
          ? String(dto.contextRecordHandle).trim() || null
          : null,
      person,
      lastMessageAt: null,
    });

    this.em.persist(session);
    await this.em.flush();
    await this.chatPersistence.populateChatSession(session);
    return session;
  }

  async updateChatSession(
    handle: number,
    dto: UpdateAiChatSessionDto,
    user: PersonItem,
  ): Promise<AiChatSessionItem> {
    const session = await this.chatPersistence.findOwnedSession(handle, user);

    if (dto.title !== undefined) {
      session.title = dto.title.trim() || session.title;
    }

    if (dto.isArchived !== undefined) {
      session.isArchived = dto.isArchived;
    }

    if (dto.providerHandle !== undefined || dto.modelHandle !== undefined) {
      const runtimeTarget = await this.providerRegistry.resolveRuntimeTarget(
        dto.providerHandle ?? extractProviderHandle(session.provider),
        dto.modelHandle ?? extractModelHandle(session.model),
      );
      session.provider = runtimeTarget.provider;
      session.model = runtimeTarget.model;
    }

    if (dto.agentHandle !== undefined) {
      const agent = await this.agentPolicy.resolveAgentForChat(
        dto.agentHandle,
        session.agent,
        user,
      );
      session.agent = agent;
      session.agentVersion = await this.agentContext.resolveAgentVersionForChat(
        agent,
        dto.agentVersionHandle,
        session.agentVersion,
      );
      session.playbook = await this.agentContext.resolveAgentPlaybookForChat(
        agent,
        dto.playbookHandle,
        session.playbook,
      );
      if (
        agent &&
        dto.providerHandle === undefined &&
        dto.modelHandle === undefined
      ) {
        const runtimeTarget = await this.providerRegistry.resolveRuntimeTarget(
          extractProviderHandle(agent.provider) ??
            extractProviderHandle(session.provider),
          extractModelHandle(agent.model) ?? extractModelHandle(session.model),
        );
        session.provider = runtimeTarget.provider;
        session.model = runtimeTarget.model;
      }
    }

    if (dto.agentVersionHandle !== undefined && dto.agentHandle === undefined) {
      session.agentVersion = await this.agentContext.resolveAgentVersionForChat(
        session.agent && typeof session.agent !== 'string'
          ? session.agent
          : null,
        dto.agentVersionHandle,
        session.agentVersion,
      );
    }

    if (dto.playbookHandle !== undefined && dto.agentHandle === undefined) {
      session.playbook = await this.agentContext.resolveAgentPlaybookForChat(
        session.agent && typeof session.agent !== 'string'
          ? session.agent
          : null,
        dto.playbookHandle,
        session.playbook,
      );
    }

    if (dto.contextEntityHandle !== undefined) {
      session.contextEntityHandle = dto.contextEntityHandle?.trim() || null;
    }

    if (dto.contextRecordHandle !== undefined) {
      session.contextRecordHandle =
        dto.contextRecordHandle != null
          ? String(dto.contextRecordHandle).trim() || null
          : null;
    }

    await this.em.flush();
    await this.chatPersistence.populateChatSession(session);
    return sanitizeChatSession(session);
  }

  async applyChatSessionPlaybook(
    handle: number,
    dto: ApplyAiChatSessionPlaybookDto,
    user: PersonItem,
  ): Promise<AiChatSessionItem> {
    const session = await this.chatPersistence.findOwnedSession(handle, user);
    session.playbook = await this.agentContext.resolveAgentPlaybookForChat(
      session.agent && typeof session.agent !== 'string' ? session.agent : null,
      dto.playbookHandle,
      session.playbook,
    );
    await this.em.flush();
    await this.chatPersistence.populateChatSession(session);
    return sanitizeChatSession(session);
  }

  buildSessionTitle(content: string): string {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return 'New Chat';
    }

    return trimmedContent.length > 80
      ? `${trimmedContent.slice(0, 77).trimEnd()}...`
      : trimmedContent;
  }
}
