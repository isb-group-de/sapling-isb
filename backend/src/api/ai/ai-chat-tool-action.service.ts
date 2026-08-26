import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AiAgentItem } from '../../entity/AiAgentItem';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiChatSessionItem } from '../../entity/AiChatSessionItem';
import { AiChatToolActionItem } from '../../entity/AiChatToolActionItem';
import { PersonItem } from '../../entity/PersonItem';
import { ImportService } from '../import/import.service';
import { AiAgentPolicyService } from './ai-agent-policy.service';
import { AiChatPersistenceService } from './ai-chat-persistence.service';
import { sanitizeToolAction } from './ai-response.utils';
import type { AiToolRegistryEntry } from './ai.types';
import { McpService, type McpInlineToolExecution } from './mcp.service';
import type { McpToolPolicy } from './mcp-policy.types';

@Injectable()
export class AiChatToolActionService {
  constructor(
    private readonly em: EntityManager,
    @Inject(forwardRef(() => McpService))
    private readonly mcpService: McpService,
    private readonly agentPolicy: AiAgentPolicyService,
    @Inject(forwardRef(() => ImportService))
    private readonly importService: ImportService,
    private readonly chatPersistence: AiChatPersistenceService,
  ) {}

  async confirmToolAction(
    handle: number,
    user: PersonItem,
  ): Promise<AiChatToolActionItem> {
    const action = await this.findOwnedToolAction(handle, user);

    if (action.status !== 'pending') {
      this.syncToolActionIntoMessagePayload(action);
      return sanitizeToolAction(action);
    }

    if (action.expiresAt && action.expiresAt.getTime() < Date.now()) {
      action.status = 'expired';
      action.errorPayload = { error: 'ai.toolActionExpired' };
      this.syncToolActionIntoMessagePayload(action);
      await this.em.flush();
      throw new BadRequestException('ai.toolActionExpired');
    }

    try {
      const basePolicy =
        this.agentPolicy.buildToolPolicy(
          action.agent && typeof action.agent !== 'string'
            ? action.agent
            : null,
        ) ?? {};
      const policy = {
        ...basePolicy,
        blockMutatingTools: false,
      };
      const result = await this.mcpService.executeTool(
        action.serverName,
        action.toolName,
        action.arguments ?? {},
        user,
        policy,
      );
      const failureMessage = this.getConfirmedToolExecutionFailure(result);

      if (failureMessage) {
        const failedAction = await this.reloadAfterFailedToolExecution(
          action,
          user,
        );
        failedAction.status = 'failed';
        failedAction.resultPayload = {
          content: result.content,
          modelResult: result.modelResult,
          rawResult: result.rawResult,
        };
        failedAction.errorPayload = { error: failureMessage };
        failedAction.executedAt = new Date();
        this.syncToolActionIntoMessagePayload(failedAction);
        await this.em.flush();
        return sanitizeToolAction(failedAction);
      }

      const followUpAction =
        await this.createFollowUpToolActionForConfirmedAction(action, result);

      action.status = 'executed';
      action.resultPayload = {
        content: result.content,
        modelResult: result.modelResult,
        rawResult: result.rawResult,
        ...(followUpAction
          ? { followUpToolAction: sanitizeToolAction(followUpAction) }
          : {}),
      };
      action.executedAt = new Date();
      this.syncToolActionIntoMessagePayload(action);
      await this.em.flush();
      return sanitizeToolAction(action);
    } catch (error) {
      const failedAction = await this.reloadAfterFailedToolExecution(
        action,
        user,
      );
      failedAction.status = 'failed';
      failedAction.errorPayload = {
        error: error instanceof Error ? error.message : String(error),
      };
      failedAction.executedAt = new Date();
      this.syncToolActionIntoMessagePayload(failedAction);
      await this.em.flush();
      return sanitizeToolAction(failedAction);
    }
  }

  private async reloadAfterFailedToolExecution(
    action: AiChatToolActionItem,
    user: PersonItem,
  ): Promise<AiChatToolActionItem> {
    if (action.handle == null) {
      return action;
    }

    // A failed ORM flush leaves the attempted business entity dirty in the
    // request EntityManager. Clear that unit of work before persisting the
    // failure state, otherwise the same invalid update is flushed again and
    // turns a controlled tool failure into an HTTP 500 response.
    this.em.clear();
    return this.findOwnedToolAction(action.handle, user);
  }

  async rejectToolAction(
    handle: number,
    user: PersonItem,
  ): Promise<AiChatToolActionItem> {
    const action = await this.findOwnedToolAction(handle, user);

    if (action.status !== 'pending') {
      throw new BadRequestException('ai.toolActionNotPending');
    }

    action.status = 'rejected';
    action.executedAt = new Date();
    this.syncToolActionIntoMessagePayload(action);
    await this.em.flush();
    return sanitizeToolAction(action);
  }

