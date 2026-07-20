import { EmailAutomationService } from './email-automation.service';

type MockEntityManager = {
  find: jest.Mock;
  findOne: jest.Mock;
};

function createService(options?: {
  subscriptions?: object[];
  recipientValue?: unknown;
  sender?: object | null;
}): {
  em: MockEntityManager;
  mailService: { sendEmail: jest.Mock };
  messageTemplateService: {
    buildContext: jest.Mock;
    getContextValue: jest.Mock;
  };
  service: EmailAutomationService;
} {
  const em: MockEntityManager = {
    find: jest.fn().mockResolvedValue(options?.subscriptions ?? []),
    findOne: jest.fn().mockResolvedValue(
      options?.sender === null
        ? null
        : (options?.sender ?? {
            handle: 42,
            type: { handle: 'azure' },
            session: { refreshToken: 'refresh-token' },
          }),
    ),
  };
  const mailService = {
    sendEmail: jest.fn().mockResolvedValue({ handle: 31 }),
  };
  const messageTemplateService = {
    buildContext: jest.fn().mockResolvedValue({
      creatorPerson: { handle: 7, email: 'ada@example.test' },
    }),
    getContextValue: jest
      .fn()
      .mockReturnValue(
        options?.recipientValue ?? { handle: 7, email: 'ada@example.test' },
      ),
  };

  return {
    em,
    mailService,
    messageTemplateService,
    service: new EmailAutomationService(
      em as never,
      mailService as never,
      messageTemplateService as never,
    ),
  };
}

function createSubscription(overrides: Record<string, unknown> = {}) {
  return {
    handle: 12,
    description: 'Ticket confirmation',
    recipientField: 'creatorPerson',
    conditions: [],
    senderPerson: { handle: 42 },
    template: { handle: 3, isActive: true },
    ...overrides,
  };
}

describe('EmailAutomationService', () => {
  it('sends active afterInsert subscriptions to the configured person field', async () => {
    const subscription = createSubscription();
    const { em, mailService, messageTemplateService, service } = createService({
      subscriptions: [subscription],
    });

    await service.handleAfterInsert(
      'ticket',
      { handle: 101, creatorPerson: { handle: 7 } },
      { handle: 1, email: 'agent@example.test' } as never,
    );

    expect(em.find).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isActive: true,
        entity: { handle: 'ticket' },
        type: { handle: 'afterInsert' },
      },
      {
        populate: [
          'entity',
          'type',
          'template',
          'senderPerson',
          'senderMailbox',
          'conditions',
        ],
      },
    );
    expect(messageTemplateService.getContextValue).toHaveBeenCalledWith(
      expect.any(Object),
      'creatorPerson',
    );
    expect(mailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        entityHandle: 'ticket',
        itemHandle: 101,
        templateHandle: 3,
        to: ['ada@example.test'],
      }),
      expect.objectContaining({ handle: 42 }),
    );
  });

  it('sends from the configured shared mailbox using the sender person session', async () => {
    const subscription = createSubscription({
      senderMailbox: {
        handle: 9,
        email: 'support@example.test',
      },
    });
    const { mailService, service } = createService({
      subscriptions: [subscription],
    });

    await service.handleAfterInsert(
      'ticket',
      { handle: 101, creatorPerson: { handle: 7 } },
      { handle: 1 } as never,
    );

    expect(mailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        senderEmail: 'support@example.test',
      }),
      expect.objectContaining({ handle: 42 }),
    );
  });

  it('sends afterUpdate subscriptions without conditions', async () => {
    const subscription = createSubscription({ conditions: [] });
    const { mailService, service } = createService({
      subscriptions: [subscription],
    });

    await service.handleAfterUpdate(
      'ticket',
      101,
      { title: 'Old' },
      { title: 'New' },
      { handle: 1 } as never,
    );

    expect(mailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('sends afterUpdate subscriptions when all configured conditions match', async () => {
    const subscription = createSubscription({
      conditions: [
        { observedField: 'solutionDescription' },
        { observedField: 'status', newValue: 'closed' },
      ],
    });
    const { mailService, service } = createService({
      subscriptions: [subscription],
    });

    await service.handleAfterUpdate(
      'ticket',
      101,
      { solutionDescription: 'Old', status: 'open' },
      { solutionDescription: 'New', status: 'closed' },
      { handle: 1 } as never,
    );

    expect(mailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(mailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        entityHandle: 'ticket',
        itemHandle: 101,
        templateHandle: 3,
        to: ['ada@example.test'],
      }),
      expect.objectContaining({ handle: 42 }),
    );
  });

  it('skips afterUpdate subscriptions when any configured condition does not match', async () => {
    const subscription = createSubscription({
      conditions: [
        { observedField: 'solutionDescription' },
        { observedField: 'status', newValue: 'closed' },
      ],
    });
    const { mailService, service } = createService({
      subscriptions: [subscription],
    });

    await service.handleAfterUpdate(
      'ticket',
      101,
      { solutionDescription: 'Same', status: 'open' },
      { solutionDescription: 'Same', status: 'closed' },
      { handle: 1 } as never,
    );

    expect(mailService.sendEmail).not.toHaveBeenCalled();
  });
});
