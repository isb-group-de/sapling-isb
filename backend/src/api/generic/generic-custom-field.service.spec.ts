import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';

import { GenericCustomFieldService } from './generic-custom-field.service';
import type { CustomFieldDefinitionItem } from '../../entity/CustomFieldDefinitionItem';
import { CustomFieldValueItem } from '../../entity/CustomFieldValueItem';
import type { CustomFieldType } from '../../entity/CustomFieldTypeItem';

const createDefinition = (
  fieldKey: string,
  fieldType: CustomFieldType,
  overrides: Partial<CustomFieldDefinitionItem> = {},
): CustomFieldDefinitionItem =>
  ({
    handle: overrides.handle ?? fieldKey,
    fieldKey,
    fieldType,
    label: fieldKey,
    tooltip: null,
    isRequired: false,
    isReadOnly: false,
    isActive: true,
    fieldOrder: 0,
    selectOptions: null,
    ...overrides,
  }) as unknown as CustomFieldDefinitionItem;

const createService = (definitions: CustomFieldDefinitionItem[] = []) => {
  const em = {
    find: jest
      .fn<() => Promise<CustomFieldDefinitionItem[]>>()
      .mockResolvedValue(definitions),
    count: jest
      .fn<() => Promise<number>>()
      .mockResolvedValue(definitions.length),
    flush: jest.fn<() => Promise<void>>().mockResolvedValue(),
  };

  return new GenericCustomFieldService(em as never);
};

