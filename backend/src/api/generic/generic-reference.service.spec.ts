import { GenericReferenceService } from './generic-reference.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { BadRequestException } from '@nestjs/common';

describe('GenericReferenceService', () => {
  const service = new GenericReferenceService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it.each(['m:1', '1:1'] as const)(
    'preserves explicit null for an owning %s reference',
    (kind) => {
      const payload = { company: null };
      const template = [
        {
          name: 'company',
          isReference: true,
          kind,
        } as EntityTemplateDto,
      ];

      expect(service.reduceReferenceFields(template, payload)).toEqual({
        company: null,
      });
    },
  );

  it('still reduces an owning reference object to its primary key', () => {
    const payload = { company: { handle: 42, name: 'Sapling' } };
    const template = [
      {
        name: 'company',
        isReference: true,
        kind: 'm:1',
      } as EntityTemplateDto,
    ];

    expect(service.reduceReferenceFields(template, payload)).toEqual({
      company: 42,
    });
  });

  it('removes inverse one-to-one references from mutation payloads', () => {
    const payload = {
      title: 'Copied event',
      azure: { handle: 17, referenceHandle: 'outlook-event-id' },
    };
    const template = [
      {
        name: 'azure',
        isReference: true,
        kind: '1:1',
        mappedBy: 'event',
      } as EntityTemplateDto,
    ];

    expect(service.reduceReferenceFields(template, payload)).toEqual({
      title: 'Copied event',
    });
  });

  it.each(['m:n', 'n:m'] as const)(
    'preserves handle arrays for a %s collection reference',
    (kind) => {
      const payload = { participants: [5, 7] };
      const template = [
        {
          name: 'participants',
          isReference: true,
          kind,
        } as EntityTemplateDto,
      ];

      expect(service.reduceReferenceFields(template, payload)).toEqual({
        participants: [5, 7],
      });
    },
  );

  it('returns localized field metadata when a ticket contact no longer belongs to its company', async () => {
    const dependencyService = new GenericReferenceService(
      {
        findOne: jest.fn().mockResolvedValue({
          handle: 1742,
          company: { handle: 149 },
        }),
      } as never,
      {
        getEntityTemplate: jest.fn(() => [
          { name: 'handle', type: 'number' } as EntityTemplateDto,
        ]),
      } as never,
      { setTopLevelFilter: (where: object) => where } as never,
      { getEntityClass: () => class Person {} } as never,
    );

    let thrown: unknown;

    try {
      await dependencyService.validateReferenceDependencies(
        'ticket',
        {
          creatorCompany: 105,
          creatorPerson: 1742,
        },
        [
          {
            name: 'creatorPerson',
            isReference: true,
            referenceName: 'person',
            referenceDependency: {
              parentField: 'creatorCompany',
              targetField: 'company',
            },
          } as EntityTemplateDto,
        ],
        { handle: 7 } as never,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getResponse()).toMatchObject({
      message: 'exception.badRequest',
      details: {
        summaryKey: 'exception.referenceDependencyMismatch',
        summaryParams: {
          entityHandle: 'ticket',
          fieldName: 'creatorPerson',
          parentFieldName: 'creatorCompany',
        },
      },
    });
  });

  it('preserves a ticket-linked event customer context after the contact company changes', async () => {
    const em = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ handle: 1742, company: { handle: 149 } })
        .mockResolvedValueOnce({ handle: 39 }),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        { name: 'handle', type: 'number' } as EntityTemplateDto,
      ]),
    };
    const genericPermissionService = {
      setTopLevelFilter: jest.fn((where: object) => where),
    };
    const entityClasses = {
      person: class Person {},
      ticket: class Ticket {},
    };
    const genericQueryService = {
      getEntityClass: jest.fn(
        (entityHandle: keyof typeof entityClasses) =>
          entityClasses[entityHandle],
      ),
    };
    const dependencyService = new GenericReferenceService(
      em as never,
      templateService as never,
      genericPermissionService as never,
      genericQueryService as never,
    );

    await expect(
      dependencyService.validateReferenceDependencies(
        'event',
        {
          creatorCompany: { handle: 105 },
          creatorPerson: { handle: 1742 },
          ticket: { handle: 39 },
        },
        [
          {
            name: 'creatorPerson',
            isReference: true,
            referenceName: 'person',
            referenceDependency: {
              parentField: 'creatorCompany',
              targetField: 'company',
            },
          } as EntityTemplateDto,
        ],
        { handle: 7 } as never,
      ),
    ).resolves.toBeUndefined();
    expect(em.findOne).toHaveBeenNthCalledWith(
      2,
      entityClasses.ticket,
      {
        handle: 39,
        creatorCompany: 105,
        creatorPerson: 1742,
      },
      {},
    );
  });

  it('still rejects an event customer mismatch not stored on its ticket', async () => {
    const em = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ handle: 1742, company: { handle: 149 } })
        .mockResolvedValueOnce(null),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        { name: 'handle', type: 'number' } as EntityTemplateDto,
      ]),
    };
    const dependencyService = new GenericReferenceService(
      em as never,
      templateService as never,
      { setTopLevelFilter: (where: object) => where } as never,
      {
        getEntityClass: (entityHandle: string) =>
          entityHandle === 'person' ? class Person {} : class Ticket {},
      } as never,
    );

    let thrown: unknown;

    try {
      await dependencyService.validateReferenceDependencies(
        'event',
        {
          creatorCompany: 105,
          creatorPerson: 1742,
          ticket: 39,
        },
        [
          {
            name: 'creatorPerson',
            isReference: true,
            referenceName: 'person',
            referenceDependency: {
              parentField: 'creatorCompany',
              targetField: 'company',
            },
          } as EntityTemplateDto,
        ],
        { handle: 7 } as never,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getResponse()).toEqual({
      message: 'exception.badRequest',
      error: 'exception.referenceDependencyMismatch',
      details: {
        summary: 'exception.referenceDependencyMismatch',
        summaryKey: 'exception.referenceDependencyMismatch',
        summaryParams: {
          entityHandle: 'event',
          fieldName: 'creatorPerson',
          parentFieldName: 'creatorCompany',
        },
        entityHandle: 'event',
      },
      technical: {
        validation: 'referenceDependency',
        entityHandle: 'event',
        fieldName: 'creatorPerson',
        parentFieldName: 'creatorCompany',
      },
    });
  });
});
