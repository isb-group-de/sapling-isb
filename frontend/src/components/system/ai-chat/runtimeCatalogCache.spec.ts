import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRuntimeCatalogCache, loadRuntimeCatalogCache } from './runtimeCatalogCache'

describe('runtimeCatalogCache', () => {
  beforeEach(() => {
    clearRuntimeCatalogCache()
    vi.useRealTimers()
  })

  it('deduplicates concurrent and remounted consumers within the TTL', async () => {
    const loader = vi.fn().mockResolvedValue(['model'])
    const first = loadRuntimeCatalogCache('person:1', 'models', loader)
    const second = loadRuntimeCatalogCache('person:1', 'models', loader)

    await expect(Promise.all([first, second])).resolves.toEqual([['model'], ['model']])
    await expect(loadRuntimeCatalogCache('person:1', 'models', loader)).resolves.toEqual(['model'])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('separates users and allows a forced refresh', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce(['first'])
      .mockResolvedValueOnce(['second'])
      .mockResolvedValueOnce(['third'])
    await loadRuntimeCatalogCache('person:1', 'models', loader)
    await expect(loadRuntimeCatalogCache('person:1', 'models', loader, true)).resolves.toEqual([
      'second',
    ])
    await loadRuntimeCatalogCache('person:2', 'models', loader)
    expect(loader).toHaveBeenCalledTimes(3)
  })

  it('reloads expired entries', async () => {
    vi.useFakeTimers()
    const loader = vi.fn().mockResolvedValue([])
    await loadRuntimeCatalogCache('person:1', 'agents', loader)
    vi.advanceTimersByTime(5 * 60_000 + 1)
    await loadRuntimeCatalogCache('person:1', 'agents', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
