import { describe, expect, it, jest } from '@jest/globals';

import { FormConfigService } from './form-config.service';
import { SAPLING_FORM_CONFIG_SCHEMA } from './form-config.types';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';

function createTemplate(
  overrides: Partial<EntityTemplateDto>,
): EntityTemplateDto {
  return {
    name: 'title',
    type: 'string',
    isPrimaryKey: false,
    isAutoIncrement: false,
    isUnique: false,
    referenceName: '',
    isReference: false,
    isRequired: false,
    nullable: true,
    isPersistent: true,
    referencedPks: [],
    options: [],
    formGroup: null,
    formGroupOrder: null,
    formOrder: null,
    formWidth: null,
    ...overrides,
  };
}

describe('FormConfigService', () => {
  it('normalizes table and mobile field configuration', () => {
    const service = new FormConfigService({} as never);

    const result = service.validateConfig(
      'ticket',
      {
        schema: SAPLING_FORM_CONFIG_SCHEMA,
        entityHandle: 'ticket',
        fields: {
          title: {
            visible: false,
            tableVisible: false,
            tableOrder: 20.8,
            mobileVisible: true,
            mobileOrder: 5.2,
          },
        },
      },
      [createTemplate({ name: 'title' })],
    );

    expect(result.isValid).toBe(true);
    expect(result.normalizedConfig.fields?.title).toMatchObject({
      visible: false,
      tableVisible: false,
      tableOrder: 20,
      mobileVisible: true,
      mobileOrder: 5,
    });
  });

  it('normalizes central group configuration', () => {
    const service = new FormConfigService({} as never);
    const result = service.validateConfig(
      'ticket',
      {
        schema: SAPLING_FORM_CONFIG_SCHEMA,
        entityHandle: 'ticket',
        groups: {
          basics: { visible: false, order: 20.8, label: '  Basics  ' },
        },
      },
      [createTemplate({ name: 'title', formGroup: 'basics' })],
    );

    expect(result.normalizedConfig.groups.basics).toEqual({
      visible: false,
      order: 20,
      label: 'Basics',
    });
  });

  it('applies table and mobile configuration to effective templates', async () => {
    const em = {
      find: jest.fn<() => Promise<object[]>>().mockResolvedValue([
        {
          handle: 1,
          scope: 'global',
          isActive: true,
          isDefault: true,
          config: {
            schema: SAPLING_FORM_CONFIG_SCHEMA,
            entityHandle: 'ticket',
            fields: {
              title: {
                visible: false,
                tableVisible: false,
                tableOrder: 30,
                mobileVisible: true,
                mobileOrder: 10,
              },
            },
          },
        },
      ]),
    };
    const service = new FormConfigService(em as never);

    const [template] = await service.getEffectiveTemplate(
      'ticket',
      [createTemplate({ name: 'title' })],
      null,
    );

    expect(template).toMatchObject({
      formVisible: false,
      tableVisible: false,
      tableOrder: 30,
      mobileVisible: true,
      mobileOrder: 10,
      formConfig: expect.objectContaining({
        visible: false,
        tableVisible: false,
        mobileVisible: true,
      }),
    });
  });

  it('keeps boolean fields optional when form config marks them required', async () => {
    const em = {
      find: jest.fn<() => Promise<object[]>>().mockResolvedValue([
        {
          handle: 1,
          scope: 'global',
          isActive: true,
          isDefault: true,
          config: {
            schema: SAPLING_FORM_CONFIG_SCHEMA,
            entityHandle: 'ticket',
            fields: {
              isActive: {
                required: true,
              },
            },
          },
        },
      ]),
    };
    const service = new FormConfigService(em as never);

    const [template] = await service.getEffectiveTemplate(
      'ticket',
      [
        createTemplate({
          name: 'isActive',
          type: 'boolean',
          isRequired: true,
          nullable: false,
        }),
      ],
      null,
    );

    expect(template).toMatchObject({
      isRequired: false,
      nullable: false,
      formConfig: expect.objectContaining({
        required: false,
      }),
    });
  });

  it('applies group order, label, and visibility to effective templates', async () => {
    const em = {
      find: jest.fn<() => Promise<object[]>>().mockResolvedValue([
        {
          handle: 1,
          scope: 'global',
          isActive: true,
          isDefault: true,
          config: {
            schema: SAPLING_FORM_CONFIG_SCHEMA,
            entityHandle: 'ticket',
            groups: {
              basics: { visible: false, order: 10, label: 'Main data' },
            },
          },
        },
      ]),
    };
    const service = new FormConfigService(em as never);

    const [template] = await service.getEffectiveTemplate(
      'ticket',
      [
        createTemplate({
          name: 'title',
          formGroup: 'basics',
          formVisible: true,
        }),
      ],
      null,
    );

    expect(template).toMatchObject({
      formVisible: false,
      formGroupOrder: 10,
      formGroupConfig: {
        visible: false,
        order: 10,
        label: 'Main data',
      },
    });
  });

  it('replaces the previous personal default for the same entity and person', async () => {
    const previous = {
      handle: 1,
      scope: 'person',
      scopeHandle: '42',
      isActive: true,
      isDefault: true,
    };
    const target = {
      handle: 2,
      scope: 'person',
      scopeHandle: '42',
      isActive: true,
      isDefault: false,
    };
    const em = {
      findOne: jest.fn<() => Promise<unknown>>().mockResolvedValue(target),
      find: jest
        .fn<() => Promise<unknown[]>>()
        .mockResolvedValue([previous, target]),
      persist: jest.fn(),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    const service = new FormConfigService(em as never);

    await expect(service.setPersonalDefault('person', 2, '42')).resolves.toBe(
      target,
    );
    expect(previous.isDefault).toBe(false);
    expect(target.isDefault).toBe(true);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('rejects making another person or a global view the personal default', async () => {
    const em = {
      findOne: jest.fn<() => Promise<unknown>>().mockResolvedValue({
        handle: 2,
        scope: 'person',
        scopeHandle: '7',
      }),
    };
    const service = new FormConfigService(em as never);

    await expect(service.setPersonalDefault('person', 2, '42')).rejects.toThrow(
      'exception.forbidden',
    );
  });
});
