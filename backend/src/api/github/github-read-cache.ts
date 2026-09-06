const CACHE_TTL_MS = 30_000;

/** Process-local cache for the fixed repository/release/issue-list read keys. */
export class GithubReadCache {
  private readonly entries = new Map<
    string,
    { promise: Promise<unknown>; expiresAt: number }
  >();

  async get<T>(key: string, load: () => Promise<T>): Promise<T> {
    let entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      const pending = {
        promise: Promise.resolve().then(load),
        expiresAt: Infinity,
      };
      this.entries.set(key, pending);
      void pending.promise.then(
        () => {
          pending.expiresAt = Date.now() + CACHE_TTL_MS;
        },
        () => {
          if (this.entries.get(key) === pending) this.entries.delete(key);
        },
      );
      entry = pending;
    }
    // A caller cannot mutate the value shared with another authenticated request.
    return structuredClone(await entry.promise) as T;
  }

  invalidate(): void {
    this.entries.clear();
  }
}