  private syncToolActionIntoMessagePayload(action: AiChatToolActionItem): void {
    const message =
      action.message && typeof action.message !== 'number'
        ? action.message
        : null;

    if (!message) {
      return;
    }

    const responsePayload =
      message.responsePayload && typeof message.responsePayload === 'object'
        ? { ...(message.responsePayload as Record<string, unknown>) }
        : {};
    const existingActions = Array.isArray(responsePayload.pendingToolActions)
      ? responsePayload.pendingToolActions.filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === 'object' && !Array.isArray(item),
        )
      : [];
    const sanitizedAction = sanitizeToolAction(action);
    const actionIndex = existingActions.findIndex(
      (item) => item.handle === sanitizedAction.handle,
    );

    if (actionIndex >= 0) {
      existingActions.splice(
        actionIndex,
        1,
        sanitizedAction as unknown as Record<string, unknown>,
      );
    } else {
      existingActions.push(
        sanitizedAction as unknown as Record<string, unknown>,
      );
    }

    message.responsePayload = {
      ...responsePayload,
      pendingToolActions: existingActions,
    };
  }

  async executePolicyAwareToolCall(
    entry: AiToolRegistryEntry,
    args: Record<string, unknown>,
    user: PersonItem,
    person: PersonItem,
    session: AiChatSessionItem,
    message: AiChatMessageItem | null,
    agent: AiAgentItem | null,
    policy: McpToolPolicy | undefined,
    onEvent: (event: Record<string, unknown>) => Promise<void> | void,
  ): Promise<McpInlineToolExecution> {
    const descriptor = entry.descriptor;

    if (agent && this.agentPolicy.isMutatingTool(descriptor.toolName)) {
      if (agent.mutationMode === 'readOnly') {
        return {
          serverHandle: descriptor.serverHandle,
          serverName: descriptor.serverName,
          toolName: descriptor.toolName,
          arguments: args,
          content: JSON.stringify(
            {
              ok: false,
              error: 'ai.agentReadOnly',
            },
            null,
            2,
          ),
          modelResult: {
            ok: false,
            error: 'ai.agentReadOnly',
          },
          rawResult: {
            ok: false,
            error: 'ai.agentReadOnly',
          },
        };
      }

      const preflightFailure = await this.preflightPendingToolAction(
        descriptor,
        args,
        user,
        policy,
      );

      if (preflightFailure) {
        return preflightFailure;
      }

      const action = await this.createPendingToolAction(
        descriptor.serverName,
        descriptor.toolName,
        args,
        person,
        session,
        message,
        agent,
      );
      const sanitizedAction = sanitizeToolAction(action);

      await onEvent({
        type: 'tool.action.pending',
        action: sanitizedAction,
      });

      return {
        serverHandle: descriptor.serverHandle,
        serverName: descriptor.serverName,
        toolName: descriptor.toolName,
        arguments: args,
        content: JSON.stringify(
          {
            pendingToolAction: true,
            actionHandle: action.handle,
            serverName: descriptor.serverName,
            toolName: descriptor.toolName,
            status: 'pending',
            message:
              'The action has been prepared and is waiting for explicit user confirmation in Sapling.',
          },
          null,
          2,
        ),
        modelResult: {
          pendingToolAction: true,
          actionHandle: action.handle,
          serverName: descriptor.serverName,
          toolName: descriptor.toolName,
          status: 'pending',
        },
        rawResult: {
          pendingToolAction: true,
          actionHandle: action.handle,
          action: sanitizedAction,
        },
      };
    }

    return this.mcpService.executeTool(
      descriptor.serverName,
      descriptor.toolName,
      args,
      user,
      policy,
    );
  }

  async preflightPendingToolAction(
    descriptor: AiToolRegistryEntry['descriptor'],
    args: Record<string, unknown>,
    user?: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<McpInlineToolExecution | null> {
    if (user) {
      // Preflight only validates the proposed mutation; it never executes it.
      // Keep all agent allow-lists in effect while bypassing the execution-only
      // confirmation guard so a pending action can be created afterwards.
      const preflightPolicy = policy
        ? { ...policy, blockMutatingTools: false }
        : policy;
      const mutationRepair = await this.mcpService.preflightTool(
        descriptor.serverName,
        descriptor.toolName,
        args,
        user,
        preflightPolicy,
      );
      if (mutationRepair) {
        return mutationRepair;
      }
    }

    if (descriptor.toolName !== 'import_execute_batch') {
      return null;
    }

    const batchHandle = this.asPositiveInteger(args.batchHandle);

    if (!batchHandle) {
      return this.buildPendingToolPreflightFailure(descriptor, args, {
        error: 'import.batchHandleRequired',
      });
    }

    try {
      const batch = await this.importService.getBatch(batchHandle);
      const isValidated =
        batch.status === 'validated' || batch.status === 'validatedWithErrors';

      if (!batch.entityHandle) {
        return this.buildPendingToolPreflightFailure(descriptor, args, {
          error: 'import.targetEntityRequired',
          batch,
        });
      }

      if (!isValidated || batch.readyCount <= 0) {
        return this.buildPendingToolPreflightFailure(descriptor, args, {
          error: 'import.batchNotReadyForExecution',
          message:
            'Configure and validate this import batch before preparing an execution action.',
          batch,
        });
      }

      return null;
    } catch (error) {
      return this.buildPendingToolPreflightFailure(descriptor, args, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildPendingToolPreflightFailure(
    descriptor: AiToolRegistryEntry['descriptor'],
    args: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): McpInlineToolExecution {
    const result = {
      ok: false,
      pendingToolAction: false,
      toolName: descriptor.toolName,
      ...payload,
      nextStep:
        descriptor.toolName === 'import_execute_batch'
          ? 'Call import_configure_batch with a target entity and field mappings, wait for user confirmation, then re-check the batch before executing.'
          : undefined,
    };

    return {
      serverHandle: descriptor.serverHandle,
      serverName: descriptor.serverName,
      toolName: descriptor.toolName,
      arguments: args,
      content: JSON.stringify(result, null, 2),
      modelResult: result,
      rawResult: result,
    };
  }

  private async createPendingToolAction(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    person: PersonItem,
    session: AiChatSessionItem,
    message: AiChatMessageItem | null,
    agent: AiAgentItem | null,
  ): Promise<AiChatToolActionItem> {
    const action = this.em.create(AiChatToolActionItem, {
      session,
      message,
      person,
      agent,
      serverName,
      toolName,
      arguments: args,
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    this.em.persist(action);
    await this.em.flush();
    return action;
  }

  private async createFollowUpToolActionForConfirmedAction(
    action: AiChatToolActionItem,
    result: {
      modelResult?: unknown;
      rawResult?: unknown;
      content?: string;
    },
  ): Promise<AiChatToolActionItem | null> {
    if (action.toolName !== 'import_configure_batch') {
      return null;
    }

    const batchSummary =
      this.asRecordOrNull(result.modelResult) ??
      this.asRecordOrNull(result.rawResult) ??
      this.parseRecordOrNull(result.content);
    const batchHandle =
      this.asPositiveInteger(batchSummary?.handle) ??
      this.asPositiveInteger(action.arguments?.batchHandle);
    const status =
      typeof batchSummary?.status === 'string' ? batchSummary.status : null;
    const readyCount = this.asPositiveInteger(batchSummary?.readyCount) ?? 0;
    const isValidated =
      status === 'validated' || status === 'validatedWithErrors';

    if (!batchHandle || !isValidated || readyCount <= 0) {
      return null;
    }

    return this.createPendingToolAction(
      action.serverName,
      'import_execute_batch',
      { batchHandle },
      action.person,
      action.session,
      action.message ?? null,
      action.agent && typeof action.agent !== 'string' ? action.agent : null,
    );
  }

  private asRecordOrNull(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private parseRecordOrNull(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    try {
      return this.asRecordOrNull(JSON.parse(value));
    } catch {
      return null;
    }
  }

  private getConfirmedToolExecutionFailure(result: {
    content?: string;
    modelResult?: unknown;
    rawResult?: unknown;
  }): string | null {
    const structuredFailure =
      this.extractToolFailureMessage(result.modelResult) ??
      this.extractToolFailureMessage(result.rawResult);

    if (structuredFailure) {
      return structuredFailure;
    }

    if (typeof result.content !== 'string' || !result.content.trim()) {
      return null;
    }

    try {
      return this.extractToolFailureMessage(JSON.parse(result.content));
    } catch {
      return null;
    }
  }

  private extractToolFailureMessage(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;

    if (record.ok !== false) {
      return null;
    }

    const message = record.error ?? record.message;
    return typeof message === 'string' && message.trim()
      ? message.trim()
      : 'ai.toolActionExecutionFailed';
  }

  private asPositiveInteger(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }

    return Math.trunc(numeric);
  }

  async loadPendingToolActionsForMessage(
    message: AiChatMessageItem,
    user: PersonItem,
  ): Promise<AiChatToolActionItem[]> {
    if (message.handle == null) {
      return [];
    }

    return this.em.find(
      AiChatToolActionItem,
      {
        message: { handle: message.handle },
        person: { handle: this.chatPersistence.requireUserHandle(user) },
        status: 'pending',
      },
      { populate: ['session', 'message', 'person', 'agent'] },
    );
  }

  private async findOwnedToolAction(
    handle: number,
    user: PersonItem,
  ): Promise<AiChatToolActionItem> {
    const userHandle = this.chatPersistence.requireUserHandle(user);
    const action = await this.em.findOne(
      AiChatToolActionItem,
      {
        handle,
        person: { handle: userHandle },
      },
      {
        populate: [
          'session',
          'message',
          'person',
          'agent',
          'agent.provider',
          'agent.model',
          'agent.model.provider',
        ],
      },
    );

    if (!action) {
      throw new NotFoundException('ai.toolActionNotFound');
    }

    return action;
  }
}
