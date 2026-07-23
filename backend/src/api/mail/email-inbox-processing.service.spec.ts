import { AiChatToolActionItem } from '../../entity/AiChatToolActionItem';
import {
  EmailInboxSubscriptionItem,
  type EmailInboxProcessingMode,
} from '../../entity/EmailInboxSubscriptionItem';
import { InboundEmailItem } from '../../entity/InboundEmailItem';

jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

import { EmailInboxProcessingService } from './email-inbox-processing.service';

type ProcessingHarnessOptions = {
  processingMode?: EmailInboxProcessingMode;
  action?: Partial<AiChatToolActionItem>;
  email?: Partial<InboundEmailItem>;
  subscription?: Partial<EmailInboxSubscriptionItem>;
};

function createProcessingHarness(options: ProcessingHarnessOptions = {}) {
  const processingMode = options.processingMode ?? 'ticket';
  const targetEntity =
    processingMode === 'officeTask' ? 'event' : processingMode;
  const subscription = {
    handle: 3,
    automaticProcessing: true,
    agent: { handle: 'inbound-agent' },
    processingMode: { handle: processingMode },
    processingPerson: { handle: 5, roles: [] },
    processedCount: 0,
    manualReviewCount: 0,
    ...options.subscription,
  } as unknown as EmailInboxSubscriptionItem;
  const email = {
    handle: 42,
    status: { handle: 'pending' },
    subscription,
    mailbox: { handle: 4 },
    subject: 'Please create the target record',
    bodyText: 'Please help.',
    fromAddress: 'customer@example.com',
    toRecipients: ['support@example.com'],
    ccRecipients: [],
    receivedAt: new Date('2026-07-13T12:00:00.000Z'),
    person: { handle: 7 },
    company: { handle: 8 },
    processingAttempts: 0,
    processingLog: [],
    ...options.email,
  } as unknown as InboundEmailItem;
  const action = {
    handle: 17,
    toolName: 'generic_create',
    arguments: { entityHandle: targetEntity, data: {} },
    status: 'pending',
    ...options.action,
  } as AiChatToolActionItem;
  const em = {
    fork: jest.fn(),
    findOne: jest.fn().mockResolvedValue(email),
    find: jest.fn().mockResolvedValue([action]),
    flush: jest.fn().mockResolvedValue(undefined),
    getReference: jest.fn((_entity: unknown, handle: string) => ({ handle })),
  };
  em.fork.mockReturnValue(em);
  const aiService = {
    streamChatMessage: jest.fn().mockResolvedValue({
      session: { handle: 10 },
      assistantMessage: { handle: 11 },
    }),
    confirmToolAction: jest.fn().mockResolvedValue({
      status: 'executed',
      resultPayload: { modelResult: { handle: 123 } },
    }),
  };

  return {
    action,
    aiService,
    email,
    em,
    service: new EmailInboxProcessingService(em as never, aiService as never),
    subscription,
  };
}

