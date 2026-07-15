import { expect, it, jest } from '@jest/globals';
import {
  hasSaplingOption,
  createTemplateField,
  createGenericService,
} from './generic.service.spec-support';

describe('GenericService read workflows', () => {
  it('normalizes dotted relation filters and infers populate relations', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValue(null);
    const findAndCount = jest.fn(
      () => [[{ handle: 7 }], 1] as [object[], number],
    );
    const em = {
      findOne,
      findAndCount,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'salesOpportunity':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({
                name: 'assigneePerson',
                isReference: true,
                kind: 'm:1',
                referenceName: 'person',
                referencedPks: ['handle'],
              }),
            ];
          case 'person':
            return [createTemplateField({ name: 'handle', type: 'number' })];
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
      'salesOpportunity',
      { 'assigneePerson.handle': { $eq: 1 } },
      1,
      25,
      {},
      { handle: 1 } as never,
      [],
    );

    expect(findAndCount.mock.calls[0]).toEqual([
      expect.any(Function),
      { assigneePerson: { handle: { $eq: 1 } } },
      expect.objectContaining({
        populate: ['assigneePerson'],
      }),
    ]);
  });

  it('sanitizes security fields without mutating managed relation objects', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(
      (...args: unknown[]) =>
        args[1] === 'loginPassword' && args[2] === 'isSecurity',
    );

    const originalPassword = 'hashed-secret';
    const assigneePerson = {
      handle: 1,
      firstName: 'Ada',
      loginPassword: originalPassword,
    };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValue(null);
    const findAndCount = jest.fn(
      () =>
        [
          [
            {
              handle: 7,
              assigneePerson,
            },
          ],
          1,
        ] as [object[], number],
    );
    const em = {
      findOne,
      findAndCount,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'salesOpportunity':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({
                name: 'assigneePerson',
                isReference: true,
                kind: 'm:1',
                referenceName: 'person',
                referencedPks: ['handle'],
              }),
            ];
          case 'person':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'firstName' }),
              createTemplateField({
                name: 'loginPassword',
                options: ['isSecurity'],
              }),
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
      'salesOpportunity',
      {},
      1,
      25,
      {},
      { handle: 1 } as never,
      ['assigneePerson'],
    );

    expect(result.data).toEqual([
      {
        handle: 7,
        assigneePerson: {
          handle: 1,
          firstName: 'Ada',
        },
      },
    ]);
    expect(assigneePerson.loginPassword).toBe(originalPassword);
  });

  it('keeps top-level rows even when an earlier row references a later row', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const laterRow = {
      handle: 2,
      title: 'Later row',
    };
    const firstRow = {
      handle: 1,
      title: 'First row',
      followUpOpportunity: laterRow,
    };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValue(null);
    const findAndCount = jest.fn(
      () => [[firstRow, laterRow], 2] as [object[], number],
    );
    const em = {
      findOne,
      findAndCount,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'salesOpportunity':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'title' }),
              createTemplateField({
                name: 'followUpOpportunity',
                isReference: true,
                kind: 'm:1',
                referenceName: 'salesOpportunity',
                referencedPks: ['handle'],
              }),
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
      'salesOpportunity',
      {},
      1,
      25,
      {},
      { handle: 1 } as never,
      ['followUpOpportunity'],
    );

    expect(result.data).toEqual([
      {
        handle: 1,
        title: 'First row',
        followUpOpportunity: {
          handle: 2,
          title: 'Later row',
        },
      },
      {
        handle: 2,
        title: 'Later row',
      },
    ]);
  });

  it('keeps top-level rows complete when nested circular references create handle fallbacks', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const accountManager = {
      handle: 5,
      firstName: 'Julia',
      lastName: 'Demo',
    } as Record<string, unknown>;
    const laterCompany = {
      handle: 2,
      name: 'Later GmbH',
      accountManager,
    };
    accountManager.company = laterCompany;
    const firstCompany = {
      handle: 1,
      name: 'First GmbH',
      accountManager,
    };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValue(null);
    const findAndCount = jest.fn(
      () => [[firstCompany, laterCompany], 2] as [object[], number],
    );
    const em = {
      findOne,
      findAndCount,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'company':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'name' }),
              createTemplateField({
                name: 'accountManager',
                isReference: true,
                kind: 'm:1',
                referenceName: 'person',
                referencedPks: ['handle'],
              }),
            ];
          case 'person':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'firstName' }),
              createTemplateField({ name: 'lastName' }),
              createTemplateField({
                name: 'company',
                isReference: true,
                kind: 'm:1',
                referenceName: 'company',
                referencedPks: ['handle'],
              }),
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
      'company',
      {},
      1,
      25,
      {},
      { handle: 1 } as never,
      ['accountManager'],
    );
    const rows = result.data as Array<{
      accountManager?: Record<string, unknown>;
    }>;

    expect(rows[1]?.accountManager).toEqual({
      handle: 5,
      firstName: 'Julia',
      lastName: 'Demo',
      company: {
        handle: 2,
      },
    });
  });

  it('keeps computed getter fields and shared reference objects during sanitization', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    class TicketRecord {
      handle = 7;
      creatorCompany: Record<string, unknown>;
      creatorPerson: Record<string, unknown>;

      constructor() {
        const sharedCompany = {
          handle: 3,
          name: 'Acme GmbH',
        };

        this.creatorCompany = sharedCompany;
        this.creatorPerson = {
          handle: 5,
          email: 'person@example.com',
          phone: '+49 30 123456',
          company: sharedCompany,
        };
      }

      get creatorPersonEmail(): string | undefined {
        return this.creatorPerson.email as string | undefined;
      }

      get creatorPersonPhone(): string | undefined {
        return this.creatorPerson.phone as string | undefined;
      }
    }

    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValue(null);
    const findAndCount = jest.fn(
      () => [[new TicketRecord()], 1] as [object[], number],
    );
    const em = {
      findOne,
      findAndCount,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'ticket':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({
                name: 'creatorCompany',
                isReference: true,
                kind: 'm:1',
                referenceName: 'company',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'creatorPerson',
                isReference: true,
                kind: 'm:1',
                referenceName: 'person',
                referencedPks: ['handle'],
              }),
              createTemplateField({
                name: 'creatorPersonEmail',
                type: 'string',
                isPersistent: false,
              }),
              createTemplateField({
                name: 'creatorPersonPhone',
                type: 'string',
                isPersistent: false,
              }),
            ];
          case 'person':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'email', type: 'string' }),
              createTemplateField({ name: 'phone', type: 'string' }),
              createTemplateField({
                name: 'company',
                isReference: true,
                kind: 'm:1',
                referenceName: 'company',
                referencedPks: ['handle'],
              }),
            ];
          case 'company':
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
      'ticket',
      {},
      1,
      25,
      {},
      { handle: 1 } as never,
      ['creatorCompany', 'creatorPerson'],
    );

    expect(result.data).toEqual([
      {
        handle: 7,
        creatorCompany: {
          handle: 3,
          name: 'Acme GmbH',
        },
        creatorPerson: {
          handle: 5,
          email: 'person@example.com',
          phone: '+49 30 123456',
          company: {
            handle: 3,
            name: 'Acme GmbH',
          },
        },
        creatorPersonEmail: 'person@example.com',
        creatorPersonPhone: '+49 30 123456',
      },
    ]);
  });

  it('normalizes shorthand relation operator filters and infers populate relations', async () => {
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
          case 'person':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({
                name: 'company',
                isReference: true,
                kind: 'm:1',
                referenceName: 'company',
                referencedPks: ['handle'],
              }),
            ];
          case 'company':
            return [createTemplateField({ name: 'handle', type: 'number' })];
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
      'person',
      { company: { $eq: 5 } },
      1,
      25,
      {},
      { handle: 1 } as never,
      [],
    );

    expect(findAndCount.mock.calls[0]).toEqual([
      expect.any(Function),
      { company: { handle: { $eq: 5 } } },
      expect.objectContaining({
        populate: ['company'],
      }),
    ]);
  });
});
