import { describe, expect, it, jest } from '@jest/globals';
import {
  createService,
  createTemplateField,
} from './sapling-mcp.service.spec-support';

describe('SaplingMcpService generic output', () => {
  it('uses isValue fields in model-facing generic_get output and keeps handles for follow-up tools', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue({
        data: [
          {
            handle: 21,
            title: 'Dokumentenablage fuer Angebote',
            ticket: { handle: 46, title: 'Techniker Einsatzplanung' },
            positions: [{ handle: 61, title: 'Dokumenttypen definieren' }],
          },
        ],
      } as never),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'effortEstimate') {
          return [
            createTemplateField({
              name: 'handle',
              type: 'number',
              isAutoIncrement: true,
            }),
            createTemplateField({ name: 'title', options: ['isValue'] }),
            createTemplateField({
              name: 'ticket',
              isReference: true,
              referenceName: 'ticket',
            }),
            createTemplateField({
              name: 'positions',
              isReference: true,
              referenceName: 'effortEstimatePosition',
            }),
          ];
        }
        if (
          entityHandle === 'ticket' ||
          entityHandle === 'effortEstimatePosition'
        ) {
          return [
            createTemplateField({
              name: 'handle',
              type: 'number',
              isAutoIncrement: true,
            }),
            createTemplateField({ name: 'title', options: ['isValue'] }),
          ];
        }
        return [];
      }),
    };
    const service = createService({ genericService, templateService });
    const result = await service.executeTool(
      'generic_get',
      {
        entityHandle: 'effortEstimate',
        handle: 21,
        relations: ['ticket', 'positions'],
      },
      { handle: 1 } as never,
    );

    expect(result.rawResult).toMatchObject({
      handle: 21,
      record: {
        handle: 21,
        ticket: { handle: 46 },
        positions: [{ handle: 61 }],
      },
    });
    expect(result.modelResult).toMatchObject({
      entityHandle: 'effortEstimate',
      handle: 21,
      displayValue: 'Dokumentenablage fuer Angebote',
      record: {
        handle: 21,
        displayValue: 'Dokumentenablage fuer Angebote',
        title: 'Dokumentenablage fuer Angebote',
        ticket: {
          handle: 46,
          displayValue: 'Techniker Einsatzplanung',
          title: 'Techniker Einsatzplanung',
        },
        positions: [
          {
            handle: 61,
            displayValue: 'Dokumenttypen definieren',
            title: 'Dokumenttypen definieren',
          },
        ],
      },
    });
    expect(JSON.stringify(result.modelResult)).toContain('"handle"');
    expect(result.content).toContain('"displayValue"');
    expect(result.content).toContain('"handle"');
  });

  it('loads a record timeline via generic_timeline', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn().mockResolvedValue({
        entityHandle: 'project',
        handle: 11,
        hasMore: false,
      } as never),
      findAndCount: jest.fn(),
    };
    const currentService = { getPerson: jest.fn() };
    const templateService = {
      getEntityTemplate: jest.fn().mockReturnValue([]),
    };
    const service = createService({
      genericService,
      currentService,
      templateService,
    });
    const user = { handle: 1 } as never;

    await service.executeTool(
      'generic_timeline',
      { entityHandle: 'project', handle: 11, before: '2026-03', months: 9 },
      user,
    );
    expect(genericService.getRecordTimeline).toHaveBeenCalledWith(
      'project',
      11,
      user,
      '2026-03',
      9,
    );
  });
});
