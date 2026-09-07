import { GenericService } from './generic.service';
import type { ScriptServerContext } from '../../script/core/script.interface';
import type { GenericPostCommitTask } from './generic-entity-mutation.service';

describe('GenericService atomic calendar effects', () => {
  function harness(failCommit = false) {
    const trace: string[] = [];
    const effect = jest.fn(async () => {
      trace.push('delivery');
    });
    const mutate = async (context: ScriptServerContext) => {
      trace.push('mutation');
      context.postCommitTasks!.push({ label: 'calendar', operation: effect });
      expect(effect).not.toHaveBeenCalled();
      return { handle: 293 };
    };
    const mutations = {
      create: jest.fn(async (...args: unknown[]) =>
        mutate(args[3] as ScriptServerContext),
      ),
      update: jest.fn(async (...args: unknown[]) =>
        mutate(args[5] as ScriptServerContext),
      ),
      delete: jest.fn(async (...args: unknown[]) =>
        mutate(args[3] as ScriptServerContext),
      ),
      schedulePostCommitTasks: jest.fn((tasks: GenericPostCommitTask[]) => {
        trace.push('scheduled');
        for (const task of tasks) void task.operation();
      }),
    };
    const relations = {
      createReference: jest.fn(async (...args: unknown[]) =>
        mutate(args[5] as ScriptServerContext),
      ),
      deleteReference: jest.fn(async (...args: unknown[]) =>
        mutate(args[5] as ScriptServerContext),
      ),
    };
    const service = Object.assign(Object.create(GenericService.prototype), {
      em: {
        transactional: async (operation: () => Promise<unknown>) => {
          const result = await operation();
          expect(effect).not.toHaveBeenCalled();
          if (failCommit) throw new Error('commit failed');
          trace.push('commit');
          return result;
        },
      },
      genericEntityMutationService: mutations,
      genericRelationMutationService: relations,
    }) as GenericService;
    return { service, mutations, effect, trace };
  }

  it.each([
    'create',
    'update',
    'delete',
    'createReference',
    'deleteReference',
  ] as const)(
    'releases %s calendar effects only after commit',
    async (method) => {
      const { service, trace, mutations } = harness();
      const user = { handle: 1 } as never;
      if (method === 'create') await service.create('event', {}, user);
      else if (method === 'update')
        await service.update('event', 293, { description: 'changed' }, user);
      else if (method === 'delete') await service.delete('event', 293, user);
      else await service[method]('event', 'participants', 293, 1, user);
      expect(trace).toEqual(['mutation', 'commit', 'scheduled', 'delivery']);
      if (method === 'update') {
        const args = mutations.update.mock.calls[0];
        expect(args[7]).toEqual({
          postCommitTasks: (args[5] as ScriptServerContext).postCommitTasks,
        });
      }
    },
  );

  it('discards delivery and background work when commit fails', async () => {
    const { service, mutations, effect } = harness(true);
    await expect(service.update('event', 293, {}, {} as never)).rejects.toThrow(
      'commit failed',
    );
    expect(effect).not.toHaveBeenCalled();
    expect(mutations.schedulePostCommitTasks).not.toHaveBeenCalled();
  });

  it('leaves scheduling to the enclosing transaction when supplied', async () => {
    const { service, mutations, effect } = harness();
    const postCommitTasks: GenericPostCommitTask[] = [];
    await service.update('event', 293, {}, {} as never, [], {
      postCommitTasks,
    });
    expect(postCommitTasks).toHaveLength(1);
    expect(effect).not.toHaveBeenCalled();
    expect(mutations.schedulePostCommitTasks).not.toHaveBeenCalled();
  });
});
