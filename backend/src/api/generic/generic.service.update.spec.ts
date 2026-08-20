import { expect, it, jest } from '@jest/globals';
import {
  ScriptResultServer,
  ScriptResultServerMethods,
  createTemplateField,
  toScriptItems,
  createGenericService,
} from './generic.service.spec-support';

describe('GenericService update workflows', () => {
  it('passes the current persisted item into beforeUpdate script context', async () => {
    const item = { handle: 7, title: 'Existing ticket' };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ handle: 'ticket' })
      .mockResolvedValueOnce(item);
    const assign = jest.fn((_item: object, data: object) => ({
      ...item,
      ...data,
    }));
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    type RunServerMock = (
      method: unknown,
      items: object | object[],
      entity: unknown,
      user: unknown,
      context?: { currentItems?: object[]; changedFields?: string[] },
    ) => Promise<ScriptResultServer>;
    const scriptService = {
      runServer: jest
        .fn<RunServerMock>()
        .mockImplementationOnce(
          (
            _method: unknown,
            items: object | object[],
            _entity: unknown,
            _user: unknown,
            context?: { currentItems?: object[]; changedFields?: string[] },
          ) => {
            expect(context).toEqual({ currentItems: [item] });
            const nextItem = (
              Array.isArray(items) ? items[0] : items
            ) as Record<string, unknown>;
            return Promise.resolve(
              new ScriptResultServer(
                [
                  {
                    ...nextItem,
                    title: 'Changed',
                  },
                ],
                ScriptResultServerMethods.overwrite,
              ),
            );
          },
        )
        .mockImplementationOnce(
          (
            _method: unknown,
            items: object | object[],
            _entity: unknown,
            _user: unknown,
            context?: { changedFields?: string[] },
          ) => {
            expect(context?.changedFields).toEqual(['title']);
            const resultItems: object[] =
              items instanceof Array ? items : [items];
            return Promise.resolve(new ScriptResultServer(resultItems));
          },
        ),
    };
    const em = {
      findOne,
      assign,
      flush,
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({
          name: 'handle',
          type: 'number',
          isPrimaryKey: true,
          isAutoIncrement: true,
        }),
        createTemplateField({ name: 'title' }),
      ]),
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
      'ticket',
      7,
      { handle: 7, title: 'Input' },
      { handle: 1 } as never,
      [],
    );

    expect(scriptService.runServer).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith(item, { title: 'Changed' });
    expect(result).toMatchObject({ handle: 7, title: 'Changed' });
  });

  it('updates open tickets without an assigned person', async () => {
    const item = {
      handle: 101,
      title: 'Old title',
      assigneePerson: null,
      status: { handle: 'open' },
    };
    const findOne = jest
      .fn<(...args: unknown[]) => Promise<object | null>>()
      .mockImplementation((_entity, where, options) => {
        const handle = (where as { handle?: unknown } | undefined)?.handle;
        const populate = (options as { populate?: string[] } | undefined)
          ?.populate;

        if (handle === 'ticket') {
          return Promise.resolve({ handle: 'ticket' });
        }

        if (
          handle === 101 &&
          populate?.includes('assigneePerson') &&
          populate.includes('status')
        ) {
          return Promise.resolve({
            handle: 101,
            assigneePerson: null,
            status: { handle: 'open' },
          });
        }

        if (handle === 101) {
          return Promise.resolve(item);
        }

        return Promise.resolve(null);
      });
    const assign = jest.fn((target: object, data: object) =>
      Object.assign(target as Record<string, unknown>, data),
    );
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const em = {
      findOne,
      assign,
      flush,
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'title' }),
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
      'ticket',
      '101',
      { title: 'Sapling 112233LL' },
      { handle: 1 } as never,
      [],
    );

    expect(assign).toHaveBeenCalledWith(item, {
      title: 'Sapling 112233LL',
    });
    expect(result).toMatchObject({
      handle: 101,
      title: 'Sapling 112233LL',
      assigneePerson: null,
    });
  });

  it('limits direct event updates to records visible under private-event rules', async () => {
    const item = {
      handle: 101,
      title: 'Old title',
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
    const assign = jest.fn((target: object, data: object) =>
      Object.assign(target as Record<string, unknown>, data),
    );
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const em = {
      findOne,
      assign,
      flush,
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'title' }),
        createTemplateField({ name: 'isPrivate', type: 'boolean' }),
      ]),
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
    });

    await service.update(
      'event',
      '101',
      { title: 'Updated title' },
      { handle: 7 } as never,
      [],
    );

    expect(assign).toHaveBeenCalledWith(item, {
      title: 'Updated title',
    });
    expect(findOne).toHaveBeenCalledWith(
      expect.any(Function),
      {
        $and: [
          { handle: 101 },
          {
            $or: [{ isPrivate: false }, { creatorPerson: 7 }],
          },
        ],
      },
      { populate: [] },
    );
  });

  it('does not auto-populate all relations during update when none were requested', async () => {
    const item = { handle: 7, phone: '+49 1111111111' };
    const findOne = jest
      .fn<(...args: unknown[]) => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'person' })
      .mockResolvedValueOnce(item);
    const assign = jest.fn((_item: object, data: object) => ({
      ...item,
      ...data,
    }));
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const em = {
      findOne,
      assign,
      flush,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'person':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'phone', type: 'string' }),
              createTemplateField({
                name: 'roles',
                isReference: true,
                kind: 'm:n',
                referenceName: 'role',
                referencedPks: ['handle'],
              }),
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
        phone: '+49 1234567890',
      },
      { handle: 1 } as never,
      [],
    );

    expect(findOne.mock.calls[1]?.[2]).toEqual({
      populate: [],
    });
  });
});
