import { GithubReadCache } from './github-read-cache';

describe('GithubReadCache', () => {
  afterEach(() => jest.useRealTimers());
  it('coalesces parallel reads, isolates callers, and expires after 30 seconds', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-06T12:00:00Z'));
    const cache = new GithubReadCache();
    const load = jest.fn(async () => ({ labels: ['bug'] }));
    const [first, second] = await Promise.all([
      cache.get('issues:open', load),
      cache.get('issues:open', load),
    ]);
    first.labels.push('local');
    expect(second.labels).toEqual(['bug']);
    expect(load).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(29999);
    await cache.get('issues:open', load);
    expect(load).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await cache.get('issues:open', load);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('does not cache errors or mix status keys', async () => {
    const cache = new GithubReadCache();
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue(['fresh']);
    await expect(cache.get('open', load)).rejects.toThrow('unavailable');
    await expect(cache.get('open', load)).resolves.toEqual(['fresh']);
    await cache.get('closed', load);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('does not let a read started before invalidation refill the cache', async () => {
    const cache = new GithubReadCache();
    let finish!: (value: string[]) => void;
    const old = cache.get(
      'open',
      () =>
        new Promise<string[]>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    cache.invalidate();
    const load = jest.fn(async () => ['new']);
    await cache.get('open', load);
    finish(['old']);
    await old;
    await expect(cache.get('open', load)).resolves.toEqual(['new']);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
