import { Subject } from 'rxjs';
import { latestSnapshotOnChange } from './open-task-snapshot-stream';

describe('latestSnapshotOnChange', () => {
  it('keeps one active read and one trailing refresh for a burst', async () => {
    const source = new Subject<void>();
    const resolvers: Array<(value: number) => void> = [];
    const load = jest.fn(
      () => new Promise<number>((resolve) => resolvers.push(resolve)),
    );
    const values: number[] = [];
    const subscription = source
      .pipe(latestSnapshotOnChange(load))
      .subscribe((value) => values.push(value));
    source.next();
    for (let index = 0; index < 100; index++) source.next();
    expect(load).toHaveBeenCalledTimes(1);
    resolvers[0](1);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    resolvers[1](2);
    await Promise.resolve();
    expect(values).toEqual([1, 2]);
    expect(load).toHaveBeenCalledTimes(2);
    subscription.unsubscribe();
  });
  it('stops a trailing refresh when the stream closes', async () => {
    const source = new Subject<void>();
    let finish!: (value: number) => void;
    const load = jest.fn(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
    const next = jest.fn();
    const subscription = source
      .pipe(latestSnapshotOnChange(load))
      .subscribe(next);
    source.next();
    source.next();
    subscription.unsubscribe();
    finish(1);
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('preserves failure semantics so the client can reconnect', async () => {
    const source = new Subject<void>();
    const error = jest.fn();
    const failure = new Error('database unavailable');
    source
      .pipe(latestSnapshotOnChange(() => Promise.reject(failure)))
      .subscribe({ error });
    source.next();
    await Promise.resolve();
    expect(error).toHaveBeenCalledWith(failure);
  });
});
