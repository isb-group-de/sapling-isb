import { expect, it, jest } from '@jest/globals';
import {
  ScriptResultServer,
  ScriptResultServerMethods,
  ScriptMethods,
  createTemplateField,
  toScriptItems,
  createGenericService,
} from './generic.service.spec-support';

describe('GenericService relation workflows', () => {
  it('runs addReference scripts with relation context after the reference flush', async () => {
    const relation = {
      init: jest
        .fn<(...args: unknown[]) => Promise<undefined>>()
        .mockResolvedValue(undefined),
      add: jest.fn(),
      remove: jest.fn(),
    };
    const item = {
      handle: 7,
      tags: relation,
      title: 'Existing ticket',
    };
    const referenceItem = { handle: 3, name: 'Important' };
    const entity = { handle: 'ticket' };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce(entity)
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce(referenceItem);
    const assign = jest.fn((target: object, data: object) =>
      Object.assign(target as Record<string, unknown>, data),
    );
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const runServer = jest.fn(
      (
        method: unknown,
        items: object | object[],
        _entity: unknown,
        _user: unknown,
        context?: {
          currentItems?: object[];
          referenceName?: string;
          referenceItems?: object[];
        },
      ) => {
        const scriptItems = toScriptItems(items);

        if (method === ScriptMethods.addReference) {
          expect(context).toEqual({
            referenceName: 'tags',
            referenceItems: [referenceItem],
          });
          return Promise.resolve(
            new ScriptResultServer(
              [
                {
                  ...(scriptItems[0] as Record<string, unknown>),
                  title: 'Updated by addReference hook',
                },
              ],
              ScriptResultServerMethods.overwrite,
            ),
          );
        }

        expect(method).toBe(ScriptMethods.afterUpdate);
        expect(context).toEqual({
          currentItems: [item],
          referenceName: 'tags',
          referenceItems: [referenceItem],
        });
        return Promise.resolve(new ScriptResultServer(scriptItems));
      },
    );
    const scriptService = {
      runServer,
    };
    const em = {
      findOne,
      assign,
      flush,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'ticket':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'title', type: 'string' }),
              createTemplateField({
                name: 'tags',
                isReference: true,
                kind: 'm:n',
                referenceName: 'tag',
              }),
            ];
          case 'tag':
            return [createTemplateField({ name: 'handle', type: 'number' })];
          default:
            return [];
        }
      }),
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

    const result = await service.createReference('ticket', 'tags', 7, 3, {
      handle: 1,
    } as never);

    expect(relation.init).toHaveBeenCalledWith({ where: { handle: 3 } });
    expect(relation.add).toHaveBeenCalledWith(referenceItem);
    expect(assign).toHaveBeenCalledWith(item, {
      handle: 7,
      tags: relation,
      title: 'Updated by addReference hook',
    });
    expect(runServer).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      handle: 7,
      title: 'Updated by addReference hook',
    });
  });

  it('runs deleteReference scripts with relation context after the reference flush', async () => {
    const relation = {
      init: jest
        .fn<(...args: unknown[]) => Promise<undefined>>()
        .mockResolvedValue(undefined),
      add: jest.fn(),
      remove: jest.fn(),
    };
    const item = {
      handle: 7,
      tags: relation,
      title: 'Existing ticket',
    };
    const referenceItem = { handle: 3, name: 'Important' };
    const entity = { handle: 'ticket' };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce(entity)
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce(referenceItem);
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const runServer = jest.fn(
      (
        method: unknown,
        items: object | object[],
        _entity: unknown,
        _user: unknown,
        context?: {
          currentItems?: object[];
          referenceName?: string;
          referenceItems?: object[];
        },
      ) => {
        if (method === ScriptMethods.deleteReference) {
          expect(context).toEqual({
            referenceName: 'tags',
            referenceItems: [referenceItem],
          });
          return Promise.resolve(new ScriptResultServer([item]));
        }

        expect(method).toBe(ScriptMethods.afterUpdate);
        expect(context).toEqual({
          currentItems: [item],
          referenceName: 'tags',
          referenceItems: [referenceItem],
        });
        return Promise.resolve(new ScriptResultServer(toScriptItems(items)));
      },
    );
    const scriptService = {
      runServer,
    };
    const em = {
      findOne,
      assign: jest.fn(),
      flush,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'ticket':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'title', type: 'string' }),
              createTemplateField({
                name: 'tags',
                isReference: true,
                kind: 'm:n',
                referenceName: 'tag',
              }),
            ];
          case 'tag':
            return [createTemplateField({ name: 'handle', type: 'number' })];
          default:
            return [];
        }
      }),
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

    const result = await service.deleteReference('ticket', 'tags', 7, 3, {
      handle: 1,
    } as never);

    expect(relation.init).toHaveBeenCalledWith({ where: { handle: 3 } });
    expect(relation.remove).toHaveBeenCalledWith(referenceItem);
    expect(runServer).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      handle: 7,
      title: 'Existing ticket',
    });
  });

  it('triggers afterUpdate on the owning side for inverse n:m reference changes', async () => {
    const relation = {
      init: jest
        .fn<(...args: unknown[]) => Promise<undefined>>()
        .mockResolvedValue(undefined),
      add: jest.fn(),
      remove: jest.fn(),
    };
    const person = {
      handle: 5,
      firstName: 'Ada',
      events: relation,
    };
    const event = {
      handle: 7,
      title: 'Planning',
      participants: [],
      updatedAt: undefined as Date | undefined,
    };
    const personEntity = { handle: 'person' };
    const eventEntity = { handle: 'event' };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce(personEntity)
      .mockResolvedValueOnce(person)
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(eventEntity);
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const runServer = jest.fn(
      (
        method: unknown,
        items: object | object[],
        entity: { handle?: string },
        _user: unknown,
        context?: {
          currentItems?: object[];
          referenceName?: string;
          referenceItems?: object[];
        },
      ) => {
        if (method === ScriptMethods.addReference) {
          expect(entity).toEqual(personEntity);
          expect(context).toEqual({
            referenceName: 'events',
            referenceItems: [event],
          });
          return Promise.resolve(new ScriptResultServer(toScriptItems(items)));
        }

        expect(method).toBe(ScriptMethods.afterUpdate);
        expect(entity).toEqual(eventEntity);
        expect(context).toEqual({
          currentItems: [event],
          referenceName: 'participants',
          referenceItems: [person],
        });
        return Promise.resolve(new ScriptResultServer(toScriptItems(items)));
      },
    );
    const em = {
      findOne,
      assign: jest.fn((target: object, data: object) =>
        Object.assign(target as Record<string, unknown>, data),
      ),
      flush,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'person':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'firstName', type: 'string' }),
              createTemplateField({
                name: 'events',
                isReference: true,
                kind: 'n:m',
                mappedBy: 'participants',
                referenceName: 'event',
              }),
            ];
          case 'event':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'title', type: 'string' }),
              createTemplateField({
                name: 'participants',
                isReference: true,
                kind: 'm:n',
                referenceName: 'person',
              }),
            ];
          default:
            return [];
        }
      }),
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
      scriptService: { runServer },
    });

    const result = await service.createReference('person', 'events', 5, 7, {
      handle: 1,
    } as never);

    expect(relation.init).toHaveBeenCalledWith({ where: { handle: 7 } });
    expect(relation.add).toHaveBeenCalledWith(event);
    expect(runServer).toHaveBeenCalledTimes(2);
    expect(event.updatedAt).toBeInstanceOf(Date);
    expect(result).toMatchObject({
      handle: 5,
      firstName: 'Ada',
    });
  });
});
