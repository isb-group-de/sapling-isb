/* eslint-disable @typescript-eslint/unbound-method */
import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import axios from 'axios';
import { EntityManager } from '@mikro-orm/core';
import { DvelopConfigurationService } from './dvelop-configuration.service';
import { DvelopConnectionItem } from '../../entity/DvelopConnectionItem';
import { DvelopObjectDefinitionItem } from '../../entity/DvelopObjectDefinitionItem';
import { DvelopPropertyItem } from '../../entity/DvelopPropertyItem';
import { DvelopRepositoryItem } from '../../entity/DvelopRepositoryItem';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    isAxiosError: jest.fn(
      (error: unknown) =>
        typeof error === 'object' && error !== null && 'isAxiosError' in error,
    ),
  },
}));

const mockedAxios = axios as unknown as {
  get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};
const axiosGet = mockedAxios.get;

const createConnection = (): DvelopConnectionItem =>
  ({
    handle: 1,
    baseUrl: 'https://tenant.d-velop.cloud/',
    repository: {
      handle: 2,
      dvelopId: 'repository',
      title: 'Repository',
    },
    apiKey: 'secret',
  }) as DvelopConnectionItem;

const createEntityManager = (connection: DvelopConnectionItem) => {
  const em = {
    findOne: jest.fn(async (...args: unknown[]) =>
      args[0] === DvelopConnectionItem ? connection : null,
    ),
    create: jest.fn((_entity: unknown, values: unknown) => values),
    persist: jest.fn(),
    assign: jest.fn(),
    flush: jest.fn(async () => undefined),
  };

  return em as unknown as EntityManager & typeof em;
};

describe('DvelopConfigurationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('imports d.velop Cloud object definitions and property fields from objdef', async () => {
    const connection = createConnection();
    const em = createEntityManager(connection);
    const service = new DvelopConfigurationService(em);

    axiosGet.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: {
        objectDefinitions: [
          {
            id: 'invoice',
            displayName: 'Invoice',
            objectType: 0,
            propertyFields: [
              {
                id: 'property_document_number',
                displayName: 'Document number',
                type: 'String',
              },
            ],
          },
        ],
        count: 1,
      },
    });

    await expect(
      service.syncConfiguration(1, {
        objectDefinitions: true,
        properties: true,
      }),
    ).resolves.toEqual({
      repositories: { total: 0, created: 0, updated: 0, skipped: 0 },
      objectDefinitions: { total: 1, created: 1, updated: 0, skipped: 0 },
      properties: { total: 1, created: 1, updated: 0, skipped: 0 },
    });

    expect(axiosGet).toHaveBeenCalledWith(
      'https://tenant.d-velop.cloud/dms/r/repository/objdef',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/hal+json',
          Authorization: 'Bearer secret',
        }),
      }),
    );
    expect(em.findOne).toHaveBeenCalledWith(DvelopObjectDefinitionItem, {
      connection,
      dvelopId: 'invoice',
    });
    expect(em.findOne).toHaveBeenCalledWith(DvelopPropertyItem, {
      connection,
      dvelopId: 'property_document_number',
    });
    expect(em.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        dvelopId: 'invoice',
        title: 'Invoice',
      }),
    );
    expect(em.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        dvelopId: 'property_document_number',
        title: 'Document number',
        dataType: 'String',
      }),
    );
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('loads category properties when objdef has no property fields', async () => {
    const connection = createConnection();
    const em = createEntityManager(connection);
    const service = new DvelopConfigurationService(em);

    axiosGet
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: {
          objectDefinitions: [
            {
              id: 'invoice',
              displayName: 'Invoice',
              objectType: 0,
            },
          ],
          count: 1,
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: {
          _embedded: {
            properties: {
              _embedded: {
                properties: [
                  {
                    id: 'property_amount',
                    name: { de: 'Betrag', en: 'Amount' },
                    type: 'Money',
                  },
                ],
              },
            },
          },
        },
      });

    await expect(
      service.syncConfiguration(1, { properties: true }),
    ).resolves.toEqual({
      repositories: { total: 0, created: 0, updated: 0, skipped: 0 },
      objectDefinitions: { total: 0, created: 0, updated: 0, skipped: 0 },
      properties: { total: 1, created: 1, updated: 0, skipped: 0 },
    });

    expect(axiosGet).toHaveBeenNthCalledWith(
      2,
      'https://tenant.d-velop.cloud/dmsconfig/r/repository/objectmanagement/categories/invoice',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/hal+json',
          Authorization: 'Bearer secret',
        }),
      }),
    );
    expect(em.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        dvelopId: 'property_amount',
        title: 'Betrag',
        dataType: 'Money',
      }),
    );
  });

  it('retries d.velop Cloud requests with the next Accept header after 406', async () => {
    const connection = createConnection();
    const em = createEntityManager(connection);
    const service = new DvelopConfigurationService(em);

    axiosGet
      .mockResolvedValueOnce({
        status: 406,
        statusText: 'Not Acceptable',
        data: null,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: {
          objectDefinitions: [
            {
              id: 'invoice',
              displayName: 'Invoice',
              objectType: 0,
            },
          ],
        },
      });

    await expect(
      service.syncConfiguration(1, { objectDefinitions: true }),
    ).resolves.toEqual({
      repositories: { total: 0, created: 0, updated: 0, skipped: 0 },
      objectDefinitions: { total: 1, created: 1, updated: 0, skipped: 0 },
      properties: { total: 0, created: 0, updated: 0, skipped: 0 },
    });

    const expectedUrl = 'https://tenant.d-velop.cloud/dms/r/repository/objdef';

    expect(axiosGet).toHaveBeenNthCalledWith(
      1,
      expectedUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/hal+json',
          Authorization: 'Bearer secret',
        }),
      }),
    );
    expect(axiosGet).toHaveBeenNthCalledWith(
      2,
      expectedUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer secret',
        }),
      }),
    );
  });

  it('imports repositories from the d.velop Cloud repository endpoint', async () => {
    const connection = createConnection();
    connection.repository = undefined;
    const em = createEntityManager(connection);
    const service = new DvelopConfigurationService(em);

    axiosGet.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: {
        repositories: [
          {
            id: 'repository',
            displayName: 'Repository',
            version: '8',
            isDefault: true,
          },
        ],
      },
    });

    await expect(
      service.syncConfiguration(1, { repositories: true }),
    ).resolves.toEqual({
      repositories: { total: 1, created: 1, updated: 0, skipped: 0 },
      objectDefinitions: { total: 0, created: 0, updated: 0, skipped: 0 },
      properties: { total: 0, created: 0, updated: 0, skipped: 0 },
    });

    expect(axiosGet).toHaveBeenCalledWith(
      'https://tenant.d-velop.cloud/dms/r',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/hal+json',
          Authorization: 'Bearer secret',
        }),
      }),
    );
    expect(em.findOne).toHaveBeenCalledWith(DvelopRepositoryItem, {
      connection,
      dvelopId: 'repository',
    });
    expect(em.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        dvelopId: 'repository',
        title: 'Repository',
        version: '8',
        isDefault: true,
      }),
    );
    expect(connection.repository).toEqual(
      expect.objectContaining({
        dvelopId: 'repository',
      }),
    );
  });
});
