import { describe, expect, it, jest } from '@jest/globals';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericPermissionService } from './generic-permission.service';

jest.mock('../../entity/PersonItem', () => ({
  PersonItem: class PersonItem {},
}));

jest.mock('../current/current.service', () => ({
  CurrentService: class CurrentService {},
}));

jest.mock('../template/template.service', () => ({
  TemplateService: class TemplateService {},
}));

jest.mock('../../entity/global/entity.decorator', () => ({
  hasSaplingOption: jest.fn(
    (
      _target: object,
      fieldName: string,
      type: 'isCompany' | 'isPerson' | 'isEntity',
    ) => {
      if (type === 'isPerson') {
        return fieldName === 'person';
      }

      if (type === 'isCompany') {
        return fieldName === 'company';
      }

      return false;
    },
  ),
}));

jest.mock('../../entity/global/entity.registry', () => ({
  ENTITY_MAP: {
    document: class DocumentItem {},
    event: class EventItem {},
    note: class NoteItem {},
  },
}));

const createTemplateField = (
  overrides: Partial<EntityTemplateDto>,
): EntityTemplateDto => ({
  name: '',
  type: 'string',
  referenceName: '',
  length: null,
  nullable: false,
  default: null,
  isAutoIncrement: false,
  kind: null,
  mappedBy: null,
  inversedBy: null,
  isUnique: false,
  isPersistent: true,
  isReference: false,
  isRequired: false,
  options: [],
  formGroup: null,
  formGroupOrder: null,
  formOrder: null,
  formWidth: null,
  referenceDependency: null,
  genericReference: null,
  ...overrides,
});

describe('GenericPermissionService', () => {
  it('does not apply user scope filters to anonymous public bootstrap reads', () => {
    const currentService = {
      getEntityPermissions: jest.fn(),
      getAllEntityPermissions: jest.fn(),
    };
    const templateService = { getEntityTemplate: jest.fn() };
    const service = new GenericPermissionService(
      currentService as never,
      templateService as never,
    );
    const where = { entity: { $in: ['login'] }, language: 'de' };

    expect(service.setTopLevelFilter(where, undefined, 'translation')).toBe(
      where,
    );
    expect(currentService.getEntityPermissions).not.toHaveBeenCalled();
  });

  it('rejects anonymous scope filtering for non-public entities', () => {
    const service = new GenericPermissionService({} as never, {} as never);

    expect(() => service.setTopLevelFilter({}, undefined, 'ticket')).toThrow(
      'global.permissionDenied',
    );
  });

  it('keeps private events visible for their creator and participants with global read permission', () => {
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowReadStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({
          name: 'creatorPerson',
          type: 'PersonItem',
          isReference: true,
          kind: 'm:1',
        }),
        createTemplateField({ name: 'isPrivate', type: 'boolean' }),
      ]),
    };
    const service = new GenericPermissionService(
      currentService as never,
      templateService as never,
    );

    const where = service.setTopLevelFilter(
      { handle: 99 },
      {
        handle: 7,
        company: { handle: 42 },
      } as never,
      'event',
    );

    expect(where).toEqual({
      $and: [
        { handle: 99 },
        {
          $or: [
            { isPrivate: false },
            { creatorPerson: 7 },
            { participants: { handle: 7 } },
          ],
        },
      ],
    });
  });

  it('does not add private event visibility filters to other entities', () => {
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowReadStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
      ]),
    };
    const service = new GenericPermissionService(
      currentService as never,
      templateService as never,
    );

    const where = service.setTopLevelFilter(
      { handle: 99 },
      {
        handle: 7,
        company: { handle: 42 },
      } as never,
      'note',
    );

    expect(where).toEqual({ handle: 99 });
  });

  it('limits company-scoped reads by person company when no company field exists', () => {
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowReadStage: 'company',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({
          name: 'person',
          type: 'PersonItem',
          isReference: true,
          kind: 'm:1',
        }),
      ]),
    };
    const service = new GenericPermissionService(
      currentService as never,
      templateService as never,
    );

    const where = service.setTopLevelFilter(
      {},
      {
        handle: 7,
        company: { handle: 42 },
      } as never,
      'document',
    );

    expect(where).toEqual({
      person: { company: 42 },
    });
  });

  it('keeps using company fields when an entity provides them', () => {
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowReadStage: 'company',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({
          name: 'person',
          type: 'PersonItem',
          isReference: true,
          kind: 'm:1',
        }),
        createTemplateField({
          name: 'company',
          type: 'CompanyItem',
          isReference: true,
          kind: 'm:1',
        }),
      ]),
    };
    const service = new GenericPermissionService(
      currentService as never,
      templateService as never,
    );

    const where = service.setTopLevelFilter(
      {},
      {
        handle: 7,
        company: { handle: 42 },
      } as never,
      'note',
    );

    expect(where).toEqual({
      company: 42,
    });
  });
});
