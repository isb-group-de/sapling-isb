import { describe, expect, it, jest } from '@jest/globals';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericPayloadService } from './generic-payload.service';
import { GenericReferenceService } from './generic-reference.service';

const createTemplateField = (
  overrides: Partial<EntityTemplateDto>,
): EntityTemplateDto => ({
  name: '',
  type: 'string',
  isPrimaryKey: false,
  isAutoIncrement: false,
  isUnique: false,
  referenceName: '',
  isReference: false,
  isRequired: false,
  nullable: false,
  isPersistent: true,
  referencedPks: [],
  options: [],
  formGroup: null,
  formGroupOrder: null,
  formOrder: null,
  formWidth: null,
  ...overrides,
});

describe('GenericPayloadService', () => {
  it('removes client-managed timestamps and a null handle from mutation payloads', () => {
    const referenceService = {
      reduceReferenceFields: jest.fn(),
    };
    const service = new GenericPayloadService(
      referenceService as unknown as GenericReferenceService,
    );

    expect(
      service.sanitizeClientMutationPayload({
        handle: null,
        title: 'Open',
        createdAt: '2026-07-20T09:17:59.247Z',
        updatedAt: '2026-07-23T10:01:16.189Z',
      }),
    ).toEqual({
      title: 'Open',
    });
  });

  it.each([3, 'external-key', 0])(
    'keeps an explicitly supplied non-null handle (%p)',
    (handle) => {
      const referenceService = {
        reduceReferenceFields: jest.fn(),
      };
      const service = new GenericPayloadService(
        referenceService as unknown as GenericReferenceService,
      );

      expect(
        service.sanitizeClientMutationPayload({
          handle,
          createdAt: null,
          updatedAt: null,
        }),
      ).toEqual({
        handle,
      });
    },
  );

  it('removes auto-increment and read-only fields on create payloads', () => {
    const referenceService = {
      reduceReferenceFields: jest.fn(
        (_template: EntityTemplateDto[], data: object) => data,
      ),
    };
    const service = new GenericPayloadService(
      referenceService as unknown as GenericReferenceService,
    );

    const result = service.prepareCreatePayload(
      [
        createTemplateField({
          name: 'handle',
          type: 'number',
          isAutoIncrement: true,
        }),
        createTemplateField({ name: 'title', type: 'string' }),
        createTemplateField({
          name: 'status',
          type: 'string',
          options: ['isReadOnly'],
        }),
      ],
      {
        handle: 7,
        title: 'Open',
        status: 'internal',
      },
    );

    expect(result).toEqual({
      title: 'Open',
    });
  });

  it('rejects missing non-auto-increment primary keys on create payloads', () => {
    const referenceService = {
      reduceReferenceFields: jest.fn(
        (_template: EntityTemplateDto[], data: object) => data,
      ),
    };
    const service = new GenericPayloadService(
      referenceService as unknown as GenericReferenceService,
    );

    expect(() =>
      service.prepareCreatePayload(
        [
          createTemplateField({
            name: 'handle',
            isPrimaryKey: true,
            isAutoIncrement: false,
          }),
        ],
        { handle: '   ' },
      ),
    ).toThrow('global.requiredFieldsMissing');
  });

  it('keeps non-readonly handles on update payloads while still removing readonly fields', () => {
    const referenceService = {
      reduceReferenceFields: jest.fn(
        (_template: EntityTemplateDto[], data: object) => data,
      ),
    };
    const service = new GenericPayloadService(
      referenceService as unknown as GenericReferenceService,
    );

    const result = service.prepareUpdatePayload(
      [
        createTemplateField({
          name: 'handle',
          type: 'number',
          isAutoIncrement: true,
        }),
        createTemplateField({ name: 'title', type: 'string' }),
        createTemplateField({
          name: 'status',
          type: 'string',
          options: ['isReadOnly'],
        }),
      ],
      {
        handle: 7,
        title: 'Changed',
        status: 'internal',
      },
    );

    expect(result).toEqual({
      handle: 7,
      title: 'Changed',
    });
  });

  it('normalizes empty strings to null for nullable numeric and unique scalar fields', () => {
    const referenceService = {
      reduceReferenceFields: jest.fn(
        (_template: EntityTemplateDto[], data: object) => data,
      ),
    };
    const service = new GenericPayloadService(
      referenceService as unknown as GenericReferenceService,
    );

    const result = service.prepareCreatePayload(
      [
        createTemplateField({
          name: 'expectedRevenue',
          type: 'float',
          nullable: true,
        }),
        createTemplateField({
          name: 'probability',
          type: 'number',
          nullable: true,
        }),
        createTemplateField({
          name: 'title',
          type: 'string',
          nullable: true,
        }),
        createTemplateField({
          name: 'loginName',
          type: 'string',
          nullable: true,
          isUnique: true,
        }),
      ],
      {
        expectedRevenue: '',
        probability: '   ',
        title: '',
        loginName: '   ',
      },
    );

    expect(result).toEqual({
      expectedRevenue: null,
      probability: null,
      title: '',
      loginName: null,
    });
  });

  it('normalizes a blank nullable unique scalar field on update', () => {
    const referenceService = {
      reduceReferenceFields: jest.fn(
        (_template: EntityTemplateDto[], data: object) => data,
      ),
    };
    const service = new GenericPayloadService(
      referenceService as unknown as GenericReferenceService,
    );

    const result = service.prepareUpdatePayload(
      [
        createTemplateField({
          name: 'loginName',
          type: 'string',
          nullable: true,
          isUnique: true,
        }),
        createTemplateField({
          name: 'externalId',
          type: 'string',
          nullable: true,
          isUnique: true,
        }),
        createTemplateField({
          name: 'nickname',
          type: 'string',
          nullable: true,
        }),
      ],
      {
        loginName: '',
        externalId: 'external-123',
        nickname: '',
      },
    );

    expect(result).toEqual({
      loginName: null,
      externalId: 'external-123',
      nickname: '',
    });
  });

  it('builds merged dependency payloads for reference validation', () => {
    const referenceService = {
      reduceReferenceFields: jest.fn(),
    };
    const service = new GenericPayloadService(
      referenceService as unknown as GenericReferenceService,
    );

    expect(
      service.buildDependencyValidationPayload(
        { handle: 7, company: 1, title: 'Before' },
        { title: 'After' },
      ),
    ).toEqual({
      handle: 7,
      company: 1,
      title: 'After',
    });
  });

  it('removes inverse one-to-many relations from update payloads', () => {
    const referenceService = {
      reduceReferenceFields: jest.fn(
        (template: EntityTemplateDto[], data: object) => {
          const nextData = { ...(data as Record<string, unknown>) };

          for (const field of template.filter((entry) => entry.isReference)) {
            if (field.kind === '1:m') {
              delete nextData[field.name];
              continue;
            }

            if (
              (field.kind === 'm:n' || field.kind === 'n:m') &&
              Array.isArray(nextData[field.name])
            ) {
              nextData[field.name] = (
                nextData[field.name] as Array<Record<string, unknown>>
              ).map((entry) => entry.handle);
            }
          }

          return nextData;
        },
      ),
    };
    const service = new GenericPayloadService(
      referenceService as unknown as GenericReferenceService,
    );

    const result = service.prepareUpdatePayload(
      [
        createTemplateField({ name: 'phone', type: 'string' }),
        createTemplateField({
          name: 'createdTickets',
          isReference: true,
          kind: '1:m',
          referencedPks: ['handle'],
        }),
        createTemplateField({
          name: 'roles',
          isReference: true,
          kind: 'm:n',
          referencedPks: ['handle'],
        }),
      ],
      {
        phone: '+49 1234567890',
        createdTickets: [{ handle: 1 }, { handle: 2 }],
        roles: [{ handle: 5 }, { handle: 6 }],
      },
    );

    expect(result).toEqual({
      phone: '+49 1234567890',
      roles: [5, 6],
    });
  });
});
