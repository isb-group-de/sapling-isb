import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, jest } from '@jest/globals';
import type { PersonItem } from '../../entity/PersonItem';
import type { SaplingFormConfigItem } from '../../entity/SaplingFormConfigItem';
import type { CurrentService } from '../current/current.service';
import type { TemplateService } from '../template/template.service';
import { FormConfigController } from './form-config.controller';
import type { FormConfigService } from './form-config.service';

describe('FormConfigController personal table views', () => {
  it('forces the authenticated person scope when saving a table view', async () => {
    const savedConfig = { handle: 17 } as SaplingFormConfigItem;
    const saveConfig = jest
      .fn<FormConfigService['saveConfig']>()
      .mockResolvedValue(savedConfig);
    const getEntityTemplate = jest.fn().mockReturnValue([]);
    const getEntityPermissions = jest.fn().mockReturnValue({ allowRead: true });
    const controller = new FormConfigController(
      { saveConfig } as unknown as FormConfigService,
      { getEntityTemplate } as unknown as TemplateService,
      { getEntityPermissions } as unknown as CurrentService,
    );
    const config = {
      schema: 'sapling.form-config.v1' as const,
      entityHandle: 'person',
      fields: { email: { tableVisible: true, tableOrder: 0 } },
    };

    const result = await controller.createPersonalTableView(
      {
        user: { handle: 42, roles: [] } as unknown as PersonItem,
      } as unknown as Request,
      'person',
      { name: 'My people', config },
    );

    expect(result).toBe(savedConfig);
    expect(saveConfig).toHaveBeenCalledWith(
      'person',
      {
        name: 'My people',
        scope: 'person',
        scopeHandle: '42',
        isActive: true,
        isDefault: false,
        config,
      },
      [],
    );
  });

  it('rejects personal views for entities the user cannot read', async () => {
    const controller = new FormConfigController(
      { saveConfig: jest.fn() } as unknown as FormConfigService,
      { getEntityTemplate: jest.fn() } as unknown as TemplateService,
      {
        getEntityPermissions: jest.fn().mockReturnValue({ allowRead: false }),
      } as unknown as CurrentService,
    );

    await expect(
      controller.createPersonalTableView(
        {
          user: {
            handle: 42,
            roles: { getItems: () => [] },
          } as unknown as PersonItem,
        } as unknown as Request,
        'person',
        {
          name: 'Hidden people',
          config: { schema: 'sapling.form-config.v1', entityHandle: 'person' },
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sets the default only through the authenticated person scope', async () => {
    const savedConfig = {
      handle: 17,
      isDefault: true,
    } as SaplingFormConfigItem;
    const setPersonalDefault = jest
      .fn<FormConfigService['setPersonalDefault']>()
      .mockResolvedValue(savedConfig);
    const controller = new FormConfigController(
      { setPersonalDefault } as unknown as FormConfigService,
      {} as TemplateService,
      {
        getEntityPermissions: jest.fn().mockReturnValue({ allowRead: true }),
      } as unknown as CurrentService,
    );

    await expect(
      controller.setPersonalTableViewDefault(
        {
          user: { handle: 42, roles: [] } as unknown as PersonItem,
        } as unknown as Request,
        'person',
        '17',
      ),
    ).resolves.toBe(savedConfig);
    expect(setPersonalDefault).toHaveBeenCalledWith('person', 17, '42');
  });

  it('deletes personal views through the authenticated person scope', async () => {
    const deletedConfig = { handle: 17 } as SaplingFormConfigItem;
    const deletePersonalTableView = jest
      .fn<FormConfigService['deletePersonalTableView']>()
      .mockResolvedValue(deletedConfig);
    const controller = new FormConfigController(
      { deletePersonalTableView } as unknown as FormConfigService,
      {} as TemplateService,
      {
        getEntityPermissions: jest.fn().mockReturnValue({ allowRead: true }),
      } as unknown as CurrentService,
    );

    await expect(
      controller.deletePersonalTableView(
        {
          user: { handle: 42, roles: [] } as unknown as PersonItem,
        } as unknown as Request,
        'person',
        '17',
      ),
    ).resolves.toBe(deletedConfig);
    expect(deletePersonalTableView).toHaveBeenCalledWith('person', 17, '42');
  });
});

describe('FormConfigController applicable form configurations', () => {
  it('returns applicable configurations as plain response DTOs', async () => {
    const config = {
      handle: 1,
      name: 'Person configuration',
      scope: 'global',
      scopeHandle: undefined,
      isActive: true,
      isDefault: true,
      version: 1,
      config: {
        schema: 'sapling.form-config.v1',
        entityHandle: 'person',
        groups: { 'person.groupSecurity': { visible: false } },
      },
    } as unknown as SaplingFormConfigItem;
    const listApplicableConfigs = jest.fn(
      async (entityHandle: string, person?: PersonItem | null) => {
        void entityHandle;
        void person;
        return [config];
      },
    );
    const controller = new FormConfigController(
      { listApplicableConfigs } as unknown as FormConfigService,
      {} as TemplateService,
      {
        getEntityPermissions: jest.fn().mockReturnValue({ allowRead: true }),
      } as unknown as CurrentService,
    );
    const person = { handle: 42, roles: [] } as unknown as PersonItem;

    const result = await controller.listApplicableConfigs(
      { user: person } as unknown as Request,
      'person',
    );

    expect(result).toEqual([
      {
        handle: 1,
        name: 'Person configuration',
        entity: 'person',
        scope: 'global',
        scopeHandle: null,
        isActive: true,
        isDefault: true,
        version: 1,
        config: config.config,
      },
    ]);
    expect(Object.getPrototypeOf(result[0])).toBe(Object.prototype);
    expect(listApplicableConfigs.mock.calls[0]?.[0]).toBe('person');
    expect(listApplicableConfigs.mock.calls[0]?.[1]).toBe(person);
  });
});