describe('GenericCustomFieldService', () => {
  it('caches derived custom-field templates across service instances', async () => {
    const definition = createDefinition('region', 'text');
    const firstService = createService([definition]);
    const secondService = createService([definition]);
    firstService.invalidateTemplateCache('cacheEntity');

    await Promise.all([
      firstService.appendCustomFieldTemplates('cacheEntity', []),
      secondService.appendCustomFieldTemplates('cacheEntity', []),
    ]);

    const firstEntityManager = (
      firstService as unknown as { em: { find: jest.Mock } }
    ).em;
    const secondEntityManager = (
      secondService as unknown as { em: { find: jest.Mock } }
    ).em;
    expect(firstEntityManager.find).toHaveBeenCalledTimes(1);
    expect(secondEntityManager.find).not.toHaveBeenCalled();

    secondService.invalidateTemplateCache('cacheEntity');
    await secondService.appendCustomFieldTemplates('cacheEntity', []);
    expect(secondEntityManager.find).toHaveBeenCalledTimes(1);
  });

  it('splits nested and flat custom fields out of mutation payloads', () => {
    const service = createService();

    const result = service.splitPayload({
      title: 'Company',
      customFields: { region: 'emea' },
      'customFields.priority': 'high',
    });

    expect(result.data).toEqual({ title: 'Company' });
    expect(result.customFields).toEqual({
      region: 'emea',
      priority: 'high',
    });
  });

  it('collects flat import fields into customFields and removes flat keys', () => {
    const service = createService();
    const payload: Record<string, unknown> = {
      title: 'Company',
      'customFields.priority': 'high',
    };

    const customFields = service.collectCustomFieldsFromFlatPayload(payload);

    expect(customFields).toEqual({ priority: 'high' });
    expect(payload).toEqual({
      title: 'Company',
      customFields: { priority: 'high' },
    });
  });

  it('validates required custom fields after type normalization', async () => {
    const service = createService([
      createDefinition('status', 'select', {
        isRequired: true,
        selectOptions: [{ label: 'Active', value: 'active' }],
      }),
      createDefinition('score', 'number', {
        isRequired: true,
      }),
    ]);

    await expect(
      service.assertRequiredFields('company', {
        status: 'unknown',
        score: '42',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.assertRequiredFields('company', {
        status: 'active',
        score: 'not-a-number',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.assertRequiredFields('company', {
        status: 'active',
        score: '42',
      }),
    ).resolves.toBeUndefined();
  });

  it('returns all missing required custom field names', async () => {
    const service = createService([
      createDefinition('segment', 'text', { isRequired: true }),
      createDefinition('rating', 'number', { isRequired: true }),
      createDefinition('comment', 'longText', { isRequired: false }),
    ]);

    await expect(
      service.getMissingRequiredFieldNames('company', {
        segment: '',
        rating: 'not-a-number',
        comment: '',
      }),
    ).resolves.toEqual(['customFields.segment', 'customFields.rating']);
  });

  it('keeps boolean custom fields optional with a false default', async () => {
    const service = createService([
      createDefinition('approved', 'boolean', { isRequired: true }),
    ]);

    await expect(
      service.getMissingRequiredFieldNames('readonlyTemplateEntity', {}),
    ).resolves.toEqual([]);

    const templates = await service.appendCustomFieldTemplates(
      'readonlyTemplateEntity',
      [],
    );

    expect(templates[0]).toMatchObject({
      name: 'customFields.approved',
      type: 'boolean',
      default: false,
      isRequired: false,
      nullable: true,
      formConfig: expect.objectContaining({
        required: false,
        renderer: 'boolean',
      }),
    });
  });

  it('projects read-only custom fields as non-required read-only templates', async () => {
    const service = createService([
      createDefinition('externalScore', 'number', {
        isRequired: true,
        isReadOnly: true,
      }),
    ]);

    await expect(
      service.getMissingRequiredFieldNames('company', {}),
    ).resolves.toEqual([]);

    const templates = await service.appendCustomFieldTemplates('company', []);

    expect(templates[0]).toMatchObject({
      name: 'customFields.externalScore',
      isRequired: false,
      nullable: true,
      options: ['isReadOnly'],
      formConfig: expect.objectContaining({ required: false }),
    });
  });

  it('projects configured tooltips into generated field help metadata', async () => {
    const service = createService([
      createDefinition('customerTier', 'select', {
        tooltip: 'Controls service priority for this customer.',
      }),
    ]);
    service.invalidateTemplateCache('tooltipEntity');

    const templates = await service.appendCustomFieldTemplates(
      'tooltipEntity',
      [],
    );

    expect(templates[0]).toMatchObject({
      name: 'customFields.customerTier',
      formConfig: {
        helpText: 'Controls service priority for this customer.',
      },
      customField: {
        tooltip: 'Controls service priority for this customer.',
      },
    });
  });

  it('ignores mutation values for read-only custom fields', async () => {
    const service = createService([
      createDefinition('externalScore', 'number', { isReadOnly: true }),
    ]);

    await expect(
      service.upsertCustomFieldValues('readonlyMutationEntity', 42, {
        externalScore: 99,
      }),
    ).resolves.toBeUndefined();
  });

  it('skips value hydration for entities without active custom fields', async () => {
    const service = createService();
    service.invalidateTemplateCache('emptyEntity');
    const entityManager = (
      service as unknown as { em: { count: jest.Mock; find: jest.Mock } }
    ).em;
    const records = [{ handle: 'customer-1', title: 'Customer' }];

    await service.hydrateRecords('emptyEntity', records);
    await service.hydrateRecords('emptyEntity', [
      { handle: 'customer-2', title: 'Other customer' },
    ]);

    expect(entityManager.count).toHaveBeenCalledTimes(1);
    expect(entityManager.find).not.toHaveBeenCalledWith(
      CustomFieldValueItem,
      expect.anything(),
      expect.anything(),
    );
    expect(records[0]).toEqual({
      handle: 'customer-1',
      title: 'Customer',
      customFields: {},
    });
  });

  it('hydrates values when active custom fields exist', async () => {
    const definition = createDefinition('region', 'text', { handle: 42 });
    const values = [
      {
        recordReference: 'customer-1',
        definition,
        valueString: 'EMEA',
      },
    ];
    const em = {
      count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
      find: jest
        .fn<
          (
            entity: unknown,
            criteria?: unknown,
            options?: unknown,
          ) => Promise<typeof values>
        >()
        .mockResolvedValue(values),
    };
    const service = new GenericCustomFieldService(em as never);
    service.invalidateTemplateCache('fieldEntity');
    const records = [{ handle: 'customer-1' }, { handle: 'customer-2' }];

    await service.hydrateRecords('fieldEntity', records);

    expect(em.find).toHaveBeenCalledWith(
      CustomFieldValueItem,
      {
        entity: { handle: 'fieldEntity' },
        recordReference: { $in: ['customer-1', 'customer-2'] },
      },
      { populate: ['definition'] },
    );
    expect(records).toEqual([
      {
        handle: 'customer-1',
        customFields: { region: 'EMEA' },
        'customFields.region': 'EMEA',
      },
      { handle: 'customer-2', customFields: {} },
    ]);
  });
});
