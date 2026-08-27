import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AiService } from './ai.service';
import { McpService, type McpToolDescriptor } from './mcp.service';
import { SaplingMcpService } from './sapling-mcp.service';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { AdminPermission } from '../../auth/admin-permission';
import { PersonItem } from '../../entity/PersonItem';
import { AiAgentItem } from '../../entity/AiAgentItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiChatToolActionItem } from '../../entity/AiChatToolActionItem';
import { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';
import { AiProviderModelItem } from '../../entity/AiProviderModelItem';
import {
  AiChatMessageListResponseDto,
  ApplyAiChatSessionPlaybookDto,
  CreateAiChatMessageDto,
  CreateAiChatInputDto,
  CreateAiChatSessionDto,
  ListAiChatMessagesQueryDto,
  PrepareAiMarkdownDto,
  PrepareAiMarkdownResponseDto,
  UpdateAiChatSessionDto,
} from './dto/chat.dto';
import { AiChatQueueService } from './ai-chat-queue.service';
import {
  VectorizeEntityDto,
  VectorizeEntityResponseDto,
} from './dto/vectorization.dto';

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Controller for AI operations, including endpoints for asking questions and creating entities.
 *
 * @property        {AiService} aiService  Service handling AI logic
 *
 * @method          ask          Returns an answer to a question using the AI service
 * @method          createEntity Creates a new entity using the AI service
 */
@ApiTags('AI')
@ApiBearerAuth()
@Controller('api/ai')
@UseGuards(SessionOrBearerAuthGuard)
export class AiController {
  /**
   * Service handling AI logic.
   * @type {AiService}
   */
  constructor(
    private readonly aiService: AiService,
    private readonly mcpService: McpService,
    private readonly saplingMcpService: SaplingMcpService,
    private readonly chatQueueService: AiChatQueueService,
  ) {}

  @Post('mcp')
  @ApiOperation({
    summary: 'Forward an MCP POST request',
    description:
      'Accepts a streamable HTTP POST request for the authenticated Sapling Model Context Protocol session and forwards it to the MCP runtime.',
  })
  async handleMcpPost(
    @Req() req: Request & { user: PersonItem },
    @Res() res: Response,
  ): Promise<void> {
    await this.saplingMcpService.handlePost(req, res);
  }

  @Get('mcp')
  @ApiOperation({
    summary: 'Forward an MCP GET request',
    description:
      'Opens, resumes, or reads a streamable HTTP interaction for the authenticated Sapling Model Context Protocol session.',
  })
  async handleMcpGet(
    @Req() req: Request & { user: PersonItem },
    @Res() res: Response,
  ): Promise<void> {
    await this.saplingMcpService.handleGet(req, res);
  }

  @Delete('mcp')
  @ApiOperation({
    summary: 'Forward an MCP DELETE request',
    description:
      'Terminates a streamable HTTP interaction for the authenticated Sapling Model Context Protocol session.',
  })
  async handleMcpDelete(
    @Req() req: Request & { user: PersonItem },
    @Res() res: Response,
  ): Promise<void> {
    await this.saplingMcpService.handleDelete(req, res);
  }

  @Get('chat/providers')
  @ApiOperation({
    summary: 'List available chat providers',
    description:
      'Returns the active AI providers that can currently be used for chat completions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active chat providers available to the current user.',
    type: AiProviderTypeItem,
    isArray: true,
  })
  async listProviders(): Promise<AiProviderTypeItem[]> {
    return this.aiService.listActiveProviders('chat', true);
  }

  @Get('chat/models')
  @ApiOperation({
    summary: 'List available chat models',
    description:
      'Returns the active chat-capable models. When providerHandle is supplied, only models from that provider are returned.',
  })
  @ApiQuery({
    name: 'providerHandle',
    required: false,
    type: String,
    description:
      'Optional provider handle used to limit the result to one AI provider.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active chat models available to the current user.',
    type: AiProviderModelItem,
    isArray: true,
  })
  async listModels(
    @Query('providerHandle') providerHandle?: string,
  ): Promise<AiProviderModelItem[]> {
    return this.aiService.listActiveModels(providerHandle, 'chat', true);
  }

  @Get('web-search/providers')
  @ApiOperation({
    summary: 'List available web-search providers',
    description:
      'Returns active AI providers with configured credentials and at least one web-search-capable model.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active providers available for public web research.',
    type: AiProviderTypeItem,
    isArray: true,
  })
  async listWebSearchProviders(): Promise<AiProviderTypeItem[]> {
    return this.aiService.listActiveProviders('webSearch', true);
  }

  @Get('web-search/models')
  @ApiOperation({
    summary: 'List available web-search models',
    description:
      'Returns active web-search-capable models. When providerHandle is supplied, only models from that provider are returned.',
  })
  @ApiQuery({
    name: 'providerHandle',
    required: false,
    type: String,
    description:
      'Optional provider handle used to limit the result to one AI provider.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active models available for public web research.',
    type: AiProviderModelItem,
    isArray: true,
  })
  async listWebSearchModels(
    @Query('providerHandle') providerHandle?: string,
  ): Promise<AiProviderModelItem[]> {
    return this.aiService.listActiveModels(providerHandle, 'webSearch', true);
  }

  @Post('markdown/prepare')
  @ApiOperation({
    summary: 'Professionally revise Markdown content',
    description:
      'Corrects grammar, spelling, professional tone, and structure while preserving the source meaning and without adding new content.',
  })
  @ApiBody({ type: PrepareAiMarkdownDto })
  @ApiResponse({
    status: 201,
    description: 'Revised Markdown content.',
    type: PrepareAiMarkdownResponseDto,
  })
  async prepareMarkdown(
    @Body() body: PrepareAiMarkdownDto,
  ): Promise<PrepareAiMarkdownResponseDto> {
    return this.aiService.prepareMarkdown(body);
  }

  @Get('chat/agents')
  @ApiOperation({
    summary: 'List available chat agents',
    description:
      'Returns active AI agents visible to the authenticated user based on role assignments.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active AI agents available to the current user.',
    type: AiAgentItem,
    isArray: true,
  })
  async listAgents(
    @Req() req: Request & { user: PersonItem },
  ): Promise<AiAgentItem[]> {
    return this.aiService.listAccessibleAgents(req.user);
  }

  @Get('chat/tools')
  @ApiOperation({
    summary: 'List active MCP tools',
    description:
      'Returns internal and configured external MCP tools available for agent configuration.',
  })
  async listChatTools(
    @Req() req: Request & { user: PersonItem },
  ): Promise<McpToolDescriptor[]> {
    return this.mcpService.listActiveTools(req.user);
  }

  @Get('vectorization/providers')
  @AdminPermission()
  @UseGuards(AdminPermissionGuard)
  @ApiOperation({
    summary: 'List available embedding providers',
    description:
      'Returns the active AI providers that can currently generate vector embeddings for semantic search.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active embedding providers available to administrators.',
    type: AiProviderTypeItem,
    isArray: true,
  })
  async listVectorizationProviders(): Promise<AiProviderTypeItem[]> {
    return this.aiService.listActiveProviders('embedding');
  }

  @Get('vectorization/models')
  @AdminPermission()
  @UseGuards(AdminPermissionGuard)
  @ApiOperation({
    summary: 'List available embedding models',
    description:
      'Returns the active embedding models. When providerHandle is supplied, only models from that provider are returned.',
  })
  @ApiQuery({
    name: 'providerHandle',
    required: false,
    type: String,
    description:
      'Optional provider handle used to limit the result to one embedding provider.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active embedding models available to administrators.',
    type: AiProviderModelItem,
    isArray: true,
  })
  async listVectorizationModels(
    @Query('providerHandle') providerHandle?: string,
  ): Promise<AiProviderModelItem[]> {
    return this.aiService.listActiveModels(providerHandle, 'embedding');
  }

  @Post('vectorization')
  @AdminPermission()
  @UseGuards(AdminPermissionGuard)
  @ApiOperation({
    summary: 'Generate embeddings for one entity type',
    description:
      'Runs vectorization for all supported records of the requested entity so they become available for semantic search.',
  })
  @ApiBody({ type: VectorizeEntityDto })
  @ApiResponse({
    status: 201,
    description:
      'Summary of the vectorization run, including processed, skipped, and deleted document counts.',
    type: VectorizeEntityResponseDto,
  })
  async vectorizeEntity(
    @Body() body: VectorizeEntityDto,
  ): Promise<VectorizeEntityResponseDto> {
    return this.aiService.vectorizeEntity(body);
  }

  @Get('chat/sessions')
  @ApiOperation({
    summary: 'List chat sessions',
    description:
      "Returns the authenticated user's persisted chat sessions. Archived sessions can be included on demand.",
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description:
      'Set to true to include archived sessions alongside active sessions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat sessions that belong to the authenticated user.',
    type: AiChatSessionItem,
    isArray: true,
  })
  async listSessions(
    @Req() req: Request & { user: PersonItem },
    @Query('includeArchived') includeArchived?: string,
  ): Promise<AiChatSessionItem[]> {
    return this.aiService.listChatSessions(
      req.user,
      includeArchived === 'true' || includeArchived === '1',
    );
  }

  @Post('chat/sessions')
  @ApiOperation({
    summary: 'Create a chat session',
    description:
      'Creates an empty chat session for the authenticated user that can later receive chat messages.',
  })
  @ApiBody({ type: CreateAiChatSessionDto })
  @ApiResponse({
    status: 201,
    description: 'Persisted chat session record.',
    type: AiChatSessionItem,
  })
  async createSession(
    @Req() req: Request & { user: PersonItem },
    @Body() body: CreateAiChatSessionDto,
  ): Promise<AiChatSessionItem> {
    return this.aiService.createChatSession(body, req.user);
  }

  @Patch('chat/sessions/:handle')
  @ApiOperation({
    summary: 'Update a chat session',
    description:
      'Updates chat session metadata such as the display title, archive state, or preferred provider and model settings.',
  })
  @ApiParam({
    name: 'handle',
    type: Number,
    description: 'Numeric handle of the chat session to update.',
  })
  @ApiBody({ type: UpdateAiChatSessionDto })
  @ApiResponse({
    status: 200,
    description: 'Updated chat session record.',
    type: AiChatSessionItem,
  })
  async updateSession(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
    @Body() body: UpdateAiChatSessionDto,
  ): Promise<AiChatSessionItem> {
    return this.aiService.updateChatSession(handle, body, req.user);
  }

  @Post('chat/sessions/:handle/read')
  @ApiOperation({
    summary: 'Mark a chat session as read',
    description:
      'Persists the authenticated user read marker used to derive the new-response state across reloads and devices.',
  })
  @ApiParam({
    name: 'handle',
    type: Number,
    description: 'Numeric handle of the chat session to mark as read.',
  })
  @ApiResponse({
    status: 201,
    description: 'Updated persisted chat session.',
    type: AiChatSessionItem,
  })
  async markSessionRead(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
  ): Promise<AiChatSessionItem> {
    return this.aiService.markChatSessionRead(Number(handle), req.user);
  }

  @Get('chat/sessions/:handle/messages')
  @ApiOperation({
    summary: 'List chat messages for one session',
    description:
      'Returns persisted chat messages for one session, with cursor-based pagination for loading older messages.',
  })
  @ApiParam({
    name: 'handle',
    type: Number,
    description:
      'Numeric handle of the chat session whose messages should be listed.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of messages to return in one page.',
  })
  @ApiQuery({
    name: 'beforeSequence',
    required: false,
    type: Number,
    description:
      'Cursor used to load messages with a smaller sequence number than the provided value.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated chat message list with cursor metadata for loading older messages.',
    type: AiChatMessageListResponseDto,
  })
  async listMessages(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
    @Query() query: ListAiChatMessagesQueryDto,
  ): Promise<AiChatMessageListResponseDto> {
    return this.aiService.listChatMessages(handle, req.user, query);
  }

  @Post('chat/inputs')
  @ApiOperation({ summary: 'Queue or steer a chat input' })
  async createChatInput(
    @Req() req: Request & { user: PersonItem },
    @Body() body: CreateAiChatInputDto,
  ) {
    return this.chatQueueService.enqueue(body, req.user);
  }

  @Get('chat/sessions/:handle/inputs')
  @ApiOperation({ summary: 'List queued chat inputs for one session' })
  async listChatInputs(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
  ) {
    return this.chatQueueService.list(Number(handle), req.user);
  }

  @Delete('chat/inputs/:handle')
  @ApiOperation({ summary: 'Cancel a queued chat input' })
  async cancelChatInput(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
  ) {
    return this.chatQueueService.cancel(Number(handle), req.user);
  }

  @Post('chat/messages')
  @ApiOperation({
    summary: 'Create a user chat message',
    description:
      'Stores a new user message, creates a session when needed, and returns both the persisted session and message records.',
  })
  @ApiBody({ type: CreateAiChatMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Persisted session and user message records.',
    schema: {
      type: 'object',
      required: ['session', 'message'],
      properties: {
        session: { $ref: '#/components/schemas/AiChatSessionItem' },
        message: { $ref: '#/components/schemas/AiChatMessageItem' },
      },
    },
  })
  async createMessage(
    @Req() req: Request & { user: PersonItem },
    @Body() body: CreateAiChatMessageDto,
  ): Promise<{ session: AiChatSessionItem; message: AiChatMessageItem }> {
    return this.aiService.createChatMessage(body, req.user);
  }

  @Post('chat/tool-actions/:handle/confirm')
  @ApiOperation({
    summary: 'Confirm a pending AI tool action',
    description:
      'Executes a pending mutating tool action that was prepared by an AI agent.',
  })
  @ApiParam({
    name: 'handle',
    type: 'number',
    description: 'Numeric handle of the pending tool action.',
  })
  @ApiResponse({
    status: 201,
    description: 'Updated tool action with execution result metadata.',
    type: AiChatToolActionItem,
  })
  async confirmToolAction(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
  ): Promise<AiChatToolActionItem> {
    return this.aiService.confirmToolAction(Number(handle), req.user);
  }

  @Post('chat/tool-actions/:handle/reject')
  @ApiOperation({
    summary: 'Reject a pending AI tool action',
    description:
      'Marks a pending mutating tool action as rejected without executing it.',
  })
  @ApiParam({
    name: 'handle',
    type: 'number',
    description: 'Numeric handle of the pending tool action.',
  })
  @ApiResponse({
    status: 201,
    description: 'Rejected tool action.',
    type: AiChatToolActionItem,
  })
  async rejectToolAction(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
  ): Promise<AiChatToolActionItem> {
    return this.aiService.rejectToolAction(Number(handle), req.user);
  }

  @Post('chat/sessions/:handle/playbook')
  @ApiOperation({
    summary: 'Apply an AI playbook to a chat session',
    description:
      'Stores the selected playbook on an existing chat session. Future messages include the playbook instructions.',
  })
  @ApiBody({ type: ApplyAiChatSessionPlaybookDto })
  async applySessionPlaybook(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
    @Body() body: ApplyAiChatSessionPlaybookDto,
  ): Promise<AiChatSessionItem> {
    return this.aiService.applyChatSessionPlaybook(
      Number(handle),
      body,
      req.user,
    );
  }

  @Post('chat/stream')
  @ApiOperation({
    summary: 'Create a user message and stream the assistant reply',
    description:
      'Persists the user message and streams structured NDJSON events for the assistant response, tool activity, and terminal errors.',
  })
  @ApiBody({ type: CreateAiChatMessageDto })
  @ApiProduces('application/x-ndjson')
  @ApiResponse({
    status: 200,
    description:
      'NDJSON event stream containing the persisted session context and streamed assistant response chunks.',
  })
  async streamChat(
    @Req() req: Request & { user: PersonItem },
    @Body() body: CreateAiChatMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    if (!body.sessionHandle) {
      const session = await this.aiService.createChatSession(
        {
          title: body.sessionTitle,
          providerHandle: body.providerHandle,
          modelHandle: body.modelHandle,
          agentHandle: body.agentHandle,
          agentVersionHandle: body.agentVersionHandle,
          playbookHandle: body.playbookHandle,
          contextEntityHandle: body.contextEntityHandle,
          contextRecordHandle: body.contextRecordHandle,
        },
        req.user,
      );
      body = { ...body, sessionHandle: session.handle };
    }
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const writeEvent = (event: Record<string, unknown>): void => {
      if (res.destroyed || res.writableEnded) {
        return;
      }

      res.write(`${JSON.stringify(event)}\n`);
    };

    try {
      await this.aiService.streamChatMessage(body, req.user, writeEvent);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'ai.streamFailed';
      writeEvent({ type: 'error', messageText: message });
    } finally {
      if (!res.destroyed && !res.writableEnded) {
        res.end();
      }
    }
  }
}
