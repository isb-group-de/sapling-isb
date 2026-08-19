import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ghostEasterEggConfig } from '@/config/easter-egg/ghostEasterEggConfig'
import { useGhostEasterEgg } from '@/composables/easter-egg/useGhostEasterEgg'

describe('useGhostEasterEgg', () => {
  const wrappers: VueWrapper[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
  })

  function mountGhost(options?: Parameters<typeof useGhostEasterEgg>[0]) {
    let ghost: ReturnType<typeof useGhostEasterEgg> | undefined
    const wrapper = mount(
      defineComponent({
        setup() {
          ghost = useGhostEasterEgg(options)
          return () => h('div')
        },
      }),
    )
    wrappers.push(wrapper)
    if (!ghost) {
      throw new Error('Ghost composable was not initialized')
    }
    return { ghost, wrapper }
  }

  it('keeps shared close and random-message timers alive when one consumer unmounts', () => {
    const automaticMessageDelayMs = ghostEasterEggConfig.messageVisibleMs + 1000
    const { ghost } = mountGhost({
      persistState: false,
      randomMessageIntervalMs: [automaticMessageDelayMs, automaticMessageDelayMs],
    })
    const transientConsumer = mountGhost().wrapper

    ghost.activate()
    transientConsumer.unmount()

    vi.advanceTimersByTime(420)
    expect(ghost.status.value).toBe('active')
    expect(ghost.isMessageVisible.value).toBe(true)

    vi.advanceTimersByTime(ghostEasterEggConfig.messageVisibleMs - 421)
    expect(ghost.isMessageVisible.value).toBe(true)

    vi.advanceTimersByTime(1)
    expect(ghost.isMessageVisible.value).toBe(false)

    vi.advanceTimersByTime(automaticMessageDelayMs - ghostEasterEggConfig.messageVisibleMs + 420)
    expect(ghost.isMessageVisible.value).toBe(true)
    expect(ghost.message.value.length).toBeGreaterThan(0)
  })
})
