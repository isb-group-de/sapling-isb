import { describe, expect, it, jest } from '@jest/globals';
import {
  createService,
  createTemplateField,
} from './sapling-mcp.service.spec-support';

describe('SaplingMcpService metadata and payload security', () => {
  it('omits security fields from entity_schema responses', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const currentService = { getPerson: jest.fn() };
    const templateService = {
      getEntityTemplate: jest.fn().mockReturnValue([
        createTemplateField({ name: 'firstName' }),
        createTemplateField({
          name: 'loginPassword',
          options: ['isSecurity'],
          nullable: true,
        }),
      ]),
    };
    const service = createService({
      genericService,
      currentService,
      templateService,
    });

    const result = await service.executeTool(
      'entity_schema',
      { entityHandle: 'person' },
      { handle: 1 } as never,
    );

    expect(result.rawResult).toMatchObject({
      entityHandle: 'person',
      requiredFieldNames: [],
    });
    expect(
      (result.rawResult as { fields: Array<{ name: string }> }).fields.map(
        (field) => field.name,
      ),
    ).toEqual(['firstName']);
  });

  it('exposes non-null defaults without requiring callers to supply them', async () => {
    const templateService = {
      getEntityTemplate: jest.fn().mockReturnValue([
        createTemplateField({
          name: 'title',
          isRequired: true,
          nullable: false,
          default: null,
        }),
        createTemplateField({
          name: 'status',
          kind: 'm:1',
          isReference: true,
          referenceName: 'ticketStatus',
          isRequired: false,
          nullable: false,
          default: 'open',
        }),
      ]),
    };
    const service = createService({ templateService });

    const result = await service.executeTool(
      'entity_schema',
      { entityHandle: 'ticket' },
      { handle: 1 } as never,
    );

    expect(result.rawResult).toMatchObject({
      entityHandle: 'ticket',
      requiredFieldNames: ['title'],
      fields: [
        expect.objectContaining({
          name: 'title',
          isRequired: true,
          nullable: false,
          default: null,
        }),
        expect.objectContaining({
          name: 'status',
          isRequired: false,
          nullable: false,
          default: 'open',
        }),
      ],
    });
  });

  it('exposes reference primary keys so mutation tools do not use display labels', async () => {
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'person') {
          return [
            createTemplateField({
              name: 'workWeek',
              kind: 'm:1',
              isReference: true,
              referenceName: 'workHourWeek',
              referencedPks: ['handle'],
            }),
          ];
        }

        if (entityHandle === 'workHourWeek') {
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
    const service = createService({ templateService });

    const result = await service.executeTool(
      'entity_schema',
      { entityHandle: 'person' },
      { handle: 1 } as never,
    );

    expect(result.rawResult).toMatchObject({
      fields: [
        expect.objectContaining({
          name: 'workWeek',
          referenceName: 'workHourWeek',
          referencedPks: ['handle'],
          referencePrimaryKeys: [{ name: 'handle', type: 'number' }],
        }),
      ],
    });
  });

  it('drops security fields before generic person updates', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({ success: true } as never),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const currentService = { getPerson: jest.fn() };
    const templateService = {
      getEntityTemplate: jest.fn().mockReturnValue([
        createTemplateField({ name: 'firstName' }),
        createTemplateField({
          name: 'loginPassword',
          options: ['isSecurity'],
          nullable: true,
        }),
      ]),
    };
    const service = createService({
      genericService,
      currentService,
      templateService,
    });
    const user = { handle: 1 } as never;

    await service.executeTool(
      'generic_update',
      {
        entityHandle: 'person',
        handle: 7,
        data: {
          firstName: 'Ada',
          loginPassword: null,
        },
      },
      user,
    );

    expect(genericService.update).toHaveBeenCalledWith(
      'person',
      7,
      { firstName: 'Ada' },
      user,
      [],
    );
  });

  it('rejects display labels for numeric reference fields before updating', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'person') {
          return [
            createTemplateField({
              name: 'workWeek',
              kind: 'm:1',
              isReference: true,
              referenceName: 'workHourWeek',
              referencedPks: ['handle'],
            }),
          ];
        }

        if (entityHandle === 'workHourWeek') {
          return [
            createTemplateField({
              name: 'handle',
              type: 'number',
              isPrimaryKey: true,
            }),
          ];
        }

        return [];
      }),
    };
    const service = createService({ genericService, templateService });

    const result = await service.executeTool(
      'generic_update',
      {
        entityHandle: 'person',
        handle: 7,
        data: { workWeek: 'Wochenende' },
      },
      { handle: 1 } as never,
    );

    expect(genericService.update).not.toHaveBeenCalled();
    expect(result.rawResult).toMatchObject({
      ok: false,
      toolName: 'generic_update',
      error: expect.stringContaining(
        'Reference field "workWeek" on "person" requires the workHourWeek.handle primary-key value',
      ),
    });
  });

  it('adds current reference defaults before generic ticket creates', async () => {
    const genericService = {
      create: jest.fn().mockResolvedValue({
        entityHandle: 'ticket',
        handle: 42,
        title: 'Import failure',
      } as never),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const currentService = {
      getPerson: jest.fn().mockResolvedValue({
        handle: 9,
        company: { handle: 23 },
      } as never),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'ticket') {
          return [
            createTemplateField({ name: 'title' }),
            createTemplateField({
              name: 'assigneeCompany',
              kind: 'm:1',
              isReference: true,
              isRequired: false,
              referenceName: 'company',
              options: ['isCompany', 'isCurrentCompany'],
            }),
            createTemplateField({
              name: 'assigneePerson',
              kind: 'm:1',
              isReference: true,
              isRequired: false,
              referenceName: 'person',
              options: ['isPerson', 'isCurrentPerson'],
            }),
            createTemplateField({
              name: 'creatorCompany',
              kind: 'm:1',
              isReference: true,
              isRequired: true,
              referenceName: 'company',
              options: ['isCompany', 'isCurrentCompany'],
            }),
            createTemplateField({
              name: 'creatorPerson',
              kind: 'm:1',
              isReference: true,
              isRequired: true,
              referenceName: 'person',
              options: ['isPerson', 'isCurrentPerson'],
            }),
          ];
        }

        return [];
      }),
    };
    const service = createService({
      genericService,
      currentService,
      templateService,
    });
    const user = { handle: 9 } as never;

    await service.executeTool(
      'generic_create',
      {
        entityHandle: 'ticket',
        data: { title: 'Import failure' },
      },
      user,
    );

    expect(genericService.create).toHaveBeenCalledWith(
      'ticket',
      {
        title: 'Import failure',
        assigneeCompany: 23,
        assigneePerson: 9,
        creatorCompany: 23,
        creatorPerson: 9,
      },
      user,
    );
  });

  it('keeps explicit current reference payload values on generic creates', async () => {
    const genericService = {
      create: jest.fn().mockResolvedValue({
        entityHandle: 'ticket',
        handle: 43,
        title: 'Import failure',
      } as never),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn(),
    };
    const currentService = {
      getPerson: jest.fn().mockResolvedValue({
        handle: 9,
        company: { handle: 23 },
      } as never),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'ticket') {
          return [
            createTemplateField({ name: 'title' }),
            createTemplateField({
              name: 'assigneeCompany',
              kind: 'm:1',
              isReference: true,
              referenceName: 'company',
              options: ['isCompany', 'isCurrentCompany'],
            }),
            createTemplateField({
              name: 'assigneePerson',
              kind: 'm:1',
              isReference: true,
              referenceName: 'person',
              options: ['isPerson', 'isCurrentPerson'],
            }),
            createTemplateField({
              name: 'creatorCompany',
              kind: 'm:1',
              isReference: true,
              isRequired: true,
              referenceName: 'company',
              options: ['isCompany', 'isCurrentCompany'],
            }),
            createTemplateField({
              name: 'creatorPerson',
              kind: 'm:1',
              isReference: true,
              isRequired: true,
              referenceName: 'person',
              options: ['isPerson', 'isCurrentPerson'],
            }),
          ];
        }

        return [];
      }),
    };
    const service = createService({
      genericService,
      currentService,
      templateService,
    });
    const user = { handle: 9 } as never;

    await service.executeTool(
      'generic_create',
      {
        entityHandle: 'ticket',
        data: {
          title: 'Import failure',
          assigneeCompany: 31,
          assigneePerson: 32,
          creatorCompany: 41,
          creatorPerson: 42,
        },
      },
      user,
    );

    expect(currentService.getPerson).not.toHaveBeenCalled();
    expect(genericService.create).toHaveBeenCalledWith(
      'ticket',
      {
        title: 'Import failure',
        assigneeCompany: 31,
        assigneePerson: 32,
        creatorCompany: 41,
        creatorPerson: 42,
      },
      user,
    );
  });
});
