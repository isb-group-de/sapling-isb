import { describe, expect, it, jest } from '@jest/globals';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericInlineCollectionService } from './generic-inline-collection.service';

function inlineField(
  overrides: Partial<EntityTemplateDto> = {},
): EntityTemplateDto {
  return {
    name: 'items',
    type: 'object',
    isPrimaryKey: false,
    isAutoIncrement: false,
    isUnique: false,
    referenceName: 'ticketLine',
    isReference: true,
    isRequired: false,
    nullable: true,
    isPersistent: true,
    referencedPks: ['handle'],
    options: [],
    kind: '1:m',
    mappedBy: 'ticket',
    inlineCollection: { renderer: 'conditionBuilder' },
    ...overrides,
  } as EntityTemplateDto;
}

function createSubject(
  existingItems: object[] = [],
  fieldPermissions = {
    getTemplates: jest.fn(() => Promise.resolve([])),
    assertPayloadAccess: jest.fn((...args: unknown[]) => {
      void args;
      return Promise.resolve();
    }),
  },
) {
  const em = {
    find: jest.fn(() => Promise.resolve(existingItems)),
    assign: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    flush: jest.fn(() => Promise.resolve()),
  };
  const templateService = {
    getEntityTemplate: jest.fn(() => [
      inlineField({ name: 'handle', inlineCollection: null }),
      inlineField({ name: 'sortOrder', inlineCollection: null }),
      inlineField({ name: 'title', inlineCollection: null }),
    ]),
  };
  const genericQueryService = {
    getEntityClass: jest.fn(() => class TicketLine {}),
  };
  const genericReferenceService = {
    normalizeHandleValue: jest.fn((_entityHandle: string, handle: unknown) =>
      Number(handle),
    ),
  };
  const genericPermissionService = {
    checkTopLevelPermission: jest.fn(),
  };
  const genericPayloadService = {
    prepareUpdatePayload: jest.fn(
      (_template: unknown, payload: object) => payload,
    ),
    prepareCreatePayload: jest.fn(
      (_template: unknown, payload: object) => payload,
    ),
  };

  return {
    service: new GenericInlineCollectionService(
      em as never,
      templateService as never,
      genericQueryService as never,
      genericReferenceService as never,
      genericPermissionService as never,
      genericPayloadService as never,
      fieldPermissions as never,
    ),
    em,
    genericPermissionService,
    fieldPermissions,
  };
}

describe('GenericInlineCollectionService', () => {
  it('extracts object rows and removes the inline field from the owner payload', () => {
    const { service } = createSubject();
    const data: Record<string, unknown> = {
      title: 'Ticket',
      items: [{ title: 'One' }, null, 'invalid', { title: 'Two' }],
    };

    const result = service.extractPayload([inlineField()], data);

    expect(result).toEqual([
      {
        field: inlineField(),
        items: [{ title: 'One' }, { title: 'Two' }],
      },
    ]);
    expect(data).toEqual({ title: 'Ticket' });
  });

  it('rejects non-array inline collection payloads', () => {
    const { service } = createSubject();

    expect(() =>
      service.extractPayload([inlineField()], { items: 'invalid' }),
    ).toThrow('global.invalidPayload');
  });

  it('updates touched rows, creates new rows, and removes omitted rows', async () => {
    const existing = { handle: 1, title: 'Old', ticket: 7 };
    const omitted = { handle: 3, title: 'Remove', ticket: 7 };
    const { service, em, genericPermissionService } = createSubject([
      existing,
      omitted,
    ]);

    await service.sync(
      'ticket',
      { handle: 7 },
      [
        {
          field: inlineField(),
          items: [{ handle: 1, title: 'Updated' }, { title: 'Created' }],
        },
      ],
      { handle: 9 } as never,
    );

    expect(em.assign).toHaveBeenCalledWith(existing, {
      ticket: 7,
      title: 'Updated',
      sortOrder: 0,
    });
    expect(em.create).toHaveBeenCalledWith(expect.any(Function), {
      ticket: 7,
      title: 'Created',
      sortOrder: 1,
    });
    expect(em.remove).toHaveBeenCalledWith(omitted);
    expect(
      genericPermissionService.checkTopLevelPermission,
    ).toHaveBeenCalledWith(
      'ticketLine',
      expect.anything(),
      { handle: 9 },
      'allowDeleteStage',
    );
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('checks submitted child fields with update and insert permissions', async () => {
    const existing = { handle: 1, title: 'Old', ticket: 7 };
    const { service, fieldPermissions } = createSubject([existing]);

    await service.sync(
      'ticket',
      { handle: 7 },
      [
        {
          field: inlineField(),
          items: [{ handle: 1, title: 'Updated' }, { title: 'Created' }],
        },
      ],
      { handle: 9 } as never,
    );

    expect(fieldPermissions.assertPayloadAccess).toHaveBeenNthCalledWith(
      1,
      { handle: 9 },
      'ticketLine',
      { title: 'Updated' },
      'update',
      { handle: 1, ticket: 7, title: 'Updated' },
      [],
    );
    expect(fieldPermissions.assertPayloadAccess).toHaveBeenNthCalledWith(
      2,
      { handle: 9 },
      'ticketLine',
      { title: 'Created' },
      'insert',
      { title: 'Created' },
      [],
    );
  });
});
