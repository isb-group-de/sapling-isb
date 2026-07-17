/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { GenericBulkMutationService } from './generic-bulk-mutation.service';
import type { GenericPostCommitTask } from './generic-entity-mutation.service';

describe('GenericBulkMutationService', () => {
  function createSubject(
    updateImplementation?: (...args: any[]) => Promise<object>,
  ) {
    const em = {
      transactional: jest.fn((callback: () => Promise<void>) => callback()),
    } as unknown as EntityManager;
    const mutationService = {
      update: jest.fn(
        updateImplementation ??
          ((...args: any[]) => {
            const lifecycle = args[7] as {
              postCommitTasks: GenericPostCommitTask[];
            };
            lifecycle.postCommitTasks.push({
              label: 'changeLog',
              operation: () => Promise.resolve(),
            });
            return Promise.resolve({ handle: String(args[1]) });
          }),
      ),
      schedulePostCommitTasks: jest.fn(),
    };
    const subject = new GenericBulkMutationService(
      em,
      mutationService as never,
    );

    return { subject, em, mutationService };
  }

  it('updates deterministically and schedules effects only after commit', async () => {
    const { subject, em, mutationService } = createSubject();
    const request = {
      targets: [
        { handle: '10', expectedUpdatedAt: '2026-07-17T08:00:00.000Z' },
        { handle: '2' },
      ],
      changes: { isActive: false },
    };

    await expect(
      subject.updateMany('company', request, { handle: 1 } as never, {}),
    ).resolves.toEqual({ updatedCount: 2, handles: ['10', '2'] });

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(mutationService.update).toHaveBeenCalledTimes(2);
    expect(
      mutationService.update.mock.calls.map((call) => String(call[1])),
    ).toEqual(['2', '10']);
    expect(mutationService.schedulePostCommitTasks).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ label: 'changeLog' })]),
    );
  });

  it('discards deferred effects and enriches the failing response', async () => {
    const update = jest
      .fn<Promise<object>, any[]>()
      .mockResolvedValueOnce({ handle: '1' })
      .mockRejectedValueOnce(
        new ConflictException({
          message: 'global.updateConflict',
          details: { reason: 'staleRecord' },
        }),
      );
    const { subject, mutationService } = createSubject(update);

    try {
      await subject.updateMany(
        'company',
        {
          targets: [{ handle: '1' }, { handle: '2' }],
          changes: { name: 'Acme' },
        },
        { handle: 1 } as never,
        {},
      );
      throw new Error('Expected bulk update to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect((error as HttpException).getResponse()).toMatchObject({
        details: {
          reason: 'staleRecord',
          failedHandle: '2',
          updatedCount: 0,
        },
      });
    }

    expect(mutationService.schedulePostCommitTasks).not.toHaveBeenCalled();
  });

  it('rejects duplicate targets before opening a transaction', async () => {
    const { subject, em } = createSubject();

    await expect(
      subject.updateMany(
        'company',
        {
          targets: [{ handle: '1' }, { handle: '1' }],
          changes: { isActive: true },
        },
        { handle: 1 } as never,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.transactional).not.toHaveBeenCalled();
  });

  it('rejects empty changes before opening a transaction', async () => {
    const { subject, em } = createSubject();

    await expect(
      subject.updateMany(
        'company',
        { targets: [{ handle: '1' }], changes: {} },
        { handle: 1 } as never,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.transactional).not.toHaveBeenCalled();
  });
});
