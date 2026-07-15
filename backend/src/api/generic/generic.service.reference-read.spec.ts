import { expect, it, jest } from '@jest/globals';
import {
  hasSaplingOption,
  createTemplateField,
  createGenericService,
} from './generic.service.spec-support';

describe('GenericService reference reads', () => {
  it('normalizes relation filters to referenced string primary keys', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValue(null);
    const findAndCount = jest.fn(
      () => [[{ handle: 9 }], 1] as [object[], number],
    );
    const em = {
      findOne,
      findAndCount,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'aiChatSession':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({
                name: 'model',
                isReference: true,
                kind: 'm:1',
                referenceName: 'aiProviderModel',
                referencedPks: ['handle'],
              }),
            ];
          case 'aiProviderModel':
            return [createTemplateField({ name: 'handle', type: 'string' })];
          default:
            return [];
        }
      }),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowReadStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
    });

    await service.findAndCount(
      'aiChatSession',
      { model: { $eq: 6 } },
      1,
      25,
      {},
      { handle: 1 } as never,
      [],
    );

    expect(findAndCount.mock.calls[0]).toEqual([
      expect.any(Function),
      { model: { handle: { $eq: '6' } } },
      expect.objectContaining({
        populate: ['model'],
      }),
    ]);
  });

  it('breaks circular person session references into handle-only fallbacks', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(
      (...args: unknown[]) =>
        (args[1] === 'accessToken' || args[1] === 'refreshToken') &&
        args[2] === 'isSecurity',
    );

    const person = {
      handle: 1,
      firstName: 'Ada',
    } as Record<string, unknown>;
    const session = {
      handle: 99,
      number: 'session-99',
      accessToken: 'secret-access-token',
      refreshToken: 'secret-refresh-token',
      person,
    } as Record<string, unknown>;
    person.session = session;
    person.roles = {
      isInitialized: () => true,
      toArray: () => [{ handle: 5, name: 'Admin' }],
    };

    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValue(null);
    const findAndCount = jest.fn(() => [[person], 1] as [object[], number]);
    const em = {
      findOne,
      findAndCount,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'person':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'firstName', type: 'string' }),
              createTemplateField({
                name: 'session',
                isReference: true,
                kind: '1:1',
                referenceName: 'personSession',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'roles',
                isReference: true,
                kind: 'm:n',
                referenceName: 'role',
                referencedPks: ['handle'],
              }),
            ];
          case 'personSession':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'number', type: 'string' }),
              createTemplateField({
                name: 'accessToken',
                options: ['isSecurity'],
              }),
              createTemplateField({
                name: 'refreshToken',
                options: ['isSecurity'],
              }),
              createTemplateField({
                name: 'person',
                isReference: true,
                kind: '1:1',
                referenceName: 'person',
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
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowReadStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
    });

    const result = await service.findAndCount(
      'person',
      {},
      1,
      25,
      {},
      { handle: 1 } as never,
      ['roles'],
    );

    expect(result.data).toEqual([
      {
        handle: 1,
        firstName: 'Ada',
        session: {
          handle: 99,
          number: 'session-99',
          person: {
            handle: 1,
          },
        },
        roles: [
          {
            handle: 5,
            name: 'Admin',
          },
        ],
      },
    ]);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