describe('EmailInboxProcessingService', () => {
  it.each([
    ['ticket', 'ticket'],
    ['salesOpportunity', 'salesOpportunity'],
    ['officeTask', 'officeTask'],
  ] as const)(
    'executes and links the single permitted %s mutation',
    async (processingMode, relationName) => {
      const harness = createProcessingHarness({ processingMode });

      await harness.service.processInboundEmail(42);

      expect(harness.em.findOne).toHaveBeenCalledWith(
        InboundEmailItem,
        { handle: 42 },
        expect.objectContaining({
          populate: expect.arrayContaining([
            'subscription.processingPerson.roles.stage',
            'subscription.processingPerson.roles.permissions',
            'subscription.processingPerson.roles.permissions.entity',
            'subscription.processingPerson.roles.permissions.fieldPermissions',
          ]) as unknown,
        }),
      );
      expect(harness.aiService.confirmToolAction).toHaveBeenCalledWith(
        17,
        harness.subscription.processingPerson,
      );
      expect(
        (harness.email as unknown as Record<string, { handle: number }>)[
          relationName
        ],
      ).toEqual({ handle: 123 });
      expect(harness.email.status).toEqual({ handle: 'processed' });
      expect(harness.email.processingAttempts).toBe(1);
      expect(harness.email.processingLog?.map((entry) => entry.code)).toEqual([
        'ai.started',
        'ai.completed',
        'ai.actionExecuted',
      ]);
      expect(harness.subscription.processedCount).toBe(1);
      expect(harness.subscription.manualReviewCount).toBe(0);
    },
  );

  it('uses one corrective AI turn when the first response contains no mutation', async () => {
    const harness = createProcessingHarness({
      email: {
        subject: 'Sage 100 Buchungsfehler',
        bodyText: 'Beim Buchen erscheint ein Fehler.',
        receivedAt: new Date('2026-07-14T11:46:37.000Z'),
        person: { handle: 102 } as never,
        company: { handle: 27 } as never,
      },
      subscription: { agent: { handle: 'ticketSupportAgent' } as never },
    });
    harness.em.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([harness.action]);
    harness.aiService.streamChatMessage
      .mockResolvedValueOnce({
        session: { handle: 10, provider: 'openai', model: 'gpt-5' },
        assistantMessage: { handle: 11 },
      })
      .mockResolvedValueOnce({
        session: { handle: 10, provider: 'openai', model: 'gpt-5' },
        assistantMessage: { handle: 12 },
      });

    await harness.service.processInboundEmail(42);

    expect(harness.aiService.streamChatMessage).toHaveBeenCalledTimes(2);
    expect(harness.aiService.streamChatMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sessionHandle: 10,
        content: expect.stringContaining(
          'Do not answer with analysis or prose only',
        ) as unknown,
        contextPayload: expect.objectContaining({
          phase: 'actionRepair',
        }) as unknown,
      }),
      harness.subscription.processingPerson,
      expect.any(Function),
    );
    expect(harness.action.arguments?.data).toEqual({
      creatorPerson: 102,
      creatorCompany: 27,
      type: 'incident',
      source: 'email',
    });
    expect(harness.email.status).toEqual({ handle: 'processed' });
    expect(harness.email.aiMessage).toEqual({ handle: 12 });
    expect(harness.email.processingLog?.map((entry) => entry.code)).toEqual([
      'ai.started',
      'ai.completed',
      'ai.actionRepairStarted',
      'ai.actionRepairCompleted',
      'ai.actionExecuted',
    ]);
  });

  it('records an AI failure once and waits for an explicit manual retry', async () => {
    const harness = createProcessingHarness({
      email: { subject: 'Provider failure' },
    });
    harness.aiService.streamChatMessage.mockRejectedValue(
      new Error('provider unavailable'),
    );

    await expect(
      harness.service.processInboundEmail(42),
    ).resolves.toBeUndefined();
    await expect(
      harness.service.processInboundEmail(42),
    ).resolves.toBeUndefined();

    expect(harness.aiService.streamChatMessage).toHaveBeenCalledTimes(1);
    expect(harness.email.status).toEqual({ handle: 'failed' });
    expect(harness.email.processingMessage).toBe('provider unavailable');
    expect(harness.email.processingLog?.at(-1)).toMatchObject({
      level: 'error',
      code: 'ai.failed',
    });
    expect(harness.subscription.manualReviewCount).toBe(1);
  });

  it('records an actionable provider authorization failure for a 401', async () => {
    const harness = createProcessingHarness({
      subscription: { agent: { handle: 'ticketSupportAgent' } as never },
    });
    const providerError = Object.assign(
      new Error('401 You have insufficient permissions for this operation.'),
      { status: 401 },
    );
    harness.aiService.streamChatMessage.mockRejectedValue(providerError);

    await expect(
      harness.service.processInboundEmail(42),
    ).resolves.toBeUndefined();

    expect(harness.email.status).toEqual({ handle: 'failed' });
    expect(harness.email.processingMessage).toContain(
      'AI provider authorization failed (401)',
    );
    expect(harness.email.processingLog?.at(-1)).toMatchObject({
      level: 'error',
      code: 'ai.providerAuthorizationFailed',
      details: {
        statusCode: 401,
        agentHandle: 'ticketSupportAgent',
        error: '401 You have insufficient permissions for this operation.',
      },
    });
    expect(harness.subscription.manualReviewCount).toBe(1);
  });

  it('does not execute an AI mutation outside the configured target entity', async () => {
    const harness = createProcessingHarness({
      email: { subject: 'Unsafe target' },
      action: {
        arguments: { entityHandle: 'company', data: {} },
      },
    });

    await harness.service.processInboundEmail(42);

    expect(harness.aiService.confirmToolAction).not.toHaveBeenCalled();
    expect(harness.email.status).toEqual({ handle: 'manualReview' });
    expect(harness.email.processingLog?.at(-1)).toMatchObject({
      level: 'warning',
      code: 'emailInbox.actionRequiresReview',
    });
    expect(harness.subscription.manualReviewCount).toBe(1);
  });
});
