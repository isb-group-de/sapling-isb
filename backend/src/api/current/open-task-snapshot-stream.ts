import { Observable, type OperatorFunction } from 'rxjs';

/** One active snapshot plus one trailing refresh, instead of a queue of stale reads. */
export function latestSnapshotOnChange<T>(
  load: () => Promise<T>,
): OperatorFunction<void, T> {
  return (source) =>
    new Observable<T>((subscriber) => {
      let running = false;
      let dirty = false;
      let completed = false;
      const refresh = async () => {
        running = true;
        try {
          while (dirty && !subscriber.closed) {
            dirty = false;
            const snapshot = await load();
            if (!subscriber.closed) subscriber.next(snapshot);
          }
          if (completed && !subscriber.closed) subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        } finally {
          running = false;
        }
      };
      const subscription = source.subscribe({
        next: () => {
          dirty = true;
          if (!running) void refresh();
        },
        error: (error: unknown) => subscriber.error(error),
        complete: () => {
          completed = true;
          if (!running) subscriber.complete();
        },
      });
      return () => subscription.unsubscribe();
    });
}
