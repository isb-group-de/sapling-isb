import type { EntityManager } from '@mikro-orm/core';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  it('normalizes PostgreSQL diagnostics for the system monitor', async () => {
    const execute = jest.fn().mockResolvedValue([
      {
        name: 'sapling',
        version: '17.4',
        schema: 'public',
        size: '157286400',
        activeConnections: '8',
        maxConnections: '100',
        startedAt: new Date('2026-08-25T05:31:00.000Z'),
        tableCount: '2',
        largestTables: [
          { schema: 'public', name: 'document_item', size: 12582912 },
          { schema: 'public', name: 'change_log_item', size: 6291456 },
        ],
      },
    ]);
    const em = {
      getConnection: () => ({ execute }),
    } as unknown as EntityManager;

    await expect(new DatabaseService(em).getDatabase()).resolves.toEqual({
      engine: 'PostgreSQL',
      name: 'sapling',
      version: '17.4',
      schema: 'public',
      size: 157286400,
      activeConnections: 8,
      maxConnections: 100,
      startedAt: '2026-08-25T05:31:00.000Z',
      tableCount: 2,
      largestTables: [
        {
          schema: 'public',
          name: 'document_item',
          entityHandle: 'document',
          size: 12582912,
        },
        {
          schema: 'public',
          name: 'change_log_item',
          entityHandle: 'changeLog',
          size: 6291456,
        },
      ],
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('returns every application table ordered by the database query', async () => {
    const execute = jest.fn().mockResolvedValue([
      { schema: 'public', name: 'document_item', size: '12582912' },
      { schema: 'public', name: 'change_log_item', size: '6291456' },
    ]);
    const em = {
      getConnection: () => ({ execute }),
    } as unknown as EntityManager;

    await expect(new DatabaseService(em).getDatabaseTables()).resolves.toEqual([
      {
        schema: 'public',
        name: 'document_item',
        entityHandle: 'document',
        size: 12582912,
      },
      {
        schema: 'public',
        name: 'change_log_item',
        entityHandle: 'changeLog',
        size: 6291456,
      },
    ]);
  });

  it('keeps unknown physical tables available without inventing an entity handle', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue([
        { schema: 'public', name: 'internal_join_table', size: '1024' },
      ]);
    const em = {
      getConnection: () => ({ execute }),
    } as unknown as EntityManager;

    await expect(new DatabaseService(em).getDatabaseTables()).resolves.toEqual([
      {
        schema: 'public',
        name: 'internal_join_table',
        entityHandle: undefined,
        size: 1024,
      },
    ]);
  });
});
