import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericQueryService } from './generic-query.service';

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

describe('GenericQueryService', () => {
  it('builds safe list projections with primary keys and populated relations', () => {
    const service = new GenericQueryService({
      getEntityTemplate: () => [],
    } as never);
    const template = [
      createTemplateField({
        name: 'handle',
        type: 'number',
        isPrimaryKey: true,
      }),
      createTemplateField({ name: 'title' }),
      createTemplateField({ name: 'description' }),
      createTemplateField({
        name: 'status',
        isReference: true,
        kind: 'm:1',
        referenceName: 'ticketStatus',
      }),
      createTemplateField({
        name: 'participants',
        isReference: true,
        kind: 'm:n',
        referenceName: 'person',
      }),
      createTemplateField({
        name: 'computedEmail',
        isPersistent: false,
      }),
    ];

    expect(service.buildFields(['title'], template, ['status'])).toEqual([
      'handle',
      'title',
      'status',
    ]);
    expect(
      service.buildFields(['title', 'participants'], template, [
        'participants',
      ]),
    ).toEqual(['handle', 'title', 'participants']);
    expect(() => service.buildFields(['participants'], template)).toThrow(
      BadRequestException,
    );
    expect(service.buildFields([], template)).toBeUndefined();
    expect(() => service.buildFields(['computedEmail'], template)).toThrow(
      BadRequestException,
    );
  });

  it('selects value fields for populated nested reference labels', () => {
    const templatesByEntity: Record<string, EntityTemplateDto[]> = {
      person: [
        createTemplateField({
          name: 'firstName',
          options: ['isValue'],
        }),
        createTemplateField({
          name: 'lastName',
          options: ['isValue'],
        }),
        createTemplateField({
          name: 'company',
          isReference: true,
          kind: 'm:1',
          referenceName: 'company',
          options: ['isValue'],
        }),
      ],
      company: [
        createTemplateField({
          name: 'name',
          options: ['isValue'],
        }),
      ],
    };
    const service = new GenericQueryService({
      getEntityTemplate: (entityHandle: string) =>
        templatesByEntity[entityHandle] ?? [],
    } as never);
    const template = [
      createTemplateField({
        name: 'handle',
        type: 'number',
        isPrimaryKey: true,
      }),
      createTemplateField({
        name: 'assigneePerson',
        isReference: true,
        kind: 'm:1',
        referenceName: 'person',
      }),
    ];

    expect(
      service.buildFields(['assigneePerson'], template, [
        'assigneePerson',
        'assigneePerson.company',
      ]),
    ).toEqual([
      'handle',
      'assigneePerson',
      'assigneePerson.firstName',
      'assigneePerson.lastName',
      'assigneePerson.company',
      'assigneePerson.company.name',
    ]);
  });

  it('selects explicitly requested appearance fields from populated references', () => {
    const templatesByEntity: Record<string, EntityTemplateDto[]> = {
      eventType: [
        createTemplateField({ name: 'title', options: ['isValue'] }),
        createTemplateField({ name: 'icon', options: ['isIcon'] }),
        createTemplateField({ name: 'color', options: ['isColor'] }),
        createTemplateField({ name: 'secret', options: ['isSecurity'] }),
      ],
      eventStatus: [
        createTemplateField({
          name: 'description',
          options: ['isValue'],
        }),
        createTemplateField({ name: 'color', options: ['isColor'] }),
      ],
    };
    const service = new GenericQueryService({
      getEntityTemplate: (entityHandle: string) =>
        templatesByEntity[entityHandle] ?? [],
    } as never);
    const template = [
      createTemplateField({
        name: 'handle',
        type: 'number',
        isPrimaryKey: true,
      }),
      createTemplateField({ name: 'title' }),
      createTemplateField({
        name: 'type',
        isReference: true,
        kind: 'm:1',
        referenceName: 'eventType',
      }),
      createTemplateField({
        name: 'status',
        isReference: true,
        kind: 'm:1',
        referenceName: 'eventStatus',
      }),
    ];

    expect(
      service.buildFields(
        ['title', 'type.icon', 'type.color', 'status.color'],
        template,
        ['type', 'status'],
      ),
    ).toEqual([
      'handle',
      'title',
      'type.icon',
      'type.color',
      'status.color',
      'type',
      'status',
      'type.title',
      'status.description',
    ]);
    expect(() => service.buildFields(['type.color'], template)).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.buildFields(['type.secret'], template, ['type']),
    ).toThrow(BadRequestException);
  });

  it('reuses cached template field maps across repeated query normalization work', () => {
    const templatesByEntity: Record<string, EntityTemplateDto[]> = {
      ticket: [
        createTemplateField({ name: 'title', type: 'string' }),
        createTemplateField({
          name: 'company',
          type: 'string',
          isReference: true,
          referenceName: 'company',
        }),
      ],
      company: [createTemplateField({ name: 'name', type: 'string' })],
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        return templatesByEntity[entityHandle] ?? [];
      }),
    };
    const service = new GenericQueryService(templateService as never);

    const criteria = {
      title: 'Ada',
      company: {
        name: 'Acme',
      },
    };

    expect(
      service.normalizeQueryCriteria('ticket', criteria, 'filter'),
    ).toEqual(criteria);
    expect(service.collectQueryPopulateRelations('ticket', criteria)).toEqual([
      'company',
    ]);

    expect(templateService.getEntityTemplate).toHaveBeenCalledTimes(2);
    expect(templateService.getEntityTemplate).toHaveBeenNthCalledWith(
      1,
      'ticket',
    );
    expect(templateService.getEntityTemplate).toHaveBeenNthCalledWith(
      2,
      'company',
    );
  });
});
