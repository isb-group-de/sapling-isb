import { AsyncLocalStorage } from 'async_hooks';
import { performance } from 'perf_hooks';

export interface OperationTimings {
  phases: Record<string, number>;
  queryCount: number;
}
export const operationTiming = new AsyncLocalStorage<OperationTimings>();

/** Only fixed phase keys and numeric timings. Never accepts query text or parameters. */
export async function measureOperationPhase<T>(
  name:
    | 'permissions'
    | 'database'
    | 'recurrence'
    | 'mutation'
    | 'provider'
    | 'preparation'
    | 'projection'
    | 'postCommit'
    | 'postprocessing',
  work: () => Promise<T> | T,
): Promise<T> {
  const started = performance.now();
  try {
    return await work();
  } finally {
    const scope = operationTiming.getStore();
    if (scope)
      scope.phases[name] =
        (scope.phases[name] ?? 0) + performance.now() - started;
  }
}

export function countOperationQuery(): void {
  const scope = operationTiming.getStore();
  if (scope) scope.queryCount++;
}

export function measureRecurrence<T>(work: () => T): T {
  const started = performance.now();
  try {
    return work();
  } finally {
    const scope = operationTiming.getStore();
    if (scope)
      scope.phases.recurrence =
        (scope.phases.recurrence ?? 0) + performance.now() - started;
  }
}
