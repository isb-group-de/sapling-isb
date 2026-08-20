import { expect, it, jest } from '@jest/globals';
import {
  hasSaplingOption,
  ScriptResultServer,
  createTemplateField,
  waitForBackgroundTasks,
  toScriptItems,
  createGenericService,
} from './generic.service.spec-support';

describe('GenericService change-log workflows', () => {
  it('logs the generated record handle for create payloads without a handle', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const createdRecord = {
      handle: 42,
      title: 'Neuer Datensatz',
    };
    const logCreateCalls: Array<Record<string, unknown>> = [];
    const logEm = {
      findOne: jest.fn(() => Promise.resolve({ handle: 'create' })),
      create: jest.fn((_cls: unknown, data: Record<string, unknown>) => {
        if ('action' in data) {
          logCreateCalls.push(data);
          return {
            ...data,
            details: { add: jest.fn() },
          };
        }

        return data;
      }),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    const em = {
      findOne: jest.fn(() => Promise.resolve({ handle: 'ticket' })),
      create: jest.fn(() => createdRecord),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      fork: jest.fn(() => logEm),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({
          name: 'handle',
          type: 'number',
          isPrimaryKey: true,
          isAutoIncrement: true,
        }),
        createTemplateField({ name: 'title', type: 'string' }),
      ]),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowInsertStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const scriptService = {
      runServer: jest.fn((_method: unknown, items: object | object[]) =>
        Promise.resolve(new ScriptResultServer(toScriptItems(items))),
      ),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
      scriptService,
    });

    await service.create(
      'ticket',
      { title: 'Neuer Datensatz' },
      { handle: 1 } as never,
    );
    await waitForBackgroundTasks();

    expect(logCreateCalls).toHaveLength(1);
    expect(logCreateCalls[0]).toMatchObject({
      action: 'create',
      reference: '42',
      oldPayload: null,
      newPayload: {
        handle: 42,
        title: 'Neuer Datensatz',
      },
    });
  });

  it('logs the submitted update payload without reusing the persisted entity state', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(
      (...args: unknown[]) =>
        args[1] === 'loginPassword' && args[2] === 'isSecurity',
    );

    const item = {
      handle: 7,
      phone: '+49 1111111111',
      loginPassword: 'hashed-secret',
      roles: {
        isInitialized: () => true,
        toArray: () => [{ handle: 5, name: 'Admin' }],
      },
    };
    const persistedItem = {
      ...item,
      phone: '+49 1234567890',
    };
    const changeLogDetailsAdd = jest.fn();
    const logCreateCalls: Array<Record<string, unknown>> = [];
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'person' })
      .mockResolvedValueOnce(item);
    const assign = jest.fn((_item: object, data: object) => ({
      ...persistedItem,
      ...data,
    }));
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const logEm = {
      findOne: jest.fn(() => Promise.resolve({ handle: 'update' })),
      create: jest.fn((cls: unknown, data: Record<string, unknown>) => {
        if ('action' in data) {
          logCreateCalls.push(data);
          return {
            ...data,
            details: {
              add: changeLogDetailsAdd,
            },
          };
        }

        return data;
      }),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getReference: jest.fn((_cls: unknown, handle: string | number) => ({
        handle,
      })),
    };
    const em = {
      findOne,
      assign,
      flush,
      create: logEm.create,
      fork: jest.fn(() => logEm),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'person':
            return [
              createTemplateField({
                name: 'handle',
                type: 'number',
                isPrimaryKey: true,
                isAutoIncrement: true,
              }),
              createTemplateField({ name: 'phone', type: 'string' }),
              createTemplateField({
                name: 'loginPassword',
                options: ['isSecurity'],
              }),
              createTemplateField({
                name: 'roles',
                isReference: true,
                kind: 'm:n',
                referenceName: 'role',
                referencedPks: ['handle'],
              }),
            ];
          case 'role':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'name', type: 'string' }),
            ];
          default:
            return [];
        }
      }),
    };
    const scriptService = {
      runServer: jest.fn((_method: unknown, items: object | object[]) =>
        Promise.resolve(new ScriptResultServer(toScriptItems(items))),
      ),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowUpdateStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
      scriptService,
    });

    await service.update(
      'person',
      7,
      {
        handle: 7,
        phone: '+49 1234567890',
      },
      { handle: 1 } as never,
      [],
    );

    await waitForBackgroundTasks();

    expect(logCreateCalls).toHaveLength(1);
    expect(logCreateCalls[0]).toMatchObject({
      action: 'update',
      reference: '7',
      oldPayload: {
        handle: 7,
        phone: '+49 1111111111',
      },
      newPayload: {
        handle: 7,
        phone: '+49 1234567890',
      },
    });
    expect(logCreateCalls[0]?.oldPayload).not.toHaveProperty('loginPassword');
    expect(logCreateCalls[0]?.newPayload).not.toHaveProperty('roles');
  });

  it('projects old update payload references to the same flat shape as the submitted payload', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(
      (...args: unknown[]) =>
        args[1] === 'loginPassword' && args[2] === 'isSecurity',
    );

    const item = {
      handle: 1,
      phone: '+49 1234 567890',
      mobile: '+49 1234 567891',
      email: 'info@standardfirma.de',
      firstName: 'Max',
      lastName: 'Mustermann',
      loginName: 'max-mustermann',
      loginPassword: 'hashed-secret',
      type: { handle: 'sapling', color: '#4CAF50', icon: null },
      company: { handle: 1, name: null },
      language: { handle: 'de', name: null },
      workWeek: { handle: 1, title: null },
      holidayGroup: { handle: 2, title: null },
      roles: [],
      notes: [],
      mailLists: [],
      sharedMailboxGroups: [],
      apiTokens: [],
      documents: [],
      favorites: [],
      dashboards: [],
      createdEvents: [],
      createdTickets: [],
      createdSalesOpportunities: [],
      session: null,
      birthDay: new Date('1990-09-23T00:00:00.000Z'),
      isActive: true,
      sendNewsletter: true,
      requirePasswordChange: false,
      createdAt: new Date('2026-05-12T08:38:28.667Z'),
      updatedAt: new Date('2026-05-12T08:38:28.667Z'),
    };
    const changeLogDetailsAdd = jest.fn();
    const logCreateCalls: Array<Record<string, unknown>> = [];
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'person' })
      .mockResolvedValueOnce(item);
    const assign = jest.fn((_item: object, data: object) => ({
      ...item,
      ...data,
    }));
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const logEm = {
      findOne: jest.fn(() => Promise.resolve({ handle: 'update' })),
      create: jest.fn((cls: unknown, data: Record<string, unknown>) => {
        if ('action' in data) {
          logCreateCalls.push(data);
          return {
            ...data,
            details: {
              add: changeLogDetailsAdd,
            },
          };
        }

        return data;
      }),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    const em = {
      findOne,
      assign,
      flush,
      create: logEm.create,
      fork: jest.fn(() => logEm),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'person':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'phone', type: 'string' }),
              createTemplateField({ name: 'mobile', type: 'string' }),
              createTemplateField({ name: 'email', type: 'string' }),
              createTemplateField({ name: 'firstName', type: 'string' }),
              createTemplateField({ name: 'lastName', type: 'string' }),
              createTemplateField({ name: 'loginName', type: 'string' }),
              createTemplateField({
                name: 'loginPassword',
                options: ['isSecurity'],
              }),
              createTemplateField({
                name: 'type',
                isReference: true,
                kind: 'm:1',
                referenceName: 'personType',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'company',
                isReference: true,
                kind: 'm:1',
                referenceName: 'company',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'language',
                isReference: true,
                kind: 'm:1',
                referenceName: 'language',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'workWeek',
                isReference: true,
                kind: 'm:1',
                referenceName: 'workHourWeek',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'holidayGroup',
                isReference: true,
                kind: 'm:1',
                referenceName: 'holidayGroup',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'roles',
                isReference: true,
                kind: 'm:n',
                referenceName: 'role',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'notes',
                isReference: true,
                kind: '1:m',
                referenceName: 'note',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'mailLists',
                isReference: true,
                kind: 'm:n',
                referenceName: 'emailList',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'sharedMailboxGroups',
                isReference: true,
                kind: 'm:n',
                referenceName: 'sharedMailboxGroup',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'apiTokens',
                isReference: true,
                kind: '1:m',
                referenceName: 'personApiToken',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'documents',
                isReference: true,
                kind: '1:m',
                referenceName: 'document',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'favorites',
                isReference: true,
                kind: '1:m',
                referenceName: 'favorite',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'dashboards',
                isReference: true,
                kind: '1:m',
                referenceName: 'dashboard',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'createdEvents',
                isReference: true,
                kind: '1:m',
                referenceName: 'event',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'createdTickets',
                isReference: true,
                kind: '1:m',
                referenceName: 'ticket',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'createdSalesOpportunities',
                isReference: true,
                kind: '1:m',
                referenceName: 'salesOpportunity',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'session',
                isReference: true,
                kind: '1:1',
                referenceName: 'personSession',
                referencedPks: ['handle'],
              }),
              createTemplateField({ name: 'birthDay', type: 'date' }),
              createTemplateField({ name: 'isActive', type: 'boolean' }),
              createTemplateField({
                name: 'sendNewsletter',
                type: 'boolean',
              }),
              createTemplateField({
                name: 'requirePasswordChange',
                type: 'boolean',
              }),
              createTemplateField({ name: 'createdAt', type: 'date' }),
              createTemplateField({ name: 'updatedAt', type: 'date' }),
            ];
          default:
            return [];
        }
      }),
    };
    const scriptService = {
      runServer: jest.fn((_method: unknown, items: object | object[]) =>
        Promise.resolve(new ScriptResultServer(toScriptItems(items))),
      ),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowUpdateStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
      scriptService,
    });

    await service.update(
      'person',
      1,
      {
        type: 'sapling',
        color: '#4CAF50',
        email: 'info@standardfirma.de',
        notes: [],
        phone: '+49 1234567890',
        roles: [],
        handle: 1,
        mobile: '+49 1234567891',
        company: 1,
        session: null,
        birthDay: '1990-09-23T00:00:00.000Z',
        isActive: true,
        language: 'de',
        lastName: 'Mustermann',
        workWeek: 1,
        apiTokens: [],
        createdAt: new Date('2026-05-12T08:38:00.000Z'),
        documents: [],
        favorites: [],
        firstName: 'Max',
        loginName: 'max-mustermann',
        mailLists: [],
        updatedAt: new Date('2026-05-12T08:38:28.667Z'),
        dashboards: [],
        department: null,
        holidayGroup: 2,
        createdEvents: [],
        loginPassword: '',
        createdTickets: [],
        sendNewsletter: true,
        sharedMailboxGroups: [],
        requirePasswordChange: false,
        createdSalesOpportunities: [],
      },
      { handle: 1 } as never,
      [],
    );

    await waitForBackgroundTasks();

    expect(logCreateCalls[0]?.oldPayload).toMatchObject({
      type: 'sapling',
      phone: '+49 1234 567890',
      mobile: '+49 1234 567891',
      company: 1,
      language: 'de',
      workWeek: 1,
      holidayGroup: 2,
      loginPassword: '',
      createdTickets: [],
      createdEvents: [],
      createdSalesOpportunities: [],
      roles: [],
      notes: [],
      session: null,
    });
  });

  it('does not fail the update when change log persistence throws', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const item = { handle: 7, phone: '+49 1111111111' };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'person' })
      .mockResolvedValueOnce(item);
    const assign = jest.fn((_item: object, data: object) => ({
      ...item,
      ...data,
    }));
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const logEm = {
      create: jest.fn((cls: unknown, data: Record<string, unknown>) => {
        if ('action' in data) {
          return {
            ...data,
            details: {
              add: jest.fn(),
            },
          };
        }

        return data;
      }),
      flush: jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error('log failed')),
      getReference: jest.fn((_cls: unknown, handle: string | number) => ({
        handle,
      })),
    };
    const em = {
      findOne,
      assign,
      flush,
      create: logEm.create,
      fork: jest.fn(() => logEm),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'phone', type: 'string' }),
      ]),
    };
    const scriptService = {
      runServer: jest.fn((_method: unknown, items: object | object[]) =>
        Promise.resolve(new ScriptResultServer(toScriptItems(items))),
      ),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowUpdateStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
      scriptService,
    });

    const result = await service.update(
      'person',
      7,
      {
        phone: '+49 1234567890',
      },
      { handle: 1 } as never,
      [],
    );

    expect(assign).toHaveBeenCalledWith(item, {
      phone: '+49 1234567890',
    });
    expect(result).toMatchObject({
      handle: 7,
      phone: '+49 1234567890',
    });
  });
});
