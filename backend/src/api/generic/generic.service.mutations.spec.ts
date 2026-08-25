import { expect, it, jest } from '@jest/globals';
import {
  hasSaplingOption,
  ScriptResultServer,
  createTemplateField,
  createDeferred,
  toScriptItems,
  createGenericService,
} from './generic.service.spec-support';

describe('GenericService create delete and import workflows', () => {
  it('does not reload newly created records after flush by default', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const createdRecord = {
      handle: 42,
      title: 'Neuer Datensatz',
    };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValue(null);
    const em = {
      findOne,
      create: jest.fn(() => createdRecord),
      flush: jest.fn(() => Promise.resolve(undefined)),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'title', type: 'string' }),
      ]),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowInsertStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
    });

    const result = await service.create(
      'ticket',
      { title: 'Neuer Datensatz' },
      { handle: 1 } as never,
    );

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      handle: 42,
      title: 'Neuer Datensatz',
    });
  });

  it('returns create responses before detached change log and open-task work completes', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const openTaskDeferred = createDeferred<object | null>();
    const changeLogDeferred = createDeferred<object | null>();
    const createdRecord = {
      handle: 42,
      title: 'Neuer Datensatz',
    };
    const openTaskEventsService = {
      notifyUsers: jest.fn(),
    };
    const findOne = jest
      .fn<(...args: unknown[]) => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'ticket' })
      .mockImplementation((...args: unknown[]) => {
        const where = args[1] as { handle?: unknown } | undefined;
        if (where?.handle === 42) {
          return openTaskDeferred.promise;
        }

        return Promise.resolve(null);
      });
    const logEm = {
      findOne: jest.fn(() => changeLogDeferred.promise),
      create: jest.fn(),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    const em = {
      findOne,
      create: jest.fn(() => createdRecord),
      flush: jest.fn(() => Promise.resolve(undefined)),
      fork: jest.fn(() => logEm),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
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
      openTaskEventsService,
    });

    const createPromise = service.create(
      'ticket',
      { title: 'Neuer Datensatz' },
      { handle: 1 } as never,
    );
    const raceResult = await Promise.race([
      createPromise.then(() => 'resolved'),
      new Promise<'timeout'>((resolve) => {
        setImmediate(() => resolve('timeout'));
      }),
    ]);

    expect(raceResult).toBe('resolved');
    await expect(createPromise).resolves.toEqual(createdRecord);
    expect(openTaskEventsService.notifyUsers).not.toHaveBeenCalled();

    changeLogDeferred.resolve(null);
    openTaskDeferred.resolve(null);
    await Promise.resolve();
    await Promise.resolve();
  });

  it('does not reload deleted records before the after-delete handoff', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        handle: 9,
        title: 'Zu loeschender Datensatz',
      })
      .mockResolvedValueOnce(null);
    const nativeDelete = jest
      .fn<(entity: unknown, where: { handle: number }) => Promise<number>>()
      .mockResolvedValue(1);
    const em = {
      findOne,
      nativeDelete,
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'title', type: 'string' }),
      ]),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowDeleteStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
    });

    await service.delete('ticket', 9, { handle: 1 } as never);

    expect(findOne).toHaveBeenCalledTimes(3);
    expect(nativeDelete).toHaveBeenCalledWith(expect.any(Function), {
      handle: 9,
    });
  });

  it('does not auto-populate all relations during delete', async () => {
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce({
        handle: 9,
        title: 'Zu loeschender Datensatz',
      })
      .mockResolvedValueOnce(null);
    const nativeDelete = jest
      .fn<(entity: unknown, where: { handle: number }) => Promise<number>>()
      .mockResolvedValue(1);
    const em = {
      findOne,
      nativeDelete,
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'title', type: 'string' }),
        createTemplateField({
          name: 'roles',
          isReference: true,
          kind: 'm:n',
          referenceName: 'role',
          referencedPks: ['handle'],
        }),
      ]),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowDeleteStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
    });

    await service.delete('person', 9, { handle: 1 } as never);

    expect(findOne.mock.calls[0]).toEqual([
      expect.any(Function),
      { handle: 9 },
    ]);
  });

  it('limits direct event deletes to records visible under private-event rules', async () => {
    const item = {
      handle: 101,
      title: 'Private event',
      isPrivate: true,
      creatorPerson: { handle: 7 },
    };
    const findOne = jest
      .fn<(...args: unknown[]) => Promise<object | null>>()
      .mockImplementation((_entity, where, options) => {
        const populate = (options as { populate?: string[] } | undefined)
          ?.populate;

        if (
          (where as { handle?: unknown }).handle === 101 &&
          populate?.includes('participants') &&
          populate.includes('status') &&
          populate.includes('creatorPerson')
        ) {
          return Promise.resolve(null);
        }

        if ((where as { handle?: unknown }).handle === 'event') {
          return Promise.resolve(null);
        }

        if (
          JSON.stringify(where) ===
          JSON.stringify({
            $and: [
              { handle: 101 },
              {
                $or: [{ isPrivate: false }, { creatorPerson: 7 }],
              },
            ],
          })
        ) {
          return Promise.resolve(item);
        }

        return Promise.resolve(null);
      });
    const nativeDelete = jest
      .fn<(entity: unknown, where: { handle: number }) => Promise<number>>()
      .mockResolvedValue(1);
    const em = {
      findOne,
      nativeDelete,
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'title', type: 'string' }),
        createTemplateField({ name: 'isPrivate', type: 'boolean' }),
      ]),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowDeleteStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
    });

    await service.delete('event', '101', { handle: 7 } as never);

    expect(findOne).toHaveBeenCalledWith(expect.any(Function), {
      $and: [
        { handle: 101 },
        {
          $or: [{ isPrivate: false }, { creatorPerson: 7 }],
        },
      ],
    });
    expect(nativeDelete).toHaveBeenCalledWith(expect.any(Function), {
      handle: 101,
    });
  });

  it('imports rows through create/update and normalizes simple CSV values', async () => {
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({
          name: 'handle',
          type: 'number',
          isAutoIncrement: true,
        }),
        createTemplateField({ name: 'title', type: 'string' }),
        createTemplateField({ name: 'amount', type: 'number' }),
        createTemplateField({ name: 'isActive', type: 'boolean' }),
        createTemplateField({ name: 'readonlyNote', options: ['isReadOnly'] }),
      ]),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowInsertStage: 'global',
        allowUpdateStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em: {},
      templateService,
      currentService,
    });
    const createSpy = jest
      .spyOn(service, 'create')
      .mockResolvedValue({ handle: 42 });
    const updateSpy = jest
      .spyOn(service, 'update')
      .mockResolvedValue({ handle: 7 });
    const currentUser = { handle: 1 } as never;

    const result = await service.importRows(
      'ticket',
      [
        {
          title: ' Neue Aufgabe ',
          amount: '12,5',
          isActive: 'yes',
          readonlyNote: 'ignored',
        },
        {
          handle: '7',
          title: 'Bestehend',
        },
        {},
      ],
      currentUser,
    );

    expect(createSpy).toHaveBeenCalledWith(
      'ticket',
      {
        title: 'Neue Aufgabe',
        amount: 12.5,
        isActive: true,
      },
      currentUser,
      {},
    );
    expect(updateSpy).toHaveBeenCalledWith(
      'ticket',
      7,
      {
        title: 'Bestehend',
      },
      currentUser,
      [],
      {},
      { resolution: 'overwrite' },
    );
    expect(result).toMatchObject({
      totalRows: 3,
      created: 1,
      updated: 1,
      skipped: 1,
      failed: 0,
    });
  });
});
