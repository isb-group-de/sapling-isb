import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AiChatToolActionItem } from '../../entity/AiChatToolActionItem';
import { InboundEmailItem } from '../../entity/InboundEmailItem';
import {
  appendInboundEmailLog,
  applyInboundActionDefaults,
  asRecord,
  bindInboundSenderCustomer,
  buildInboundEmailActionRepairPrompt,
  buildInboundEmailAgentPrompt,
  describeAiProcessingFailure,
  getRelationHandle,
  linkInboundTargetRecord,
  markInboundEmailForManualReview,
  processingTargetEntity,
  readProcessingMode,
  readRecordHandle,
  statusReference,
} from './email-inbox-sync.utils';

@Injectable()
export class EmailInboxProcessingService {
  constructor(
    private readonly em: EntityManager,
    private readonly aiService: AiService,
  ) {}

  async processInboundEmail(handle: number): Promise<void> {
    const em = this.em.fork();
    const email = await em.findOne(
      InboundEmailItem,
      { handle },
      {
        populate: [
          'status',
          'subscription',
          'subscription.agent',
          'subscription.processingMode',
          'subscription.processingPerson',
          'subscription.processingPerson.roles',
          'subscription.processingPerson.roles.stage',
          'subscription.processingPerson.roles.permissions',
          'subscription.processingPerson.roles.permissions.entity',
          'mailbox',
          'person',
          'company',
          'sourceDocument',
        ],
      },
    );
    const currentStatus = getRelationHandle(email?.status);
    if (
      !email ||
      currentStatus === 'processed' ||
      currentStatus === 'processing' ||
      currentStatus === 'manualReview' ||
      currentStatus === 'failed'
    ) {
      return;
    }

    const subscription = email.subscription;
    const agentHandle = getRelationHandle(subscription.agent);
    const processingMode = readProcessingMode(subscription.processingMode);
    if (!subscription.automaticProcessing || !agentHandle) {
      markInboundEmailForManualReview(
        em,
        email,
        'emailInbox.agentNotConfigured',
        'The message requires manual processing because no automatic agent is configured.',
      );
      subscription.manualReviewCount += 1;
      await em.flush();
      return;
    }

    email.status = statusReference(em, 'processing');
    email.processingAttempts += 1;
    email.agent = subscription.agent;
    email.processingMessage = 'AI processing started.';
    appendInboundEmailLog(
      email,
      'info',
      'ai.started',
      'AI processing started.',
      {
        agentHandle,
        processingMode,
      },
    );
    await em.flush();

    try {
      let result = await this.aiService.streamChatMessage(
        {
          sessionTitle: `Inbound email: ${email.subject}`.slice(0, 256),
          content: buildInboundEmailAgentPrompt(email, subscription),
          agentHandle: String(agentHandle),
          contextEntityHandle: 'inboundEmail',
          contextRecordHandle: String(email.handle),
          contextPayload: {
            source: 'emailInboxAutomation',
            inboundEmailHandle: email.handle,
            processingMode,
          },
        },
        subscription.processingPerson,
        () => undefined,
      );

      email.aiSession = { handle: result.session.handle } as never;
      email.aiMessage = { handle: result.assistantMessage.handle } as never;
      appendInboundEmailLog(
        email,
        'info',
        'ai.completed',
        'The AI agent completed its analysis.',
        {
          sessionHandle: result.session.handle,
          messageHandle: result.assistantMessage.handle,
          providerHandle: getRelationHandle(result.session.provider),
          modelHandle: getRelationHandle(result.session.model),
        },
      );
      await em.flush();

      const targetEntity = processingTargetEntity(processingMode);
      let pendingActions = await this.findPendingActions(
        em,
        result.session.handle,
        result.assistantMessage.handle,
      );
      let repairAttempted = false;

      if (pendingActions.length === 0) {
        repairAttempted = true;
        appendInboundEmailLog(
          email,
          'warning',
          'ai.actionRepairStarted',
          'The AI completed without a mutation. One corrective action request was started.',
          {
            sessionHandle: result.session.handle,
            messageHandle: result.assistantMessage.handle,
            targetEntity,
          },
        );
        await em.flush();

        result = await this.aiService.streamChatMessage(
          {
            sessionHandle: result.session.handle,
            content: buildInboundEmailActionRepairPrompt(email, subscription),
            agentHandle: String(agentHandle),
            contextEntityHandle: 'inboundEmail',
            contextRecordHandle: String(email.handle),
            contextPayload: {
              source: 'emailInboxAutomation',
              phase: 'actionRepair',
              inboundEmailHandle: email.handle,
              processingMode,
              targetEntity,
            },
          },
          subscription.processingPerson,
          () => undefined,
        );

        email.aiSession = { handle: result.session.handle } as never;
        email.aiMessage = { handle: result.assistantMessage.handle } as never;
        appendInboundEmailLog(
          email,
          'info',
          'ai.actionRepairCompleted',
          'The corrective AI action request completed.',
          {
            sessionHandle: result.session.handle,
            messageHandle: result.assistantMessage.handle,
            providerHandle: getRelationHandle(result.session.provider),
            modelHandle: getRelationHandle(result.session.model),
          },
        );
        await em.flush();

        pendingActions = await this.findPendingActions(
          em,
          result.session.handle,
          result.assistantMessage.handle,
        );
      }

      const validActions = pendingActions.filter(
        (action) =>
          (action.toolName === 'generic_create' ||
            action.toolName === 'generic_update') &&
          action.arguments?.entityHandle === targetEntity,
      );

      if (pendingActions.length !== 1 || validActions.length !== 1) {
        markInboundEmailForManualReview(
          em,
          email,
          'emailInbox.actionRequiresReview',
          pendingActions.length === 0
            ? 'The AI did not prepare a create or update action.'
            : 'The AI action was ambiguous or outside the configured target entity.',
          {
            pendingActionHandles: pendingActions
              .map((action) => action.handle)
              .filter((actionHandle): actionHandle is number =>
                Number.isInteger(actionHandle),
              ),
            targetEntity,
            repairAttempted,
            messageHandle: result.assistantMessage.handle,
          },
        );
        subscription.manualReviewCount += 1;
        await em.flush();
        return;
      }

      const action = validActions[0];
      applyInboundActionDefaults(processingMode, action);
      const senderCustomerBinding = bindInboundSenderCustomer(email, action);
      if (!senderCustomerBinding.prepared) {
        markInboundEmailForManualReview(
          em,
          email,
          'emailInbox.senderCustomerRequiresReview',
          'The sender could not be resolved to an unambiguous customer person and company.',
          {
            actionHandle: action.handle,
            fromAddress: email.fromAddress,
            matchedPersonHandle: senderCustomerBinding.personHandle,
            matchedCompanyHandle: senderCustomerBinding.companyHandle,
          },
        );
        subscription.manualReviewCount += 1;
        await em.flush();
        return;
      }

      await em.flush();
      const confirmed = await this.aiService.confirmToolAction(
        action.handle!,
        subscription.processingPerson,
      );
      if (confirmed.status !== 'executed') {
        markInboundEmailForManualReview(
          em,
          email,
          'emailInbox.actionFailed',
          'The AI action could not be executed and requires manual review.',
          {
            actionHandle: action.handle,
            actionStatus: confirmed.status,
            error: confirmed.errorPayload,
          },
        );
        subscription.manualReviewCount += 1;
        await em.flush();
        return;
      }

      const resultRecord = asRecord(confirmed.resultPayload?.modelResult);
      const targetHandle = readRecordHandle(resultRecord.handle);
      if (targetHandle == null) {
        markInboundEmailForManualReview(
          em,
          email,
          'emailInbox.actionResultMissing',
          'The AI action was executed, but the created or updated record could not be linked.',
          { actionHandle: action.handle },
        );
        subscription.manualReviewCount += 1;
        await em.flush();
        return;
      }

      linkInboundTargetRecord(email, targetEntity, targetHandle);
      email.status = statusReference(em, 'processed');
      email.processedAt = new Date();
      email.processingMessage = `AI automatically ${
        action.toolName === 'generic_create' ? 'created' : 'updated'
      } ${targetEntity} ${targetHandle}.`;
      appendInboundEmailLog(
        email,
        'info',
        'ai.actionExecuted',
        email.processingMessage,
        {
          actionHandle: action.handle,
          toolName: action.toolName,
          targetEntity,
          targetHandle,
        },
      );
      subscription.processedCount += 1;
      await em.flush();
    } catch (error) {
      const failure = describeAiProcessingFailure(error, agentHandle);
      email.status = statusReference(em, 'failed');
      email.processingMessage = failure.processingMessage;
      appendInboundEmailLog(
        email,
        'error',
        failure.code,
        failure.logMessage,
        failure.details,
      );
      subscription.manualReviewCount += 1;
      await em.flush();
    }
  }

  private async findPendingActions(
    em: EntityManager,
    sessionHandle?: number,
    messageHandle?: number,
  ): Promise<AiChatToolActionItem[]> {
    if (sessionHandle == null || messageHandle == null) {
      return [];
    }

    return em.find(
      AiChatToolActionItem,
      {
        session: { handle: sessionHandle },
        message: { handle: messageHandle },
        status: 'pending',
      },
      { populate: ['agent'] },
    );
  }
}
