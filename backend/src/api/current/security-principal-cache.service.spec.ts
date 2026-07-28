import { SecurityPrincipalCacheService } from './security-principal-cache.service';

describe('SecurityPrincipalCacheService', () => {
  it('coalesces concurrent loads and serves the cached principal', async () => {
    let resolveLoad!: (value: object) => void;
    const findOne = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const service = new SecurityPrincipalCacheService({
      fork: () => ({ findOne }),
    } as never);

    const first = service.get(7);
    const second = service.get(7);
    resolveLoad({ handle: 7, loginPassword: 'hidden', roles: [] });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { handle: 7, roles: [] },
      { handle: 7, roles: [] },
    ]);
    await expect(service.get(7)).resolves.toEqual({
      handle: 7,
      roles: [],
    });
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('reloads a principal after targeted invalidation', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce({ handle: 7, lastName: 'Before' })
      .mockResolvedValueOnce({ handle: 7, lastName: 'After' });
    const service = new SecurityPrincipalCacheService({
      fork: () => ({ findOne }),
    } as never);

    await expect(service.get(7)).resolves.toEqual({
      handle: 7,
      lastName: 'Before',
    });
    service.invalidate(7);
    await expect(service.get(7)).resolves.toEqual({
      handle: 7,
      lastName: 'After',
    });
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});
