import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  clearRouteQueryParameter,
  isRecoverableRouteLoadError,
  pushAppRoute,
  setRouteQueryParameter,
} from '../routerNavigation'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/table/:entity', name: 'table', component: { template: '<div>table</div>' } },
      { path: '/target', name: 'target', component: { template: '<div>target</div>' } },
    ],
  })
}

describe('pushAppRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('skips navigation when the target already matches the current route', async () => {
    const router = createTestRouter()
    await router.push('/target')

    await expect(pushAppRoute(router, '/target')).resolves.toBe(false)
  })

  it('removes a dialog query parameter while preserving the current route and filters', async () => {
    const router = createTestRouter()
    await router.push({
      path: '/table/ticket',
      query: {
        filter: JSON.stringify({ handle: 52 }),
        open: '52',
        view: 'compact',
      },
      hash: '#details',
    })

    await expect(clearRouteQueryParameter(router, router.currentRoute.value, 'open')).resolves.toBe(
      true,
    )

    expect(router.currentRoute.value.path).toBe('/table/ticket')
    expect(router.currentRoute.value.query).toEqual({
      filter: JSON.stringify({ handle: 52 }),
      view: 'compact',
    })
    expect(router.currentRoute.value.hash).toBe('#details')
    await expect(clearRouteQueryParameter(router, router.currentRoute.value, 'open')).resolves.toBe(
      false,
    )
  })

  it('writes a shareable dialog handle while preserving the current route and filters', async () => {
    const router = createTestRouter()
    await router.push({
      path: '/table/ticket',
      query: {
        filter: JSON.stringify({ status: 'open' }),
        view: 'compact',
      },
      hash: '#details',
    })

    await expect(
      setRouteQueryParameter(router, router.currentRoute.value, 'open', 52),
    ).resolves.toBe(true)

    expect(router.currentRoute.value.path).toBe('/table/ticket')
    expect(router.currentRoute.value.query).toEqual({
      filter: JSON.stringify({ status: 'open' }),
      open: '52',
      view: 'compact',
    })
    expect(router.currentRoute.value.hash).toBe('#details')
    await expect(
      setRouteQueryParameter(router, router.currentRoute.value, 'open', 52),
    ).resolves.toBe(false)
  })

  it('deduplicates concurrent requests to the same target', async () => {
    const router = createTestRouter()
    await router.push('/')

    let resolveNavigation: (() => void) | undefined
    const pushSpy = vi.spyOn(router, 'push').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNavigation = () => {
            void resolve(undefined)
          }
        }) as ReturnType<typeof router.push>,
    )

    const firstNavigation = pushAppRoute(router, '/target')
    const secondNavigation = pushAppRoute(router, '/target')

    expect(pushSpy).toHaveBeenCalledTimes(1)

    resolveNavigation?.()
    await expect(firstNavigation).resolves.toBe(false)
    await expect(secondNavigation).resolves.toBe(false)
  })

  it('recognizes stale lazy route import errors as recoverable', () => {
    expect(
      isRecoverableRouteLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: http://localhost:5173/src/views/EventView.vue?t=1779714736445',
        ),
      ),
    ).toBe(true)
    expect(isRecoverableRouteLoadError('Outdated Optimize Dep')).toBe(true)
    expect(isRecoverableRouteLoadError(new Error('backend request failed'))).toBe(false)
  })
})
