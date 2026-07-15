import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AI_CHAT_MESSAGE_PAGE_SIZE,
  AI_MAX_CHAT_MESSAGE_PAGE_SIZE,
  AI_STREAM_HISTORY_MESSAGE_LIMIT,
} from '../../constants/project.constants';
import { AiChatAttachmentItem } from '../../entity/AiChatAttachmentItem';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { AiChatTranscriptionItem } from '../../entity/AiChatTranscriptionItem';
import { PersonItem } from '../../entity/PersonItem';

export type AiChatMessagePage = {
  messages: AiChatMessageItem[];
  meta: {
    limit: number;
    hasMore: boolean;
    nextBeforeSequence: number | null;
  };
};

@Injectable()
export class AiChatPersistenceService {
  constructor(private readonly em: EntityManager) {}

  async findOwnedSession(
    handle: number,
    user: PersonItem,
  ): Promise<AiChatSessionItem> {
    const userHandle = this.requireUserHandle(user);
    const session = await this.em.findOne(
      AiChatSessionItem,
      { handle, person: { handle: userHandle } },
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
      },
    );

    if (!session) {
      throw new NotFoundException('global.notFound');
    }

    return session;
  }

  async findOwnedMessage(
    handle: number,
    user: PersonItem,
  ): Promise<AiChatMessageItem> {
    const userHandle = this.requireUserHandle(user);
    const message = await this.em.findOne(
      AiChatMessageItem,
      { handle, person: { handle: userHandle } },
      { populate: ['session'] },
    );

    if (!message) {
      throw new NotFoundException('global.notFound');
    }

    return message;
  }

  requireUserHandle(user: PersonItem): number {
    if (user.handle == null) {
      throw new NotFoundException('auth.userNotFound');
    }

    return user.handle;
  }

  async requireManagedUser(user: PersonItem): Promise<PersonItem> {
    const person = await this.em.findOne(PersonItem, {
      handle: this.requireUserHandle(user),
    });

    if (!person) {
      throw new NotFoundException('auth.userNotFound');
    }

    return person;
  }

  async populateChatSession(session: AiChatSessionItem): Promise<void> {
    await this.em.populate(session, [
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
    ]);
  }

  async getNextSequence(sessionHandle: number): Promise<number> {
    const latestMessage = await this.em.find(
      AiChatMessageItem,
      { session: { handle: sessionHandle } },
      { orderBy: { sequence: 'DESC' }, limit: 1 },
    );

    return (latestMessage[0]?.sequence ?? 0) + 1;
  }

  async loadSessionHistory(
    sessionHandle: number,
    userHandle: number,
  ): Promise<AiChatMessageItem[]> {
    const page = await this.fetchChatMessagePage(sessionHandle, userHandle, {
      limit: AI_STREAM_HISTORY_MESSAGE_LIMIT,
    });

    return page.messages;
  }

  async fetchChatMessagePage(
    sessionHandle: number,
    userHandle: number,
    options?: { limit?: number; beforeSequence?: number },
  ): Promise<AiChatMessagePage> {
    const limit = this.normalizeChatMessageLimit(options?.limit);
    const beforeSequence = this.normalizeBeforeSequence(
      options?.beforeSequence,
    );
    const messages = await this.em.find(
      AiChatMessageItem,
      {
        session: { handle: sessionHandle },
        person: { handle: userHandle },
        ...(beforeSequence != null
          ? { sequence: { $lt: beforeSequence } }
          : {}),
      },
      { orderBy: { sequence: 'DESC' }, limit: limit + 1 },
    );
    const hasMore = messages.length > limit;
    const windowedMessages = hasMore ? messages.slice(0, limit) : messages;
    const orderedMessages = [...windowedMessages].reverse();

    return {
      messages: orderedMessages,
      meta: {
        limit,
        hasMore,
        nextBeforeSequence: hasMore
          ? (orderedMessages[0]?.sequence ?? null)
          : null,
      },
    };
  }

  async resolveChatAttachmentsForMessage(
    attachmentHandles: number[] | null | undefined,
    session: AiChatSessionItem,
    user: PersonItem,
  ): Promise<AiChatAttachmentItem[]> {
    const handles = [...new Set(attachmentHandles ?? [])]
      .map((handle) => Number(handle))
      .filter((handle) => Number.isFinite(handle) && handle > 0)
      .map((handle) => Math.trunc(handle));

    if (handles.length === 0) {
      return [];
    }

    const userHandle = this.requireUserHandle(user);
    const attachments = await this.em.find(
      AiChatAttachmentItem,
      { handle: { $in: handles }, person: { handle: userHandle } },
      {
        populate: ['session', 'message', 'document', 'importBatch', 'person'],
        orderBy: { handle: 'ASC' },
      },
    );
    const foundHandles = new Set(attachments.map((item) => item.handle));
    const missingHandle = handles.find((handle) => !foundHandles.has(handle));

    if (missingHandle != null) {
      throw new NotFoundException('ai.chatAttachmentNotFound');
    }

    for (const attachment of attachments) {
      const attachedSessionHandle =
        attachment.session && typeof attachment.session !== 'number'
          ? attachment.session.handle
          : attachment.session;
      const attachedMessageHandle =
        attachment.message && typeof attachment.message !== 'number'
          ? attachment.message.handle
          : attachment.message;

      if (
        attachedSessionHandle != null &&
        attachedSessionHandle !== session.handle
      ) {
        throw new BadRequestException('ai.chatAttachmentSessionMismatch');
      }

      if (attachedMessageHandle != null) {
        throw new BadRequestException('ai.chatAttachmentAlreadyUsed');
      }
    }

    return attachments;
  }

  buildChatAttachmentContext(
    attachments: AiChatAttachmentItem[],
  ): Record<string, unknown>[] {
    return attachments.map((attachment) => ({
      attachmentHandle: attachment.handle ?? null,
      filename: attachment.filename,
      mimeType: attachment.mimeType ?? null,
      byteLength: attachment.byteLength ?? null,
      purpose: attachment.purpose,
      status: attachment.status,
      documentHandle:
        attachment.document && typeof attachment.document !== 'number'
          ? (attachment.document.handle ?? null)
          : (attachment.document ?? null),
      importBatchHandle:
        attachment.importBatch && typeof attachment.importBatch !== 'number'
          ? (attachment.importBatch.handle ?? null)
          : (attachment.importBatch ?? null),
      summary: attachment.summaryPayload ?? null,
    }));
  }

  mergeMessageContextPayload(
    contextPayload: Record<string, unknown> | undefined,
    importAttachments: Record<string, unknown>[],
  ): Record<string, unknown> | null {
    if (importAttachments.length === 0) {
      return contextPayload ?? null;
    }

    return { ...(contextPayload ?? {}), importAttachments };
  }

  async linkAttachmentsToMessage(
    attachments: AiChatAttachmentItem[],
    session: AiChatSessionItem,
    message: AiChatMessageItem,
  ): Promise<void> {
    if (attachments.length === 0) {
      return;
    }

    for (const attachment of attachments) {
      attachment.session = session;
      attachment.message = message;
    }

    await this.em.flush();
  }

  async findOwnedTranscription(
    handle: number,
    user: PersonItem,
  ): Promise<AiChatTranscriptionItem> {
    const userHandle = this.requireUserHandle(user);
    const transcription = await this.em.findOne(
      AiChatTranscriptionItem,
      { handle, person: { handle: userHandle } },
      { populate: ['document', 'provider', 'model', 'session', 'message'] },
    );

    if (!transcription) {
      throw new NotFoundException('ai.transcriptionNotFound');
    }

    return transcription;
  }

  async linkTranscriptionToMessage(
    transcriptionHandle: number | undefined,
    session: AiChatSessionItem,
    message: AiChatMessageItem,
    user: PersonItem,
  ): Promise<void> {
    if (!transcriptionHandle) {
      return;
    }

    const transcription = await this.findOwnedTranscription(
      transcriptionHandle,
      user,
    );
    transcription.session = session;
    transcription.message = message;
    await this.em.flush();
  }

  private normalizeChatMessageLimit(limit?: number): number {
    if (!Number.isFinite(limit)) {
      return AI_CHAT_MESSAGE_PAGE_SIZE;
    }

    return Math.min(
      AI_MAX_CHAT_MESSAGE_PAGE_SIZE,
      Math.max(1, Math.trunc(limit ?? AI_CHAT_MESSAGE_PAGE_SIZE)),
    );
  }

  private normalizeBeforeSequence(beforeSequence?: number): number | undefined {
    if (!Number.isFinite(beforeSequence)) {
      return undefined;
    }

    const normalized = Math.trunc(beforeSequence ?? 0);
    return normalized > 0 ? normalized : undefined;
  }
}
