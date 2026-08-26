import { CompanyItem } from '../../entity/CompanyItem';
import { EmailInboxSubscriptionItem } from '../../entity/EmailInboxSubscriptionItem';
import { InboundEmailItem } from '../../entity/InboundEmailItem';
import { PersonItem } from '../../entity/PersonItem';

jest.mock('../../constants/project.constants', () => ({
  ...jest.requireActual<typeof import('../../constants/project.constants')>(
    '../../constants/project.constants',
  ),
  REDIS_ENABLED: true,
  REDIS_REMOVE_ON_COMPLETE: true,
  REDIS_REMOVE_ON_FAIL: 100,
}));

jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
jest.mock('../document/document.service', () => ({
  DocumentService: class {},
}));

import { EmailInboxSyncService } from './email-inbox-sync.service';

describe('EmailInboxSyncService', () => {
  it('registers automatic polling with the BullMQ job scheduler API', async () => {
    const queue = {
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EmailInboxSyncService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      queue as never,
    );

    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'email-inbox-sync-scheduler',
      { every: 60_000 },
      {
        name: 'schedule-email-inbox-imports',
        data: {},
        opts: { removeOnComplete: true, removeOnFail: 100 },
      },
    );
  });

  it('does not enqueue a second import while the subscription job is delayed', async () => {
    const lastRunAt = new Date('2026-07-13T12:00:00.000Z');
    const subscription = {
      handle: 3,
      isActive: true,
      intervalMinutes: 1,
      lastRunAt,
    } as EmailInboxSubscriptionItem;
    const em = {
      fork: jest.fn(),
      find: jest.fn().mockResolvedValue([subscription]),
      flush: jest.fn().mockResolvedValue(undefined),
    };
    em.fork.mockReturnValue(em);
    const existingJob = {
      getState: jest.fn().mockResolvedValue('delayed'),
      remove: jest.fn(),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(existingJob),
      add: jest.fn(),
    };
    const service = new EmailInboxSyncService(
      em as never,
      {} as never,
      {} as never,
      {} as never,
      queue as never,
    );

    const queued = await service.enqueueDueSubscriptions(
      new Date('2026-07-13T12:10:00.000Z'),
    );

    expect(queued).toBe(0);
    expect(queue.getJob).toHaveBeenCalledWith('email-inbox-3');
    expect(queue.add).not.toHaveBeenCalled();
    expect(existingJob.remove).not.toHaveBeenCalled();
    expect(subscription.lastRunAt).toBe(lastRunAt);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('replaces a terminal import job with one stable subscription job', async () => {
    const subscription = {
      handle: 3,
      isActive: true,
      intervalMinutes: 1,
      lastRunAt: new Date('2026-07-13T12:00:00.000Z'),
    } as EmailInboxSubscriptionItem;
    const now = new Date('2026-07-13T12:10:00.000Z');
    const em = {
      fork: jest.fn(),
      find: jest.fn().mockResolvedValue([subscription]),
      flush: jest.fn().mockResolvedValue(undefined),
    };
    em.fork.mockReturnValue(em);
    const existingJob = {
      getState: jest.fn().mockResolvedValue('failed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(existingJob),
      add: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EmailInboxSyncService(
      em as never,
      {} as never,
      {} as never,
      {} as never,
      queue as never,
    );

    const queued = await service.enqueueDueSubscriptions(now);

    expect(queued).toBe(1);
    expect(existingJob.remove).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'import-email-inbox',
      expect.objectContaining({ subscriptionHandle: 3 }),
      expect.objectContaining({ jobId: 'email-inbox-3' }),
    );
    expect(subscription.lastRunAt).toBe(now);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('allows one explicit synchronization while automatic polling is disabled', async () => {
    const subscription = createSubscription({ isActive: false });
    const em = {
      fork: jest.fn(),
      findOne: jest.fn().mockResolvedValue(subscription),
      flush: jest.fn().mockResolvedValue(undefined),
    };
    em.fork.mockReturnValue(em);
    const providerService = {
      fetchMessages: jest.fn().mockResolvedValue([]),
    };
    const service = new EmailInboxSyncService(
      em as never,
      providerService as never,
      {} as never,
      {} as never,
      { add: jest.fn() } as never,
    );

    await expect(service.synchronizeSubscription(3)).resolves.toEqual({
      imported: 0,
      skipped: 0,
    });
    expect(providerService.fetchMessages).not.toHaveBeenCalled();

    const since = new Date('2026-07-14T08:00:00.000Z');
    await expect(
      service.synchronizeSubscription(3, since, true),
    ).resolves.toEqual({ imported: 0, skipped: 0 });
    expect(providerService.fetchMessages).toHaveBeenCalledWith(
      subscription.mailbox,
      subscription.processingPerson,
      since,
    );
    expect(subscription.lastSuccessAt).toBeInstanceOf(Date);
  });

  it('marks an immediate subscription job as a manual run', async () => {
    const subscription = {
      handle: 3,
      isActive: false,
      intervalMinutes: 1,
      lastRunAt: new Date('2026-07-14T07:55:00.000Z'),
    } as EmailInboxSubscriptionItem;
    const em = {
      fork: jest.fn(),
      findOne: jest.fn().mockResolvedValue(subscription),
    };
    em.fork.mockReturnValue(em);
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new EmailInboxSyncService(
      em as never,
      {} as never,
      {} as never,
      {} as never,
      queue as never,
    );

    await service.enqueueSubscriptionNow(3);

    expect(queue.add).toHaveBeenCalledWith(
      'import-email-inbox',
      expect.objectContaining({ subscriptionHandle: 3, manual: true }),
      expect.objectContaining({
        jobId: expect.stringMatching(/^email-inbox-3-manual-/) as unknown,
      }),
    );
  });

  it('persists an inbound message, matches its sender and stores the complete source document', async () => {
    const subscription = createSubscription({
      processingPerson: {
        handle: 5,
        email: 'Support@Example.com',
        type: { handle: 'azure' },
      } as never,
    });
    const matchedPerson = {
      handle: 7,
      email: 'customer@example.com',
      company: { handle: 8 },
    };
    const providerMessage = createProviderMessage();
    let persistedEmail: InboundEmailItem | undefined;
    const em = {
      fork: jest.fn(),
      findOne: jest.fn((entity: unknown) => {
        if (entity === EmailInboxSubscriptionItem) return subscription;
        if (entity === InboundEmailItem) return null;
        if (entity === PersonItem) return matchedPerson;
        if (entity === CompanyItem) return null;
        return null;
      }),
      create: jest.fn((_entity: unknown, data: object) => {
        persistedEmail = Object.assign(new InboundEmailItem(), data, {
          handle: 42,
        });
        return persistedEmail;
      }),
      persist: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      getReference: jest.fn((_entity: unknown, handle: string) => ({ handle })),
    };
    em.fork.mockReturnValue(em);
    const providerService = {
      fetchMessages: jest.fn().mockResolvedValue([providerMessage]),
    };
    const documentService = {
      uploadDocument: jest.fn().mockResolvedValue({
        handle: 9,
        filename: 'message.eml',
      }),
    };
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new EmailInboxSyncService(
      em as never,
      providerService as never,
      documentService as never,
      {} as never,
      queue as never,
    );

    const result = await service.synchronizeSubscription(
      3,
      new Date('2026-07-13T11:55:00.000Z'),
    );

    expect(result).toEqual({ imported: 1, skipped: 0 });
    expect(documentService.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: providerMessage.raw,
        mimetype: 'message/rfc822',
        size: providerMessage.raw.length,
      }),
      'inboundEmail',
      '42',
      'email',
      subscription.processingPerson,
      'Original inbound email from customer@example.com',
    );
    expect(persistedEmail).toMatchObject({
      handle: 42,
      person: matchedPerson,
      company: matchedPerson.company,
      sourceDocument: { handle: 9 },
      status: { handle: 'manualReview' },
    });
    expect(persistedEmail?.processingLog?.map((entry) => entry.code)).toEqual([
      'import.persisted',
      'document.created',
      'emailInbox.agentNotConfigured',
    ]);
    expect(subscription).toMatchObject({
      importedCount: 1,
      manualReviewCount: 1,
      lastReceivedAt: providerMessage.receivedAt,
      lastError: null,
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('skips an already imported provider message without creating a second document', async () => {
    const subscription = createSubscription({ importedCount: 1 });
    const existing = {
      handle: 42,
      status: { handle: 'pending' },
      sourceDocument: { handle: 9 },
      processingLog: [],
    } as unknown as InboundEmailItem;
    const em = {
      fork: jest.fn(),
      findOne: jest.fn((entity: unknown) =>
        entity === EmailInboxSubscriptionItem ? subscription : existing,
      ),
      create: jest.fn(),
      persist: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      getReference: jest.fn((_entity: unknown, handle: string) => ({ handle })),
    };
    em.fork.mockReturnValue(em);
    const documentService = { uploadDocument: jest.fn() };
    const service = new EmailInboxSyncService(
      em as never,
      {
        fetchMessages: jest.fn().mockResolvedValue([createProviderMessage()]),
      } as never,
      documentService as never,
      {} as never,
      { add: jest.fn() } as never,
    );

    const result = await service.synchronizeSubscription(3);

    expect(result).toEqual({ imported: 0, skipped: 1 });
    expect(em.create).not.toHaveBeenCalled();
    expect(documentService.uploadDocument).not.toHaveBeenCalled();
    expect(existing.status).toEqual({ handle: 'manualReview' });
    expect(subscription.importedCount).toBe(1);
    expect(subscription.manualReviewCount).toBe(1);
  });

  it('queues a fresh job when a failed message is manually reprocessed', async () => {
    const subscription = {
      manualReviewCount: 1,
    } as unknown as EmailInboxSubscriptionItem;
    const email = {
      handle: 42,
      status: { handle: 'failed' },
      subscription,
      processingLog: [],
    } as unknown as InboundEmailItem;
    const em = {
      fork: jest.fn(),
      findOne: jest.fn().mockResolvedValue(email),
      flush: jest.fn().mockResolvedValue(undefined),
      getReference: jest.fn((_entity: unknown, handle: string) => ({ handle })),
    };
    em.fork.mockReturnValue(em);
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new EmailInboxSyncService(
      em as never,
      {} as never,
      {} as never,
      {} as never,
      queue as never,
    );

    await service.reprocessInboundEmail(42);

    expect(email.status).toEqual({ handle: 'pending' });
    expect(email.processingMessage).toBe('Manual reprocessing requested.');
    expect(subscription.manualReviewCount).toBe(0);
    expect(queue.add).toHaveBeenCalledWith(
      'process-inbound-email',
      { inboundEmailHandle: 42 },
      expect.objectContaining({
        jobId: expect.stringMatching(
          /^process-inbound-email-42-manual-\d+$/,
        ) as unknown,
      }),
    );
  });

  it('does not manually reprocess an already processed email', async () => {
    const em = {
      fork: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        handle: 42,
        status: { handle: 'processed' },
        subscription: { manualReviewCount: 0 },
      }),
      flush: jest.fn(),
    };
    em.fork.mockReturnValue(em);
    const queue = { add: jest.fn() };
    const service = new EmailInboxSyncService(
      em as never,
      {} as never,
      {} as never,
      {} as never,
      queue as never,
    );

    await expect(service.reprocessInboundEmail(42)).rejects.toThrow(
      'inboundEmail.notRetryable',
    );
    expect(em.flush).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});

function createSubscription(
  overrides: Partial<EmailInboxSubscriptionItem> = {},
): EmailInboxSubscriptionItem {
  return {
    handle: 3,
    isActive: true,
    mailbox: {
      handle: 4,
      email: 'support@example.com',
      provider: { handle: 'azure' },
    },
    processingPerson: {
      handle: 5,
      email: 'support@example.com',
      type: { handle: 'azure' },
    },
    processingMode: { handle: 'ticket' },
    agent: null,
    automaticProcessing: true,
    intervalMinutes: 1,
    importedCount: 0,
    processedCount: 0,
    manualReviewCount: 0,
    ...overrides,
  } as unknown as EmailInboxSubscriptionItem;
}

function createProviderMessage() {
  return {
    provider: 'azure' as const,
    providerMessageId: 'message-1',
    internetMessageId: '<message-1@example.com>',
    subject: 'New support request',
    fromAddress: 'customer@example.com',
    fromName: 'Customer',
    toRecipients: ['support@example.com'],
    ccRecipients: [],
    bodyText: 'Please help.',
    bodyHtml: null,
    headers: { subject: 'New support request' },
    receivedAt: new Date('2026-07-13T12:00:00.000Z'),
    raw: Buffer.from('complete RFC 822 source'),
  };
}
