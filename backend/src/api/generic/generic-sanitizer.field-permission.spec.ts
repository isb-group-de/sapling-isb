import type { PersonItem } from '../../entity/PersonItem';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { TemplateService } from '../template/template.service';
import type { FieldPermissionService } from '../current/field-permission.service';
import { GenericSanitizerService } from './generic-sanitizer.service';

describe('GenericSanitizerService field permissions', () => {
  it('omits denied normal and nested relation fields instead of masking them', () => {
    const templates: Record<string, EntityTemplateDto[]> = {
      ticket: [
        { name: 'handle', options: [] },
        { name: 'title', options: [] },
        { name: 'secret', options: [] },
        {
          name: 'creatorCompany',
          options: [],
          isReference: true,
          referenceName: 'company',
        },
      ] as unknown as EntityTemplateDto[],
      company: [
        { name: 'handle', options: [] },
        { name: 'name', options: [] },
        { name: 'internalScore', options: [] },
      ] as unknown as EntityTemplateDto[],
    };
    const sanitizer = new GenericSanitizerService(
      {
        getEntityTemplate: (entityHandle: string) =>
          templates[entityHandle] ?? [],
      } as unknown as TemplateService,
      {
        canAccessField: (
          _user: PersonItem,
          _entityHandle: string,
          field: EntityTemplateDto,
        ) => !['secret', 'internalScore'].includes(field.name),
      } as unknown as FieldPermissionService,
    );

    expect(
      sanitizer.projectEntityResult(
        'ticket',
        {
          handle: 1,
          title: 'Visible',
          secret: 'hidden',
          creatorCompany: {
            handle: 2,
            name: 'Visible company',
            internalScore: 99,
          },
        },
        {} as PersonItem,
        templates.ticket,
      ),
    ).toEqual({
      handle: 1,
      title: 'Visible',
      creatorCompany: { handle: 2, name: 'Visible company' },
    });
  });

  it('filters hydrated custom fields in both nested and flat representations', () => {
    const sanitizer = new GenericSanitizerService(
      {
        getEntityTemplate: () =>
          [{ name: 'handle', options: [] }] as unknown as EntityTemplateDto[],
      } as unknown as TemplateService,
      {
        canAccessField: (
          _user: PersonItem,
          _entityHandle: string,
          field: EntityTemplateDto,
        ) => field.name !== 'customFields.secretScore',
      } as unknown as FieldPermissionService,
    );

    expect(
      sanitizer.projectEntityResult(
        'company',
        {
          handle: 2,
          customFields: { publicScore: 10, secretScore: 99 },
          'customFields.publicScore': 10,
          'customFields.secretScore': 99,
        },
        {} as PersonItem,
      ),
    ).toEqual({
      handle: 2,
      customFields: { publicScore: 10 },
      'customFields.publicScore': 10,
    });
  });

  it('does not expose handle fallbacks when the identifier is unreadable', () => {
    const templates = {
      ticket: [
        { name: 'handle', options: [], isPrimaryKey: true },
        {
          name: 'company',
          options: [],
          isReference: true,
          referenceName: 'company',
        },
      ],
      company: [
        { name: 'handle', options: [], isPrimaryKey: true },
        {
          name: 'ticket',
          options: [],
          isReference: true,
          referenceName: 'ticket',
        },
      ],
    } as unknown as Record<string, EntityTemplateDto[]>;
    const sanitizer = new GenericSanitizerService(
      {
        getEntityTemplate: (entityHandle: string) =>
          templates[entityHandle] ?? [],
      } as unknown as TemplateService,
      {
        canAccessField: (
          _user: PersonItem,
          entityHandle: string,
          field: EntityTemplateDto,
        ) => !(entityHandle === 'ticket' && field.name === 'handle'),
      } as unknown as FieldPermissionService,
    );
    const ticket: Record<string, unknown> = { handle: 1 };
    const company = { handle: 2, ticket };
    ticket.company = company;

    expect(
      sanitizer.projectEntityResult(
        'ticket',
        ticket,
        {} as PersonItem,
        templates.ticket,
      ),
    ).toEqual({
      company: { handle: 2, ticket: null },
    });
  });
});
