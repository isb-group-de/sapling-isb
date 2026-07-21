import { EntityManager } from '@mikro-orm/core';
import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { AiAgentItem } from '../../entity/AiAgentItem';
import { AiAgentEvaluationItem } from '../../entity/AiAgentEvaluationItem';
import { AiAgentRunItem } from '../../entity/AiAgentRunItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiChatToolActionItem } from '../../entity/AiChatToolActionItem';
import { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';
import { AiProviderModelItem } from '../../entity/AiProviderModelItem';
import {
  AiChatMessageListResponseDto,
  ApplyAiChatSessionPlaybookDto,
  CreateAiAgentEvaluationDto,
  CreateAiAgentTestRunDto,
  CreateAiChatMessageSpeechDto,
  CreateAiChatMessageDto,
  CreateAiChatSessionDto,
  ListAiChatMessagesQueryDto,
  UpdateAiChatSessionDto,
} from './dto/chat.dto';
import { McpService, type McpInlineToolExecution } from './mcp.service';
import { DocumentService } from '../document/document.service';
import {
  VectorizeEntityDto,
  VectorizeEntityResponseDto,
} from './dto/vectorization.dto';
import {
  AiChatTranscriptionResponseDto,
  CreateAiChatTranscriptionDto,
} from './dto/transcription.dto';
import {
  AiClientTimeContext,
  AiProviderCapability,
  AiToolRegistryEntry,
} from './ai.types';
import { sanitizeAgentRun } from './ai-response.utils';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { AiVectorService } from './ai-vector.service';
import { AiChatRuntimeService } from './ai-chat-runtime.service';
import { AiAgentRunLifecycleService } from './ai-agent-run-lifecycle.service';
import { AiAgentPolicyService } from './ai-agent-policy.service';
import { AiAgentContextService } from './ai-agent-context.service';
import { AiAgentWorkbenchService } from './ai-agent-workbench.service';
import { AiChatPersistenceService } from './ai-chat-persistence.service';
import { AiChatSessionService } from './ai-chat-session.service';
import { AiChatMessageService } from './ai-chat-message.service';
import { AiChatToolActionService } from './ai-chat-tool-action.service';
import { AiChatStreamService } from './ai-chat-stream.service';
import {
  AiChatMediaService,
  type AiChatAttachmentUploadResponse,
} from './ai-chat-media.service';
import { ImportService } from '../import/import.service';

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Service for AI operations, including logic for asking questions and creating entities.
 *
 * @property        {ConfigService} configService  Service for accessing configuration values
 * @property        {'openai'|'gemini'} provider   AI provider type
 * @property        {OpenAI|null} openai           OpenAI client instance
 * @property        {GoogleGenerativeAI|null} gemini Gemini client instance
 *
 * @method          ask          Returns an answer to a question using the configured AI provider
 * @method          createEntity Creates a new entity (example logic, extendable)
 */
@Injectable()
export class AiService {
  /**
   * Service for accessing configuration values.
   * @type {ConfigService}
   */
  constructor(
    private readonly em: EntityManager,
    @Inject(forwardRef(() => McpService))
    private readonly mcpService: McpService,
    private readonly documentService: DocumentService,
    private readonly providerRegistry: AiProviderRegistryService,
    private readonly vectorService: AiVectorService,
    private readonly chatRuntime: AiChatRuntimeService,
    private readonly agentRunLifecycle: AiAgentRunLifecycleService,
    private readonly agentPolicy: AiAgentPolicyService,
    @Inject(forwardRef(() => ImportService))
    private readonly importService: ImportService,
    private readonly agentContext: AiAgentContextService = new AiAgentContextService(
      em,
      mcpService,
      agentPolicy,
    ),
    private readonly chatPersistence: AiChatPersistenceService = new AiChatPersistenceService(
      em,
    ),
    private readonly chatMedia: AiChatMediaService = new AiChatMediaService(
      em,
      documentService,
      providerRegistry,
      importService,
      chatPersistence,
    ),
    private readonly agentWorkbench: AiAgentWorkbenchService = new AiAgentWorkbenchService(
      em,
      agentPolicy,
      agentContext,
    ),
    private readonly chatSession: AiChatSessionService = new AiChatSessionService(
      em,
      providerRegistry,
      agentPolicy,
      agentContext,
      chatPersistence,
    ),
    private readonly chatMessage: AiChatMessageService = new AiChatMessageService(
      em,
      providerRegistry,
      agentContext,
      chatPersistence,
      chatSession,
    ),
    private readonly toolActions: AiChatToolActionService = new AiChatToolActionService(
      em,
      mcpService,
      agentPolicy,
      importService,
      chatPersistence,
    ),
    private readonly chatStream: AiChatStreamService = new AiChatStreamService(
      em,
      mcpService,
      providerRegistry,
      chatRuntime,
      agentRunLifecycle,
      agentContext,
      chatPersistence,
      chatSession,
      toolActions,
    ),
  ) {}

  async listActiveProviders(
    capability: AiProviderCapability = 'chat',
    configuredOnly = false,
  ): Promise<AiProviderTypeItem[]> {
    return this.providerRegistry.listActiveProviders(
      capability,
      configuredOnly,
    );
  }

  async listActiveModels(
    providerHandle?: string,
    capability: AiProviderCapability = 'chat',
    configuredOnly = false,
  ): Promise<AiProviderModelItem[]> {
    return this.providerRegistry.listActiveModels(
      providerHandle,
      capability,
      configuredOnly,
    );
  }

  async vectorizeEntity(
    dto: VectorizeEntityDto,
  ): Promise<VectorizeEntityResponseDto> {
    return this.vectorService.vectorizeEntity(dto);
  }

  async searchVectorDocuments(
    entityHandle: string,
    query: string,
    user: PersonItem,
    limit = 5,
  ): Promise<Record<string, unknown>> {
    return this.vectorService.searchVectorDocuments(
      entityHandle,
      query,
      user,
      limit,
    );
  }

  async listAccessibleAgents(user: PersonItem): Promise<AiAgentItem[]> {
    return this.agentPolicy.listAccessibleAgents(user);
  }

  async createChatAttachment(
    file: Express.Multer.File | undefined,
    user: PersonItem,
    options: {
      sessionHandle?: number | null;
      purpose?: string | null;
    } = {},
  ): Promise<AiChatAttachmentUploadResponse> {
    return this.chatMedia.createChatAttachment(file, user, options);
  }

  async ensureAssistantMessageSpeech(
    handle: number,
    user: PersonItem,
    dto: CreateAiChatMessageSpeechDto = {},
  ): Promise<AiChatMessageItem> {
    return this.chatMedia.ensureAssistantMessageSpeech(handle, user, dto);
  }

  async createChatTranscription(
    dto: CreateAiChatTranscriptionDto,
    file: Express.Multer.File | undefined,
    user: PersonItem,
  ): Promise<AiChatTranscriptionResponseDto> {
    return this.chatMedia.createChatTranscription(dto, file, user);
  }

  async getAgentWorkbench(
    agentHandle: string,
    user: PersonItem,
  ): Promise<Record<string, unknown>> {
    return this.agentWorkbench.getAgentWorkbench(agentHandle, user);
  }

  async listAgentRuns(
    agentHandle: string,
    user: PersonItem,
  ): Promise<AiAgentRunItem[]> {
    return this.agentWorkbench.listAgentRuns(agentHandle, user);
  }

  async listAgentEvaluations(
    agentHandle: string,
    user: PersonItem,
  ): Promise<AiAgentEvaluationItem[]> {
    return this.agentWorkbench.listAgentEvaluations(agentHandle, user);
  }

  async createAgentEvaluation(
    agentHandle: string,
    dto: CreateAiAgentEvaluationDto,
    user: PersonItem,
  ): Promise<AiAgentEvaluationItem> {
    return this.agentWorkbench.createAgentEvaluation(agentHandle, dto, user);
  }

  async createAgentTestRun(
    agentHandle: string,
    dto: CreateAiAgentTestRunDto,
    user: PersonItem,
  ): Promise<AiAgentRunItem> {
    const session = await this.chatSession.createManagedChatSession(
      {
        title: `Test: ${this.chatSession.buildSessionTitle(dto.prompt)}`,
        agentHandle,
        agentVersionHandle: dto.agentVersionHandle,
        playbookHandle: dto.playbookHandle,
        contextEntityHandle: dto.contextEntityHandle,
        contextRecordHandle: dto.contextRecordHandle,
      },
      user,
    );

    const result = await this.streamChatMessage(
      {
        sessionHandle: session.handle,
        content: dto.prompt,
        agentHandle,
        agentVersionHandle: dto.agentVersionHandle,
        playbookHandle: dto.playbookHandle,
        contextEntityHandle: dto.contextEntityHandle,
        contextRecordHandle: dto.contextRecordHandle,
        contextPayload: { mode: 'agent-test-run' },
      },
      user,
      () => Promise.resolve(),
    );

    const run = await this.em.findOne(
      AiAgentRunItem,
      { message: { handle: result.assistantMessage.handle } },
      { populate: ['agent', 'agentVersion', 'playbook', 'person'] },
    );

    if (!run) {
      throw new NotFoundException('ai.agentRunNotFound');
    }

    return sanitizeAgentRun(run);
  }

  async streamChatMessage(
    dto: CreateAiChatMessageDto,
    user: PersonItem,
    onEvent: (event: Record<string, unknown>) => Promise<void> | void,
  ): Promise<{
    session: AiChatSessionItem;
    userMessage: AiChatMessageItem;
    assistantMessage: AiChatMessageItem;
  }> {
    return this.chatStream.streamChatMessage(dto, user, onEvent);
  }

  async listChatSessions(
    user: PersonItem,
    includeArchived = false,
  ): Promise<AiChatSessionItem[]> {
    return this.chatSession.listChatSessions(user, includeArchived);
  }

  async createChatSession(
    dto: CreateAiChatSessionDto,
    user: PersonItem,
  ): Promise<AiChatSessionItem> {
    return this.chatSession.createChatSession(dto, user);
  }

  async updateChatSession(
    handle: number,
    dto: UpdateAiChatSessionDto,
    user: PersonItem,
  ): Promise<AiChatSessionItem> {
    return this.chatSession.updateChatSession(handle, dto, user);
  }

  async markChatSessionRead(
    handle: number,
    user: PersonItem,
  ): Promise<AiChatSessionItem> {
    return this.chatSession.markChatSessionRead(handle, user);
  }

  async applyChatSessionPlaybook(
    handle: number,
    dto: ApplyAiChatSessionPlaybookDto,
    user: PersonItem,
  ): Promise<AiChatSessionItem> {
    return this.chatSession.applyChatSessionPlaybook(handle, dto, user);
  }

  async listChatMessages(
    sessionHandle: number,
    user: PersonItem,
    query: ListAiChatMessagesQueryDto = new ListAiChatMessagesQueryDto(),
  ): Promise<AiChatMessageListResponseDto> {
    return this.chatMessage.listChatMessages(sessionHandle, user, query);
  }

  async createChatMessage(
    dto: CreateAiChatMessageDto,
    user: PersonItem,
  ): Promise<{ session: AiChatSessionItem; message: AiChatMessageItem }> {
    return this.chatMessage.createChatMessage(dto, user);
  }

  async confirmToolAction(
    handle: number,
    user: PersonItem,
  ): Promise<AiChatToolActionItem> {
    return this.toolActions.confirmToolAction(handle, user);
  }

  async rejectToolAction(
    handle: number,
    user: PersonItem,
  ): Promise<AiChatToolActionItem> {
    return this.toolActions.rejectToolAction(handle, user);
  }

  private preflightPendingToolAction(
    descriptor: AiToolRegistryEntry['descriptor'],
    args: Record<string, unknown>,
  ): Promise<McpInlineToolExecution | null> {
    return this.toolActions.preflightPendingToolAction(descriptor, args);
  }

  private normalizeStringArray(value: unknown): string[] {
    return this.agentContext.normalizeStringArray(value);
  }

  private loadSessionHistory(
    sessionHandle: number,
    userHandle: number,
  ): Promise<AiChatMessageItem[]> {
    return this.chatPersistence.loadSessionHistory(sessionHandle, userHandle);
  }

  private buildSystemInstruction(options?: {
    includeToolGuidance?: boolean;
    user?: PersonItem;
    clientTimeContext?: AiClientTimeContext;
  }): string {
    return this.chatRuntime.buildSystemInstruction(options);
  }

  private async executeAutomaticToolCall(
    toolRegistry: AiToolRegistryEntry[],
    encodedName: string,
    args: Record<string, unknown>,
    user: PersonItem,
  ) {
    return this.chatRuntime.executeAutomaticToolCall(
      toolRegistry,
      encodedName,
      args,
      user,
    );
  }
}
