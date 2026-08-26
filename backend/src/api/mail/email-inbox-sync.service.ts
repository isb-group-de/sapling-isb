import { EntityManager } from '@mikro-orm/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { DocumentService } from '../document/document.service';
import {
  REDIS_ENABLED,
  REDIS_REMOVE_ON_COMPLETE,
  REDIS_REMOVE_ON_FAIL,
} from '../../constants/project.constants';
import { CompanyItem } from '../../entity/CompanyItem';
import { DocumentItem } from '../../entity/DocumentItem';
import { EmailInboxSubscriptionItem } from '../../entity/EmailInboxSubscriptionItem';
import { InboundEmailItem } from '../../entity/InboundEmailItem';
import { PersonItem } from '../../entity/PersonItem';
import {
  emailAddressesEqual,
  normalizeEmailAddress,
} from './mail-delivery.util';
import {
  EmailInboxProviderService,
  type ProviderInboundEmail,
} from './email-inbox-provider.service';
import { EmailInboxProcessingService } from './email-inbox-processing.service';
import {
  appendInboundEmailLog,
  buildEmlFilename,
  createInboundEmailLogEntry,
  getRelationHandle,
  isEmailInboxSubscriptionDue,
  markInboundEmailForManualReview,
  maxDate,
  statusReference,
  truncateError,
} from './email-inbox-sync.utils';

export {
  applyInboundActionDefaults,
  bindInboundSenderCustomer,
  buildInboundEmailActionRepairPrompt,
  buildInboundEmailAgentPrompt,
  isEmailInboxSubscriptionDue,
} from './email-inbox-sync.utils';

const SCHEDULER_INTERVAL_MS = 60_000;
const FIRST_IMPORT_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const POLL_OVERLAP_MS = 5 * 60 * 1000;

export type EmailInboxSyncJob = {
  subscriptionHandle?: number;
  since?: string;
  manual?: boolean;
  inboundEmailHandle?: number;
};

@Injectable()
export class EmailInboxSyncService implements OnModuleInit {
  private readonly processingService: EmailInboxProcessingService;

  constructor(
    private readonly em: EntityManager,
    private readonly providerService: EmailInboxProviderService,
    private readonly documentService: DocumentService,
    private readonly aiService: AiService,
    @InjectQueue('email-inbox-sync')
    private readonly queue: Queue<EmailInboxSyncJob>,
    @Optional() processingService?: EmailInboxProcessingService,
  ) {
    this.processingService =
      processingService ?? new EmailInboxProcessingService(em, aiService);
  }

  async onModuleInit(): Promise<void> {
    if (!REDIS_ENABLED) {
      global.log?.warn?.(
        'Redis is disabled. Automatic inbound email synchronization is not scheduled; manual synchronization remains available.',
      );
      return;
    }

    await this.queue.upsertJobScheduler(
      'email-inbox-sync-scheduler',
      { every: SCHEDULER_INTERVAL_MS },
      {
        name: 'schedule-email-inbox-imports',
        data: {},
        opts: {
          removeOnComplete: REDIS_REMOVE_ON_COMPLETE,
          removeOnFail: REDIS_REMOVE_ON_FAIL,
        },
      },
    );
  }

  async enqueueDueSubscriptions(now: Date = new Date()): Promise<number> {
    const em = this.em.fork();
    const subscriptions = await em.find(
      EmailInboxSubscriptionItem,
      { isActive: true },
      { orderBy: { handle: 'ASC' } },
    );
    let queued = 0;

    for (const subscription of subscriptions) {
      if (
        !isEmailInboxSubscriptionDue(subscription, now) ||
        subscription.handle == null
      ) {
        continue;
      }

      const jobId = `email-inbox-${subscription.handle}`;
      const existingJob = await this.queue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        if (
          state === 'active' ||
          state === 'waiting' ||
          state === 'delayed' ||
          state === 'prioritized' ||
          state === 'waiting-children'
        ) {
          continue;
        }
        await existingJob.remove();
      }

      const since = this.calculateSince(subscription, now);
      subscription.lastRunAt = now;
      await this.queue.add(
        'import-email-inbox',
        {
          subscriptionHandle: subscription.handle,
          since: since.toISOString(),
        },
        {
          jobId,
          removeOnComplete: REDIS_REMOVE_ON_COMPLETE,
          removeOnFail: REDIS_REMOVE_ON_FAIL,
        },
      );
      queued += 1;
    }

