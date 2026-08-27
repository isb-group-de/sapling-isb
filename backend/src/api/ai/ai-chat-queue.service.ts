import { EntityManager, LockMode, RequestContext } from '@mikro-orm/core';
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { AiChatQueuedInputItem } from '../../entity/AiChatQueuedInputItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import type { PersonItem } from '../../entity/PersonItem';
import { AiChatCoordinatorService } from './ai-chat-coordinator.service';
import { AiChatPersistenceService } from './ai-chat-persistence.service';
import { AiChatStreamService } from './ai-chat-stream.service';
import type {
  CreateAiChatInputDto,
  CreateAiChatMessageDto,
} from './dto/chat.dto';

@Injectable()
export class AiChatQueueService implements OnModuleInit {
  private readonly processing = new Set<number>();

  constructor(
    private readonly em: EntityManager,
    private readonly persistence: AiChatPersistenceService,
    private readonly streamService: AiChatStreamService,
    private readonly coordinator: AiChatCoordinatorService,
  ) {
    this.coordinator.onIdle((sessionHandle) => this.kick(sessionHandle));
  }

  async onModuleInit(): Promise<void> {
    await RequestContext.create(this.em, () => this.recoverQueueAfterRestart());
  }

  private async recoverQueueAfterRestart(): Promise<void> {
    const abandoned = await this.em.find(
      AiChatQueuedInputItem,
      { status: 'running' },
      { populate: ['session'] },
    );
    for (const item of abandoned) {
      item.session.responseStatus = 'idle';
      item.session.responseActivityAt = new Date();
      item.session.lastResponseAt = new Date();
    }
    if (abandoned.length > 0) await this.em.flush();
    await this.em.nativeUpdate(
      AiChatQueuedInputItem,
      { status: 'running' },
      {
        status: 'failed',
        completedAt: new Date(),
        errorPayload: { error: 'ai.chatQueueInterruptedByRestart' },
      },
    );
    const queued = await this.em.find(
      AiChatQueuedInputItem,
      { status: 'queued' },
      { populate: ['session'] },
    );
    for (const item of queued) this.kick(item.session.handle ?? 0);
  }

  async enqueue(dto: CreateAiChatInputDto, user: PersonItem) {
    const session = await this.persistence.findOwnedSession(
      dto.sessionHandle,
      user,
    );
    const person = await this.persistence.requireManagedUser(user);
    const item = this.em.create(AiChatQueuedInputItem, {
      session,
      person,
      mode: dto.mode,
      status: 'queued',
      content: dto.content,
      requestPayload: { ...dto, mode: undefined },
    });
    this.em.persist(item);
    await this.em.flush();

    if (dto.mode === 'steer') this.coordinator.interrupt(dto.sessionHandle);
    this.kick(dto.sessionHandle);
    return sanitizeQueuedInput(item);
  }

  async list(sessionHandle: number, user: PersonItem) {
    await this.persistence.findOwnedSession(sessionHandle, user);
    const items = await this.em.find(
      AiChatQueuedInputItem,
      { session: { handle: sessionHandle }, status: 'queued' },
      { orderBy: { mode: 'DESC', createdAt: 'ASC', handle: 'ASC' } },
    );
    return items.map(sanitizeQueuedInput);
  }

  async cancel(handle: number, user: PersonItem) {
    const personHandle = this.persistence.requireUserHandle(user);
    const item = await this.em.findOne(AiChatQueuedInputItem, {
      handle,
      person: { handle: personHandle },
    });
    if (!item) throw new NotFoundException('ai.chatQueuedInputNotFound');
    if (item.status === 'queued') {
      item.status = 'cancelled';
      item.completedAt = new Date();
      await this.em.flush();
    }
    return sanitizeQueuedInput(item);
  }

  private kick(sessionHandle: number): void {
    if (!sessionHandle || this.processing.has(sessionHandle)) return;
    setTimeout(() => void this.processSession(sessionHandle), 0);
  }

  private async processSession(sessionHandle: number): Promise<void> {
    await RequestContext.create(this.em, () =>
      this.processSessionInContext(sessionHandle),
    );
  }

  private async processSessionInContext(sessionHandle: number): Promise<void> {
    if (
      this.processing.has(sessionHandle) ||
      this.coordinator.isRunning(sessionHandle)
    )
      return;
    this.processing.add(sessionHandle);
    try {
      while (!this.coordinator.isRunning(sessionHandle)) {
        const item = await this.claimNext(sessionHandle);
        if (!item) break;
        try {
          const payload = {
            ...(item.requestPayload ?? {}),
            sessionHandle,
            content: item.content,
          } as unknown as CreateAiChatMessageDto;
          const result = await this.coordinator.run(sessionHandle, (signal) =>
            this.streamService.streamChatMessage(
              payload,
              item.person,
              () => undefined,
              {
                coordinated: true,
                signal,
              },
            ),
          );
          await this.em.nativeUpdate(
            AiChatQueuedInputItem,
            { handle: item.handle, status: 'running' },
            {
              userMessage: result.userMessage,
              assistantMessage: result.assistantMessage,
              status:
                result.assistantMessage.status === 'interrupted'
                  ? 'cancelled'
                  : 'completed',
              completedAt: new Date(),
            },
          );
        } catch (error) {
          await this.em.nativeUpdate(
            AiChatQueuedInputItem,
            { handle: item.handle, status: 'running' },
            {
              status: 'failed',
              completedAt: new Date(),
              errorPayload: {
                error:
                  error instanceof Error ? error.message : 'ai.unknownError',
              },
            },
          );
        }
      }
    } finally {
      this.processing.delete(sessionHandle);
    }
  }

  private claimNext(
    sessionHandle: number,
  ): Promise<AiChatQueuedInputItem | null> {
    return this.em.transactional(async (em) => {
      const session = await em.findOne(
        AiChatSessionItem,
        { handle: sessionHandle },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!session || session.responseStatus === 'responding') return null;
      const runningInput = await em.findOne(AiChatQueuedInputItem, {
        session: { handle: sessionHandle },
        status: 'running',
      });
      if (runningInput) return null;
      const item = await em.findOne(
        AiChatQueuedInputItem,
        { session: { handle: sessionHandle }, status: 'queued' },
        {
          orderBy: { mode: 'DESC', createdAt: 'ASC', handle: 'ASC' },
          populate: ['person', 'session'],
          lockMode: LockMode.PESSIMISTIC_WRITE,
        },
      );
      if (!item) return null;
      item.status = 'running';
      item.startedAt = new Date();
      await em.flush();
      return item;
    });
  }
}

function sanitizeQueuedInput(item: AiChatQueuedInputItem) {
  return {
    handle: item.handle,
    sessionHandle: item.session.handle,
    mode: item.mode,
    status: item.status,
    content: item.content,
    userMessageHandle: item.userMessage?.handle ?? null,
    assistantMessageHandle: item.assistantMessage?.handle ?? null,
    createdAt: item.createdAt,
    startedAt: item.startedAt ?? null,
    completedAt: item.completedAt ?? null,
  };
}
