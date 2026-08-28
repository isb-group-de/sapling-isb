import { describe, expect, it, jest } from '@jest/globals';
import { ChangeLogItem } from '../../entity/ChangeLogItem';
import { GenericChangeLogService } from './generic-change-log.service';

describe('GenericChangeLogService', () => {
  it.each(['changeLog', 'changeLogDetail'])(
    'does not create recursive audit records for %s mutations',
    async (entityHandle) => {
      const em = {
        create: jest.fn(),
        flush: jest.fn(),
        fork: jest.fn(),
      };
      const service = new GenericChangeLogService(em as never, {} as never);

      await service.safeStoreChangeLog(
        'delete',
        { handle: entityHandle } as never,
        { handle: 1 } as never,
        { handle: 101, property: 'title' },
        null,
      );

      expect(em.fork).not.toHaveBeenCalled();
      expect(em.create).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
    },
  );

  it('continues to persist audit records for ordinary entities', async () => {
    const log = { details: { add: jest.fn() } };
    const logEm = {
      findOne: jest.fn(async () => ({ handle: 'delete' })),
      create: jest.fn((entityClass: unknown) =>
        entityClass === ChangeLogItem ? log : {},
      ),
      flush: jest.fn(async () => undefined),
    };
    const em = {
      create: jest.fn(),
      flush: jest.fn(),
      fork: jest.fn(() => logEm),
    };
    const service = new GenericChangeLogService(em as never, {} as never);

    await service.safeStoreChangeLog(
      'delete',
      { handle: 'ticket' } as never,
      { handle: 1 } as never,
      { handle: 101, title: 'Example' },
      null,
    );

    expect(logEm.create).toHaveBeenCalledWith(
      ChangeLogItem,
      expect.objectContaining({
        action: 'delete',
        entity: 'ticket',
        reference: '101',
      }),
    );
    expect(logEm.flush).toHaveBeenCalledTimes(1);
  });

  it('does not persist update logs without semantic detail changes', async () => {
    const em = {
      create: jest.fn(),
      flush: jest.fn(),
      fork: jest.fn(),
    };
    const service = new GenericChangeLogService(em as never, {} as never);

    await service.safeStoreChangeLog(
      'update',
      { handle: 'person' } as never,
      { handle: 1 } as never,
      {
        handle: 101,
        apiTokens: [],
        createdTickets: [],
        mobile: null,
      },
      {
        handle: 101,
        apiTokens: null,
        createdTickets: undefined,
        mobile: '',
      },
    );

    expect(em.fork).not.toHaveBeenCalled();
    expect(em.create).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });
});
