import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useSongbirdDock } from './useSongbirdDock'
vi.mock('./useSaplingAiChat', async () => {
  const { ref } = await import('vue')
  return { useSaplingAiChat: () => ({ isOpen: ref(true), hasSaplingAiChatAccess: ref(true) }) }
})
vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({ person: { handle: 42 } }),
}))
describe('Songbird docking', () => {
  beforeEach(() => localStorage.clear())
  it('reserves 720px for work and switches to full-area mode on narrow screens', () => {
    let dock!: ReturnType<typeof useSongbirdDock>
    const wrapper = mount(
      defineComponent({
        setup() {
          dock = useSongbirdDock()
          return () => h('div')
        },
      }),
    )
    dock.expanded.value = false
    dock.setWidth(420)
    Object.defineProperty(window, 'innerWidth', { value: 1140, configurable: true })
    window.dispatchEvent(new Event('resize'))
    expect(dock.docked.value).toBe(true)
    Object.defineProperty(window, 'innerWidth', { value: 1139, configurable: true })
    window.dispatchEvent(new Event('resize'))
    expect(dock.fullscreen.value).toBe(true)
    dock.setWidth(1000)
    expect(dock.width.value).toBe(640)
    dock.setWidth(100)
    expect(dock.width.value).toBe(360)
    expect(localStorage.getItem('songbird-panel-width:42')).toBe('360')
    dock.expanded.value = true
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    window.dispatchEvent(new Event('resize'))
    expect(dock.showSessionSidebar.value).toBe(true)
    dock.expanded.value = false
    expect(dock.showSessionSidebar.value).toBe(false)
    dock.expanded.value = true
    Object.defineProperty(window, 'innerWidth', { value: 1199, configurable: true })
    window.dispatchEvent(new Event('resize'))
    expect(dock.showSessionSidebar.value).toBe(false)
    dock.expanded.value = false
    wrapper.unmount()
  })
})
