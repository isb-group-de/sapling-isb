import { GenericEntityMutationOperations } from './generic-entity-mutation.operations';

class Harness extends GenericEntityMutationOperations {
  scheduled?: () => Promise<void>;
  protected override scheduleBackgroundTask(
    _label: string,
    operation: () => Promise<void>,
  ): void {
    this.scheduled = operation;
  }
}

describe('generic post-commit work', () => {
  it('limits parallel operations to four and continues after a failure', async () => {
    const subject = Object.create(Harness.prototype) as Harness;
    const releases: Array<() => void> = [];
    let active = 0;
    let maximum = 0;
    const finished: number[] = [];
    const tasks = Array.from({ length: 9 }, (_, index) => ({
      label: `task:${index}`,
      operation: async () => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active--;
        if (index === 1) throw new Error('isolated failure');
        finished.push(index);
      },
    }));
    subject.schedulePostCommitTasks(tasks);
    expect(active).toBe(0);
    const running = subject.scheduled!();
    expect(active).toBe(4);
    for (let index = 0; index < tasks.length; index++) {
      releases[index]();
      await Promise.resolve();
      await Promise.resolve();
    }
    await running;
    expect(maximum).toBe(4);
    expect(finished).toHaveLength(8);
    expect(finished).toContain(8);
  });
});
