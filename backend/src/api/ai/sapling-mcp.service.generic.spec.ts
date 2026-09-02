import { describe, expect, it, jest } from '@jest/globals';
import {
  createService,
  createTemplateField,
} from './sapling-mcp.service.spec-support';

describe('SaplingMcpService generic reads and criteria', () => {
  it('returns a schema repair instead of executing an invalid company update', async () => {
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
        if (entityHandle === 'company') {
          return [
            createTemplateField({
              name: 'handle',
              type: 'integer',
              isAutoIncrement: true,
            }),
            createTemplateField({ name: 'name' }),
            createTemplateField({ name: 'employeeCount', type: 'integer' }),
            createTemplateField({
              name: 'industry',
              kind: 'm:1',
              isReference: true,
              referenceName: 'companyIndustry',
            }),
          ];
        }

        if (entityHandle === 'companyIndustry') {
          return [
            createTemplateField({
              name: 'handle',
            }),
            createTemplateField({ name: 'title', options: ['isValue'] }),
          ];
        }

        return [];
      }),
    };
    const service = createService({ genericService, templateService });

    const result = await service.executeTool(
      'generic_update',
      {
        entityHandle: 'company',
        handle: 1939,
        data: {
          name: 'XING',
          fax: '+49 40 30390 5000',
          employees: '3000-5000',
          employeeCount: '3000-5000',
          industry: 'Internet/Dienstleistungen',
        },
      },
      { handle: 1 } as never,
    );

    expect(genericService.update).not.toHaveBeenCalled();
    expect(result.rawResult).toMatchObject({
      entityHandle: 'company',
      toolName: 'generic_update',
      mutationExecuted: false,
      pendingToolAction: false,
      status: 'needs_schema_retry',
      invalidFields: expect.arrayContaining([
        { fieldName: 'fax', reason: 'unknownOrNotWritable' },
        { fieldName: 'employees', reason: 'unknownOrNotWritable' },
      ]),
      invalidReferences: [
        expect.objectContaining({
          fieldName: 'industry',
          referenceName: 'companyIndustry',
          reason: 'referenceRecordNotFound',
        }),
      ],
      invalidValues: [
        expect.objectContaining({
          fieldName: 'employeeCount',
          reason: 'invalidNumericValue',
        }),
      ],
      validFields: expect.arrayContaining([
        'name',
        'employeeCount',
        'industry',
      ]),
    });
    expect(result.modelResult).toMatchObject({
      status: 'needs_schema_retry',
      invalidFields: expect.any(Array),
      invalidReferences: expect.any(Array),
    });
  });

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
            createTemplateField({ name: 'handle' }),
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
          createTemplateField({ name: 'handle' }),
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
            createTemplateField({ name: 'handle' }),
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
            createTemplateField({ name: 'handle' }),
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

  it('labels generic_list results as tool evidence and guides self-scoped calendar queries', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue({
        data: [{ handle: 2, firstName: 'Sebastian' }],
        meta: { total: 1 },
      } as never),
    };
    const templateService = {
      getEntityTemplate: jest
        .fn()
        .mockReturnValue([
          createTemplateField({ name: 'handle' }),
          createTemplateField({ name: 'firstName', options: ['isValue'] }),
        ]),
    };
    const service = createService({ genericService, templateService });

    const result = await service.executeTool(
      'generic_list',
      { entityHandle: 'person', filter: { firstName: 'Sebastian' } },
      { handle: 1 } as never,
    );

    expect(result.modelResult).toMatchObject({
      entityHandle: 'person',
      usageHints: expect.arrayContaining([
        expect.stringContaining('not a new dataset supplied by the user'),
        expect.stringContaining(
          'resolve the authenticated person with current_person',
        ),
        expect.stringContaining('Do not load person.assignedEvents'),
      ]),
    });
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
});
