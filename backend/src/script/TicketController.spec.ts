import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../entity/EntityItem', () => ({ EntityItem: class {} }));
jest.mock('../entity/PersonItem', () => ({ PersonItem: class {} }));
jest.mock('../entity/TicketItem', () => ({ TicketItem: class {} }));

import { TicketController } from './TicketController';
import type { TicketItem } from '../entity/TicketItem';
import { ScriptResultClientMethods } from './core/script.result.client';
import { ScriptResultServerMethods } from './core/script.result.server';

describe('TicketController', () => {
  beforeEach(() => {
    global.log = {
      trace: jest.fn(),
      warn: jest.fn(),
    } as unknown as typeof global.log;
  });

  it('assigns a year-based ticket number after insert and returns overwrite', async () => {
    const items = [
      {
        handle: 42,
        createdAt: new Date('2026-04-19T10:15:00.000Z'),
      },
    ] as TicketItem[];
    const controller = new TicketController(
      { handle: 'ticket' } as never,
      { handle: 99 } as never,
      {} as never,
    );

    const result = await controller.afterInsert(items);

    expect(items[0].number).toBe('2026#00042');
    expect(result.items).toBe(items);
    expect(result.method).toBe(ScriptResultServerMethods.overwrite);
  });

  it('creates a knowledge article draft through the generic AI generation service', async () => {
    type GenerateFromScriptButtonMock = (
      ...args: unknown[]
    ) => Promise<unknown>;
    const aiEntityGenerationService = {
      generateFromScriptButton: jest
        .fn<GenerateFromScriptButtonMock>()
        .mockResolvedValue({
          templateHandle: 'ticketKnowledgeArticle',
          targetEntityHandle: 'knowledgeArticle',
          createdItem: {
            handle: 15,
            title: 'Cache invalidation',
          },
          payload: {},
        }),
    };
    const controller = new TicketController(
      { handle: 'ticket' } as never,
      { handle: 99 } as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      aiEntityGenerationService as never,
    );

    const result = await controller.execute(
      [{ handle: 42 }],
      'aiCreateKnowledgeArticle',
      { template: 'ticketKnowledgeArticle' },
    );

    expect(
      aiEntityGenerationService.generateFromScriptButton,
    ).toHaveBeenCalledWith({
      items: [{ handle: 42 }],
      sourceEntity: { handle: 'ticket' },
      user: { handle: 99 },
      actionName: 'aiCreateKnowledgeArticle',
      parameter: { template: 'ticketKnowledgeArticle' },
    });
    expect(result.method).toBe(ScriptResultClientMethods.showMessage);
    expect(result.item).toMatchObject({ handle: 15 });
    expect(JSON.parse(result.parameter)).toMatchObject({
      message: 'aiEntityGeneration.created',
      entity: 'knowledgeArticle',
      technical: {
        template: 'ticketKnowledgeArticle',
        targetEntity: 'knowledgeArticle',
        targetHandle: 15,
      },
    });
  });

  it('opens Songbird with a ticket reference search prompt', async () => {
    const controller = new TicketController(
      { handle: 'ticket' } as never,
      { handle: 99 } as never,
      {} as never,
    );

    const result = await controller.execute(
      [
        {
          handle: 42,
          number: '2026#00042',
          title: 'Cache invalidation',
          externalNumber: 'EXT-7',
          problemDescription: 'Cache entries are stale after deployment.',
          solutionDescription: 'Clear generated cache and warm it again.',
        },
      ],
      'aiFindTicketReferences',
    );

    expect(result.method).toBe(ScriptResultClientMethods.callURL);
    expect(result.parameter).toContain('sapling-ai-chat://prompt?');

    const url = new URL(result.parameter);
    const prompt = url.searchParams.get('prompt') ?? '';

    expect(url.searchParams.get('title')).toBe(
      'Ticket mit Referenzen analysieren',
    );
    expect(url.searchParams.get('autoSend')).toBe('true');
    expect(url.searchParams.get('newChat')).toBe('true');
    expect(prompt).toContain('Aktuelles Ticket: 42 - 2026#00042');
    expect(prompt).toContain('Cache invalidation');
    expect(prompt).toContain('entityHandle: ticket, handle: 42');
    expect(prompt).toContain('knowledge_search');
    expect(prompt).toContain('ticket_search');
  });

  it('derives support defaults before insert', async () => {
    const contract = {
      handle: 17,
      defaultSupportQueue: {
        handle: 'helpdesk',
        team: { handle: 'ops' },
        defaultSlaPolicy: {
          handle: 'standard',
          firstResponseHours: 4,
          resolutionHours: 24,
        },
      },
      defaultSupportTeam: { handle: 'ops' },
      slaPolicy: {
        handle: 'standard',
        firstResponseHours: 4,
        resolutionHours: 24,
      },
    };
    const em = {
      find: jest.fn<() => Promise<object[]>>().mockResolvedValue([contract]),
      findOne: jest.fn<() => Promise<object | null>>().mockResolvedValue(null),
    };
    const controller = new TicketController(
      { handle: 'ticket' } as never,
      { handle: 99 } as never,
      em as never,
    );

    const result = await controller.beforeInsert([
      {
        creatorCompany: 5,
        startDate: '2026-04-27T08:00:00.000Z',
        status: 'open',
      },
    ] as unknown as TicketItem[]);
    const derivedTicket = result.items[0] as Record<string, unknown>;

    expect(result.method).toBe(ScriptResultServerMethods.overwrite);
    expect(derivedTicket).toMatchObject({
      contract: 17,
      supportQueue: 'helpdesk',
      supportTeam: 'ops',
      slaPolicy: 'standard',
    });
    expect(derivedTicket.firstResponseDueAt).toEqual(
      new Date('2026-04-27T12:00:00.000Z'),
    );
    expect(derivedTicket.resolutionDueAt).toEqual(
      new Date('2026-04-28T08:00:00.000Z'),
    );
  });

  it('uses current update item context for ticket SLA derivation', async () => {
    const em = {
      find: jest.fn<() => Promise<object[]>>().mockResolvedValue([]),
      findOne: jest.fn<() => Promise<object | null>>().mockResolvedValue({
        handle: 'priority',
        firstResponseHours: 2,
        resolutionHours: 8,
      }),
    };
    const controller = new TicketController(
      { handle: 'ticket' } as never,
      { handle: 99 } as never,
      em as never,
    );

    const result = await controller.beforeUpdate(
      [
        {
          slaPolicy: 'priority',
          status: 'inProgress',
        },
      ] as unknown as TicketItem[],
      {
        currentItems: [
          {
            startDate: '2026-04-27T08:00:00.000Z',
          },
        ],
      },
    );
    const derivedTicket = result.items[0] as Record<string, unknown>;

    expect(result.method).toBe(ScriptResultServerMethods.overwrite);
    expect(derivedTicket.firstResponseDueAt).toEqual(
      new Date('2026-04-27T10:00:00.000Z'),
    );
    expect(derivedTicket.resolutionDueAt).toEqual(
      new Date('2026-04-27T16:00:00.000Z'),
    );
    expect(derivedTicket.firstRespondedAt).toEqual(
      new Date('2026-04-27T08:00:00.000Z'),
    );
  });

  it('does not use an assignee company contract when the customer has none', async () => {
    const assigneeContract = {
      handle: 23,
      defaultSupportQueue: {
        handle: 'internal',
        team: { handle: 'internal-team' },
        defaultSlaPolicy: {
          handle: 'internal-sla',
          firstResponseHours: 1,
          resolutionHours: 4,
        },
      },
      defaultSupportTeam: { handle: 'internal-team' },
      slaPolicy: {
        handle: 'internal-sla',
        firstResponseHours: 1,
        resolutionHours: 4,
      },
    };
    const em = {
      find: jest
        .fn<
          (
            entity: unknown,
            filter: object,
            options: object,
          ) => Promise<object[]>
        >()
        .mockImplementation(async (_entity, filter, _options) =>
          (filter as { company?: { handle?: number } }).company?.handle === 10
            ? [assigneeContract]
            : [],
        ),
      findOne: jest.fn<() => Promise<object | null>>().mockResolvedValue(null),
    };
    const controller = new TicketController(
      { handle: 'ticket' } as never,
      { handle: 99 } as never,
      em as never,
    );

    const result = await controller.beforeInsert([
      {
        creatorCompany: 30,
        assigneeCompany: 10,
        startDate: '2026-07-23T13:07:00.000Z',
        status: 'open',
      },
    ] as unknown as TicketItem[]);
    const derivedTicket = result.items[0] as Record<string, unknown>;

    expect(em.find).toHaveBeenCalledTimes(1);
    expect(em.find).toHaveBeenCalledWith(
      expect.anything(),
      {
        company: { handle: 30 },
        isActive: true,
      },
      expect.anything(),
    );
    expect(derivedTicket).not.toHaveProperty('contract');
    expect(derivedTicket).not.toHaveProperty('supportQueue');
    expect(derivedTicket).not.toHaveProperty('supportTeam');
    expect(derivedTicket).not.toHaveProperty('slaPolicy');
    expect(derivedTicket).not.toHaveProperty('firstResponseDueAt');
    expect(derivedTicket).not.toHaveProperty('resolutionDueAt');
  });

  it('derives optional SLA deadlines from a queue without a contract', async () => {
    const queue = {
      handle: 'platform_ops',
      team: { handle: 'platform' },
      defaultSlaPolicy: {
        handle: 'mission_critical',
        firstResponseHours: 1,
        resolutionHours: 8,
      },
    };
    const em = {
      find: jest.fn<() => Promise<object[]>>().mockResolvedValue([]),
      findOne: jest
        .fn<(entity: unknown) => Promise<object | null>>()
        .mockImplementation(async (entity) =>
          String(entity).includes('SupportQueueItem') ? queue : null,
        ),
    };
    const controller = new TicketController(
      { handle: 'ticket' } as never,
      { handle: 99 } as never,
      em as never,
    );

    const result = await controller.beforeInsert([
      {
        creatorCompany: 30,
        contract: null,
        supportQueue: 'platform_ops',
        startDate: '2026-07-23T13:07:00.000Z',
        status: 'open',
      },
    ] as unknown as TicketItem[]);
    const derivedTicket = result.items[0] as Record<string, unknown>;

    expect(derivedTicket.contract).toBeNull();
    expect(derivedTicket).toMatchObject({
      supportQueue: 'platform_ops',
      supportTeam: 'platform',
      slaPolicy: 'mission_critical',
    });
    expect(derivedTicket.firstResponseDueAt).toEqual(
      new Date('2026-07-23T14:07:00.000Z'),
    );
    expect(derivedTicket.resolutionDueAt).toEqual(
      new Date('2026-07-23T21:07:00.000Z'),
    );
  });
});
