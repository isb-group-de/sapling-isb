import { describe, expect, it, jest } from '@jest/globals';
import { GenericChangeLogService } from './generic-change-log.service';

describe('GenericChangeLogService', () => {
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
