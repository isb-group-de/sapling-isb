import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../entity/EntityItem', () => ({ EntityItem: class {} }));
jest.mock('../entity/PersonItem', () => ({ PersonItem: class {} }));
jest.mock('../entity/TicketItem', () => ({ TicketItem: class {} }));

import { TicketController } from './TicketController';
import { ScriptResultClientMethods } from './core/script.result.client';

describe('TicketController AI actions', () => {
  beforeEach(() => {
    global.log = {
      trace: jest.fn(),
      warn: jest.fn(),
    } as unknown as typeof global.log;
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
          createdItem: { handle: 15, title: 'Cache invalidation' },
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
});
