import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.doUnmock('@/components/system/SaplingSystem.vue')
  vi.resetModules()
})

describe('system page navigation', () => {
  it('shows the skeleton inside Suspense before the monitoring module finishes loading', async () => {
    let finishLoading!: () => void
    const pendingModule = new Promise<void>((resolve) => {
      finishLoading = resolve
    })
    vi.doMock('@/components/system/SaplingSystem.vue', async () => {
      await pendingModule
      return { default: defineComponent({ template: '<div>Monitoring ready</div>' }) }
    })
    const { default: SystemView } = await import('./SystemView.vue')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/system', component: SystemView },
      ],
    })
    await router.push('/')
    const wrapper = mount(
      {
        template: `<RouterView v-slot="{ Component }">
          <Suspense><component :is="Component" /></Suspense>
        </RouterView>`,
      },
      {
        global: {
          plugins: [router],
          stubs: { VContainer: { template: '<main><slot /></main>' }, VSkeletonLoader: true },
        },
      },
    )

    try {
      await router.push('/system')
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/system')
      expect(wrapper.find('.sapling-system-skeleton').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('Home')
      expect(wrapper.text()).not.toContain('Monitoring ready')

      finishLoading()
      await vi.dynamicImportSettled()
      await flushPromises()

      expect(wrapper.find('.sapling-system-skeleton').exists()).toBe(false)
      expect(wrapper.text()).toContain('Monitoring ready')
    } finally {
      finishLoading()
      wrapper.unmount()
    }
  })
})
