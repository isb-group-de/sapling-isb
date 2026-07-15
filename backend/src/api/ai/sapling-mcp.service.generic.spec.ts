import { describe, expect, it, jest } from '@jest/globals';
import {
  createService,
  createTemplateField,
} from './sapling-mcp.service.spec-support';

describe('SaplingMcpService generic reads and criteria', () => {
  it('searches entities by handle and field names', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const currentService = { getPerson: jest.fn() };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'person') {
          return [
            createTemplateField({ name: 'firstName' }),
            createTemplateField({ name: 'email' }),
          ];
        }

        return [createTemplateField({ name: 'title' })];
      }),
    };
    const service = createService({
      genericService,
      currentService,
      templateService,
    });

    const result = await service.executeTool(
      'entity_search',
      { query: 'email' },
      { handle: 1 } as never,
    );

    expect(result.rawResult).toMatchObject({
      query: 'email',
      matches: [expect.objectContaining({ entityHandle: 'person' })],
    });
  });

  it('returns a schema repair response for invalid generic_list filters', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'ticketStatus') {
          return [
            createTemplateField({ name: 'handle', isPrimaryKey: true }),
            createTemplateField({
              name: 'description',
              options: ['isValue', 'isOrderASC'],
            }),
            createTemplateField({ name: 'color' }),
            createTemplateField({ name: 'icon' }),
            createTemplateField({ name: 'isOpen', type: 'boolean' }),
          ];
        }

        return [];
      }),
    };
    const service = createService({ genericService, templateService });

    const result = await service.executeTool(
      'generic_list',
      {
        entityHandle: 'ticketStatus',
        filter: { title: { $ilike: '%offen%' } },
      },
      { handle: 1 } as never,
    );

    expect(genericService.findAndCount).not.toHaveBeenCalled();
    expect(result.rawResult).toMatchObject({
      entityHandle: 'ticketStatus',
      queryExecuted: false,
      status: 'needs_schema_retry',
      suggestedFields: expect.arrayContaining(['description', 'handle']),
      validFields: expect.arrayContaining(['handle', 'description']),
      invalidFields: [
        expect.objectContaining({
          entityHandle: 'ticketStatus',
          fieldPath: 'title',
          fieldName: 'title',
          mode: 'filter',
          suggestedFields: expect.arrayContaining(['description', 'handle']),
        }),
      ],
    });
    expect(result.modelResult).toMatchObject({
      entityHandle: 'ticketStatus',
      queryExecuted: false,
      status: 'needs_schema_retry',
    });
    expect(result.rawResult).not.toMatchObject({ ok: false });
  });

  it('returns a schema repair response for invalid generic_list orderBy fields', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const templateService = {
      getEntityTemplate: jest
        .fn()
        .mockReturnValue([
          createTemplateField({ name: 'handle', isPrimaryKey: true }),
          createTemplateField({ name: 'description', options: ['isValue'] }),
        ]),
    };
    const service = createService({ genericService, templateService });

    const result = await service.executeTool(
      'generic_list',
      {
        entityHandle: 'ticketStatus',
        orderBy: { title: 'ASC' },
      },
      { handle: 1 } as never,
    );

    expect(genericService.findAndCount).not.toHaveBeenCalled();
    expect(result.rawResult).toMatchObject({
      queryExecuted: false,
      status: 'needs_schema_retry',
      invalidFields: [
        expect.objectContaining({
          fieldPath: 'title',
          mode: 'orderBy',
          suggestedFields: expect.arrayContaining(['description', 'handle']),
        }),
      ],
    });
  });

  it('returns a schema repair response for invalid dotted relation fields', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'ticket') {
          return [
            createTemplateField({ name: 'title', options: ['isValue'] }),
            createTemplateField({
              name: 'status',
              isReference: true,
              referenceName: 'ticketStatus',
            }),
          ];
        }

        if (entityHandle === 'ticketStatus') {
          return [
            createTemplateField({ name: 'handle', isPrimaryKey: true }),
            createTemplateField({ name: 'description', options: ['isValue'] }),
          ];
        }

        return [];
      }),
    };
    const service = createService({ genericService, templateService });

    const result = await service.executeTool(
      'generic_list',
      {
        entityHandle: 'ticket',
        filter: { 'status.title': { $eq: 'Offen' } },
      },
      { handle: 1 } as never,
    );

    expect(genericService.findAndCount).not.toHaveBeenCalled();
    expect(result.rawResult).toMatchObject({
      queryExecuted: false,
      status: 'needs_schema_retry',
      invalidFields: [
        expect.objectContaining({
          entityHandle: 'ticketStatus',
          fieldPath: 'status.title',
          fieldName: 'title',
          suggestedFields: expect.arrayContaining(['description', 'handle']),
        }),
      ],
    });
  });

  it('keeps valid generic_list relation filters executable', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue({
        data: [],
        meta: { total: 0 },
      } as never),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'ticket') {
          return [
            createTemplateField({ name: 'title', options: ['isValue'] }),
            createTemplateField({
              name: 'status',
              isReference: true,
              referenceName: 'ticketStatus',
            }),
          ];
        }

        if (entityHandle === 'ticketStatus') {
          return [
            createTemplateField({ name: 'handle', isPrimaryKey: true }),
            createTemplateField({ name: 'description', options: ['isValue'] }),
          ];
        }

        return [];
      }),
    };
    const service = createService({ genericService, templateService });
    const user = { handle: 1 } as never;

    await service.executeTool(
      'generic_list',
      {
        entityHandle: 'ticket',
        filter: { status: { description: { ilike: '%offen%' } } },
      },
      user,
    );

    expect(genericService.findAndCount).toHaveBeenCalledWith(
      'ticket',
      { status: { description: { $ilike: '%offen%' } } },
      1,
      50,
      {},
      user,
      [],
    );
  });

  it('keeps permission failures as tool errors', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const permissionService = {
      assertEntityPermission: jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error('global.permissionDenied')),
    };
    const service = createService({ genericService, permissionService });

    const result = await service.executeTool(
      'generic_list',
      { entityHandle: 'ticketStatus', filter: { title: 'Offen' } },
      { handle: 1 } as never,
    );

    expect(genericService.findAndCount).not.toHaveBeenCalled();
    expect(result.rawResult).toMatchObject({
      ok: false,
      toolName: 'generic_list',
      error: 'global.permissionDenied',
    });
  });

  it('loads a single sanitized record with filtered relations via generic_get', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue({
        data: [
          {
            handle: 7,
            firstName: 'Ada',
          },
        ],
      } as never),
    };
    const currentService = { getPerson: jest.fn() };
    const templateService = {
      getEntityTemplate: jest.fn().mockReturnValue([
        createTemplateField({ name: 'firstName' }),
        createTemplateField({
          name: 'company',
          isReference: true,
          referenceName: 'company',
        }),
      ]),
    };
    const service = createService({
      genericService,
      currentService,
      templateService,
    });
    const user = { handle: 1 } as never;

    const result = await service.executeTool(
      'generic_get',
      {
        entityHandle: 'person',
        handle: 7,
        relations: ['company', 'unknownRelation'],
      },
      user,
    );

    expect(genericService.findAndCount).toHaveBeenCalledWith(
      'person',
      { handle: 7 },
      1,
      1,
      {},
      user,
      ['company'],
    );
    expect(result.rawResult).toMatchObject({
      entityHandle: 'person',
      handle: 7,
      found: true,
      record: { firstName: 'Ada' },
    });
  });

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
            ticket: {
              handle: 46,
              title: 'Techniker Einsatzplanung',
            },
            positions: [
              {
                handle: 61,
                title: 'Dokumenttypen definieren',
              },
            ],
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
              isPrimaryKey: true,
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

        if (entityHandle === 'ticket') {
          return [
            createTemplateField({
              name: 'handle',
              type: 'number',
              isPrimaryKey: true,
              isAutoIncrement: true,
            }),
            createTemplateField({ name: 'title', options: ['isValue'] }),
          ];
        }

        if (entityHandle === 'effortEstimatePosition') {
          return [
            createTemplateField({
              name: 'handle',
              type: 'number',
              isPrimaryKey: true,
              isAutoIncrement: true,
            }),
            createTemplateField({ name: 'title', options: ['isValue'] }),
          ];
        }

        return [];
      }),
    };
    const service = createService({ genericService, templateService });
    const user = { handle: 1 } as never;

    const result = await service.executeTool(
      'generic_get',
      {
        entityHandle: 'effortEstimate',
        handle: 21,
        relations: ['ticket', 'positions'],
      },
      user,
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
      {
        entityHandle: 'project',
        handle: 11,
        before: '2026-03',
        months: 9,
      },
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
