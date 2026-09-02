import type { jest } from '@jest/globals';

export const asMock = (value: unknown): jest.Mock => value as jest.Mock;
export const history = [
  { role: 'user', status: 'persisted', content: 'Hallo', contextPayload: null },
] as never;
export const asNever = (value: unknown): never => value as never;

export function streamOf(...events: unknown[]) {
  let index = 0;
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next: () =>
      Promise.resolve(
        index < events.length
          ? { done: false as const, value: events[index++] }
          : { done: true as const, value: undefined },
      ),
  };
}
