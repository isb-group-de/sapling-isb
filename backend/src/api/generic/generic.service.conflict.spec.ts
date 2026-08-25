import { expect, it, jest } from '@jest/globals';
import {
  ConflictException,
  ScriptResultServer,
  createTemplateField,
  toScriptItems,
  createGenericService,
} from './generic.service.spec-support';

describe('GenericService update conflicts', () => {
  it('rejects stale generic updates with field-level conflict details', async () => {
    const item = {
      handle: 7,
      title: 'Server title',
      description: 'Original description',
      company: { handle: 9 },
      updatedAt: new Date('2026-05-12T08:40:00.000Z'),
    };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'person' })
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce(null);
    const assign = jest.fn();
    const em = {
      findOne,
      assign,
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'title' }),
        createTemplateField({ name: 'description' }),
        createTemplateField({
          name: 'company',
          isReference: true,
          kind: 'm:1',
          referenceName: 'company',
        }),
        createTemplateField({ name: 'updatedAt', type: 'date' }),
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

    let thrown: unknown;
    try {
      await service.update(
        'person',
        7,
        {
          title: 'Client title',
          company: 5,
          _saplingConcurrency: {
            expectedUpdatedAt: '2026-05-12T08:38:00.000Z',
            basePayload: {
              handle: 7,
              title: 'Original title',
              description: 'Original description',
              company: 3,
            },
          },
        },
        { handle: 1 } as never,
        [],
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConflictException);
    const response = (thrown as ConflictException).getResponse() as {
      details: {
        current: Record<string, unknown>;
        attempted: Record<string, unknown>;
        fields: Array<{ property: string }>;
      };
    };

    expect(response).toMatchObject({
      message: 'exception.concurrentUpdate',
      details: {
        reason: 'staleRecord',
        entityHandle: 'person',
        handle: 7,
        expectedUpdatedAt: '2026-05-12T08:38:00.000Z',
        currentUpdatedAt: '2026-05-12T08:40:00.000Z',
        autoMergeable: false,
        conflictingProperties: ['company', 'title'],
        mergeableProperties: [],
        fields: [
          expect.objectContaining({
            property: 'company',
            baseValue: 3,
            currentValue: 9,
            attemptedValue: 5,
            conflict: true,
          }),
          expect.objectContaining({
            property: 'title',
            baseValue: 'Original title',
            currentValue: 'Server title',
            attemptedValue: 'Client title',
            conflict: true,
          }),
        ],
      },
    });
    expect(response.details.fields.map((field) => field.property)).toEqual([
      'company',
      'title',
    ]);
    expect(response.details.current).toHaveProperty('company', 9);
    expect(response.details.attempted).toHaveProperty('company', 5);
    expect(assign).not.toHaveBeenCalled();
  });

  it('rejects stale m:1 reference conflicts and treats null and empty strings as equal', async () => {
    const item = {
      handle: 7,
      nickname: '',
      company: { handle: 9 },
      updatedAt: new Date('2026-05-12T08:40:00.000Z'),
    };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'person' })
      .mockResolvedValueOnce(item);
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
        createTemplateField({ name: 'nickname' }),
        createTemplateField({
          name: 'company',
          isReference: true,
          kind: 'm:1',
          referenceName: 'company',
        }),
        createTemplateField({ name: 'updatedAt', type: 'date' }),
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

    let thrown: unknown;
    try {
      await service.update(
        'person',
        7,
        {
          nickname: null,
          company: 5,
          _saplingConcurrency: {
            expectedUpdatedAt: '2026-05-12T08:38:00.000Z',
            basePayload: {
              handle: 7,
              nickname: null,
              company: 3,
            },
          },
        },
        { handle: 1 } as never,
        [],
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConflictException);
    const response = (thrown as ConflictException).getResponse() as {
      details: {
        conflictingProperties: string[];
        fields: Array<{ property: string }>;
      };
    };

    expect(response.details.conflictingProperties).toEqual(['company']);
    expect(response.details.fields).toEqual([
      expect.objectContaining({
        property: 'company',
        baseValue: 3,
        currentValue: 9,
        attemptedValue: 5,
        conflict: true,
      }),
    ]);
    expect(assign).not.toHaveBeenCalled();
  });

  it('automatically merges stale m:1 reference updates when fields do not overlap', async () => {
    const item = {
      handle: 7,
      title: 'Server title',
      company: { handle: 3 },
      updatedAt: new Date('2026-05-12T08:40:00.000Z'),
    };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'person' })
      .mockResolvedValueOnce(item);
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
        createTemplateField({
          name: 'company',
          isReference: true,
          kind: 'm:1',
          referenceName: 'company',
        }),
        createTemplateField({ name: 'updatedAt', type: 'date' }),
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
        handle: 7,
        title: 'Original title',
        company: 5,
        _saplingConcurrency: {
          expectedUpdatedAt: '2026-05-12T08:38:00.000Z',
          basePayload: {
            handle: 7,
            title: 'Original title',
            company: 3,
          },
          resolution: 'merge',
        },
      },
      { handle: 1 } as never,
      [],
    );

    expect(assign).toHaveBeenCalledWith(item, {
      company: 5,
    });
    expect(result).toMatchObject({
      handle: 7,
      title: 'Server title',
      company: 5,
    });
  });

  it('automatically merges stale updates when fields do not overlap', async () => {
    const item = {
      handle: 7,
      title: 'Server title',
      description: 'Original description',
      updatedAt: new Date('2026-05-12T08:40:00.000Z'),
    };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'person' })
      .mockResolvedValueOnce(item);
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
        createTemplateField({ name: 'description' }),
        createTemplateField({ name: 'updatedAt', type: 'date' }),
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
        handle: 7,
        title: 'Original title',
        description: 'Client description',
        updatedAt: new Date('2026-05-12T08:38:00.000Z'),
        _saplingConcurrency: {
          expectedUpdatedAt: '2026-05-12T08:38:00.000Z',
          basePayload: {
            handle: 7,
            title: 'Original title',
            description: 'Original description',
          },
          resolution: 'merge',
        },
      },
      { handle: 1 } as never,
      [],
    );

    expect(assign).toHaveBeenCalledWith(item, {
      description: 'Client description',
    });
    expect(result).toMatchObject({
      handle: 7,
      title: 'Server title',
      description: 'Client description',
    });
  });

  it('drops inverse one-to-many relations from update payloads before assign', async () => {
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
                name: 'createdTickets',
                isReference: true,
                kind: '1:m',
                referenceName: 'ticket',
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

    const result = await service.update(
      'person',
      7,
      {
        phone: '+49 1234567890',
        createdTickets: [{ handle: 1 }, { handle: 2 }],
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