    if (queued > 0) {
      await em.flush();
    }
    return queued;
  }

  async synchronizeSubscription(
    subscriptionHandle: number,
    sinceOverride?: Date,
    allowInactive = false,
  ): Promise<{ imported: number; skipped: number }> {
    const em = this.em.fork();
    const subscription = await em.findOne(
      EmailInboxSubscriptionItem,
      { handle: subscriptionHandle },
      {
        populate: [
          'mailbox',
          'mailbox.provider',
          'mailbox.group',
          'mailbox.group.persons',
          'processingPerson',
          'processingPerson.type',
          'processingPerson.session',
          'agent',
          'processingMode',
        ],
      },
    );

    if (!subscription || (!subscription.isActive && !allowInactive)) {
      return { imported: 0, skipped: 0 };
    }

    const now = new Date();
    const since = sinceOverride ?? this.calculateSince(subscription, now);
    subscription.lastRunAt = now;
    subscription.lastError = null;
    await em.flush();

    try {
      this.assertMailboxAuthorization(subscription);
      const messages = await this.providerService.fetchMessages(
        subscription.mailbox,
        subscription.processingPerson,
        since,
      );
      messages.sort(
        (left, right) => left.receivedAt.getTime() - right.receivedAt.getTime(),
      );

      let imported = 0;
      let skipped = 0;
      for (const providerMessage of messages) {
        const inbound = await this.persistInboundEmail(
          em,
          subscription,
          providerMessage,
        );
        if (!inbound.created) {
          skipped += 1;
          if (inbound.needsProcessing && inbound.item.handle != null) {
            if (
              subscription.automaticProcessing &&
              getRelationHandle(subscription.agent)
            ) {
              await this.enqueueInboundProcessing(inbound.item.handle);
            } else {
              markInboundEmailForManualReview(
                em,
                inbound.item,
                !subscription.automaticProcessing
                  ? 'emailInbox.processingDisabled'
                  : 'emailInbox.agentNotConfigured',
                !subscription.automaticProcessing
                  ? 'Automatic AI processing is disabled for this inbox.'
                  : 'No AI agent is configured for this inbox.',
              );
              subscription.manualReviewCount += 1;
            }
          }
          continue;
        }

        imported += 1;
        subscription.importedCount += 1;
        subscription.lastReceivedAt = maxDate(
          subscription.lastReceivedAt,
          providerMessage.receivedAt,
        );

        if (inbound.item.handle != null) {
          if (
            !subscription.automaticProcessing ||
            !getRelationHandle(subscription.agent)
          ) {
            markInboundEmailForManualReview(
              em,
              inbound.item,
              !subscription.automaticProcessing
                ? 'emailInbox.processingDisabled'
                : 'emailInbox.agentNotConfigured',
              !subscription.automaticProcessing
                ? 'Automatic AI processing is disabled for this inbox.'
                : 'No AI agent is configured for this inbox.',
            );
            subscription.manualReviewCount += 1;
          } else {
            await this.enqueueInboundProcessing(inbound.item.handle);
          }
        }
      }

      subscription.lastSuccessAt = new Date();
      subscription.lastError = null;
      await em.flush();
      return { imported, skipped };
    } catch (error) {
      subscription.lastError = truncateError(error);
      await em.flush();
      throw error;
    }
  }

  processInboundEmail(handle: number): Promise<void> {
    return this.processingService.processInboundEmail(handle);
  }

  async enqueueSubscriptionNow(subscriptionHandle: number): Promise<void> {
    const now = new Date();
    const em = this.em.fork();
    const subscription = await em.findOne(EmailInboxSubscriptionItem, {
      handle: subscriptionHandle,
    });
    if (!subscription) {
      throw new Error('emailInboxSubscription.notFound');
    }
    const since = this.calculateSince(subscription, now);
    if (REDIS_ENABLED) {
      await this.queue.add(
        'import-email-inbox',
        {
          subscriptionHandle,
          since: since.toISOString(),
          manual: true,
        },
        {
          jobId: `email-inbox-${subscriptionHandle}-manual-${Date.now()}`,
          removeOnComplete: REDIS_REMOVE_ON_COMPLETE,
          removeOnFail: REDIS_REMOVE_ON_FAIL,
        },
      );
      return;
    }
    await this.synchronizeSubscription(subscriptionHandle, since, true);
  }

  async reprocessInboundEmail(handle: number): Promise<void> {
    const em = this.em.fork();
    const email = await em.findOne(
      InboundEmailItem,
      { handle },
      { populate: ['status', 'subscription'] },
    );
    if (!email) {
      throw new Error('inboundEmail.notFound');
    }
    const currentStatus = getRelationHandle(email.status);
    if (currentStatus !== 'manualReview' && currentStatus !== 'failed') {
      throw new Error('inboundEmail.notRetryable');
    }
    if (email.subscription.manualReviewCount > 0) {
      email.subscription.manualReviewCount -= 1;
    }
    email.status = statusReference(em, 'pending');
    email.processingMessage = 'Manual reprocessing requested.';
    appendInboundEmailLog(
      email,
      'info',
      'manual.reprocessRequested',
      'Manual reprocessing was requested.',
    );
    await em.flush();
    await this.enqueueInboundProcessing(handle, true);
  }

  private async enqueueInboundProcessing(
    handle: number,
    manualRetry = false,
  ): Promise<void> {
    if (REDIS_ENABLED) {
      await this.queue.add(
        'process-inbound-email',
        { inboundEmailHandle: handle },
        {
          jobId: manualRetry
            ? `process-inbound-email-${handle}-manual-${Date.now()}`
            : `process-inbound-email-${handle}`,
          removeOnComplete: REDIS_REMOVE_ON_COMPLETE,
          removeOnFail: REDIS_REMOVE_ON_FAIL,
        },
      );
      return;
    }
    await this.processInboundEmail(handle);
  }

  private calculateSince(
    subscription: EmailInboxSubscriptionItem,
    now: Date,
  ): Date {
    if (!subscription.lastRunAt) {
      return subscription.importExistingOnFirstRun
        ? new Date(now.getTime() - FIRST_IMPORT_LOOKBACK_MS)
        : now;
    }
    return new Date(subscription.lastRunAt.getTime() - POLL_OVERLAP_MS);
  }

  private assertMailboxAuthorization(
    subscription: EmailInboxSubscriptionItem,
  ): void {
    const mailbox = subscription.mailbox;
    const person = subscription.processingPerson;
    const mailboxProvider = getRelationHandle(mailbox.provider);
    const personProvider = getRelationHandle(person.type);
    if (mailboxProvider !== personProvider) {
      throw new Error('emailInboxSubscription.providerMismatch');
    }

    if (emailAddressesEqual(mailbox.email, person.email)) {
      return;
    }

    const group = mailbox.group;
    if (!group || typeof group === 'number' || group.isActive === false) {
      throw new Error('emailInboxSubscription.mailboxNotAssigned');
    }
    const personHandle = person.handle;
    const isAssigned = group.persons
      .getItems()
      .some((assigned) => assigned.handle === personHandle);
    if (!isAssigned) {
      throw new Error('emailInboxSubscription.mailboxNotAssigned');
    }
  }

  private async persistInboundEmail(
    em: EntityManager,
    subscription: EmailInboxSubscriptionItem,
    message: ProviderInboundEmail,
  ): Promise<{
    item: InboundEmailItem;
    created: boolean;
    needsProcessing: boolean;
  }> {
    const existing = await em.findOne(
      InboundEmailItem,
      {
        mailbox: { handle: subscription.mailbox.handle },
        providerMessageId: message.providerMessageId,
      },
      { populate: ['status', 'sourceDocument'] },
    );
    if (existing) {
      if (!getRelationHandle(existing.sourceDocument)) {
        await this.attachSourceDocument(
          em,
          existing,
          subscription.processingPerson,
          message,
        );
      }
      return {
        item: existing,
        created: false,
        needsProcessing: getRelationHandle(existing.status) === 'pending',
      };
    }

    const contact = await this.matchContact(em, message.fromAddress);
    const item = em.create(InboundEmailItem, {
      status: statusReference(em, 'pending'),
      subscription,
      mailbox: subscription.mailbox,
      provider: message.provider,
      providerMessageId: message.providerMessageId,
      internetMessageId: message.internetMessageId ?? null,
      conversationId: message.conversationId ?? null,
      inReplyTo: message.inReplyTo ?? null,
      references: message.references ?? null,
      subject: message.subject.slice(0, 512),
      fromAddress: message.fromAddress,
      fromName: message.fromName ?? null,
      toRecipients: message.toRecipients,
      ccRecipients: message.ccRecipients,
      bodyText: message.bodyText ?? null,
      bodyHtml: message.bodyHtml ?? null,
      headers: message.headers,
      receivedAt: message.receivedAt,
      processingAttempts: 0,
      person: contact.person,
      company: contact.company,
      processingLog: [
        createInboundEmailLogEntry(
          'info',
          'import.persisted',
          'Inbound email imported and persisted.',
          {
            provider: message.provider,
            providerMessageId: message.providerMessageId,
            matchedPersonHandle: contact.person?.handle ?? null,
            matchedCompanyHandle: contact.company?.handle ?? null,
          },
        ),
      ],
    });
    em.persist(item);
    await em.flush();

    await this.attachSourceDocument(
      em,
      item,
      subscription.processingPerson,
      message,
    );
    return { item, created: true, needsProcessing: true };
  }

  private async attachSourceDocument(
    em: EntityManager,
    item: InboundEmailItem,
    processingPerson: PersonItem,
    message: ProviderInboundEmail,
  ): Promise<void> {
    const document = await this.documentService.uploadDocument(
      {
        buffer: message.raw,
        originalname: buildEmlFilename(message.subject, message.receivedAt),
        mimetype: 'message/rfc822',
        size: message.raw.length,
      } as Express.Multer.File,
      'inboundEmail',
      String(item.handle),
      'email',
      processingPerson,
      `Original inbound email from ${message.fromAddress}`,
    );
    item.sourceDocument = { handle: document.handle } as DocumentItem;
    appendInboundEmailLog(
      item,
      'info',
      'document.created',
      'The complete RFC 822 message was stored as a document.',
      { documentHandle: document.handle, filename: document.filename },
    );
    await em.flush();
  }

  private async matchContact(
    em: EntityManager,
    fromAddress: string,
  ): Promise<{ person: PersonItem | null; company: CompanyItem | null }> {
    const normalized = normalizeEmailAddress(fromAddress);
    if (!normalized) {
      return { person: null, company: null };
    }

    const person = await em.findOne(
      PersonItem,
      { email: { $ilike: normalized } },
      { populate: ['company'] },
    );
    if (person) {
      return {
        person,
        company:
          person.company && typeof person.company !== 'number'
            ? person.company
            : null,
      };
    }

    const company = await em.findOne(CompanyItem, {
      email: { $ilike: normalized },
    });
    return { person: null, company };
  }
}
