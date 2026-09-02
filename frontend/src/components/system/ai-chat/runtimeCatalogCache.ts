const RUNTIME_CATALOG_TTL_MS = 5 * 60_000

type CacheEntry<T> = {
  value?: T
  expiresAt: number
  promise?: Promise<T>
}

const catalogCache = new Map<string, CacheEntry<unknown>>()

export function loadRuntimeCatalogCache<T>(
  personKey: string,
  catalogKey: string,
  loader: () => Promise<T>,
  force = false,
): Promise<T> {
  const key = `${personKey || 'anonymous'}:${catalogKey}`
  const cached = catalogCache.get(key) as CacheEntry<T> | undefined
  if (!force && cached?.promise) return cached.promise
  if (!force && cached?.value !== undefined && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value)
  }

  const promise = loader()
    .then((value) => {
      catalogCache.set(key, {
        value,
        expiresAt: Date.now() + RUNTIME_CATALOG_TTL_MS,
      })
      return value
    })
    .catch((error) => {
      if (catalogCache.get(key)?.promise === promise) catalogCache.delete(key)
      throw error
    })
  catalogCache.set(key, { expiresAt: 0, promise })
  return promise
}

export function clearRuntimeCatalogCache(): void {
  catalogCache.clear()
}
