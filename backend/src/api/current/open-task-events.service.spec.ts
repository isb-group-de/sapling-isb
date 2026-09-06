import { OpenTaskEventsService } from './open-task-events.service';

describe('OpenTaskEventsService notification batching', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('emits the initial signal immediately and coalesces changes per user', () => {
    const service = new OpenTaskEventsService();
    const first = jest.fn();
    const second = jest.fn();
    const a = service.streamForUser(1).subscribe(first);
    const b = service.streamForUser(2).subscribe(second);
    expect(first).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 200; index++)
      service.notifyUsers([1, 1, undefined]);
    expect(first).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(25);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
    service.notifyUsers([1, 2]);
    a.unsubscribe();
    jest.advanceTimersByTime(25);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
    b.unsubscribe();
    service.onApplicationShutdown();
  });
  it('cancels pending work at shutdown', () => {
    const service = new OpenTaskEventsService();
    const listener = jest.fn();
    service.streamForUser(1).subscribe(listener);
    service.notifyUsers([1]);
    service.onApplicationShutdown();
    jest.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
