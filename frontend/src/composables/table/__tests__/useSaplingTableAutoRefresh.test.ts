import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaplingTableAutoRefresh } from '../useSaplingTableAutoRefresh'

function mountSubject(refresh: () => void) {
  return mount(
    defineComponent({
      setup() {
        const isPaused = ref(false)
        return {
          isPaused,
          ...useSaplingTableAutoRefresh(refresh, () => isPaused.value),
        }
      },
      template: '<div />',
    }),
  )
}

describe('useSaplingTableAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes at the selected interval and stops when automatic refresh is disabled', async () => {
    const refresh = vi.fn()
    const wrapper = mountSubject(refresh)

    wrapper.vm.setAutoRefreshInterval(1)
    expect(wrapper.vm.secondsUntilRefresh).toBe(60)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(wrapper.vm.secondsUntilRefresh).toBe(59)

    await vi.advanceTimersByTimeAsync(59_000)

    expect(refresh).toHaveBeenCalledOnce()
    expect(wrapper.vm.secondsUntilRefresh).toBe(60)

    wrapper.vm.setAutoRefreshInterval(null)
    expect(wrapper.vm.secondsUntilRefresh).toBeNull()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(refresh).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('pauses an active interval and resumes it from a full interval after editing', async () => {
    const refresh = vi.fn()
    const wrapper = mountSubject(refresh)

    wrapper.vm.setAutoRefreshInterval(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(wrapper.vm.secondsUntilRefresh).toBe(30)

    wrapper.vm.isPaused = true
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.secondsUntilRefresh).toBeNull()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(refresh).not.toHaveBeenCalled()

    wrapper.vm.isPaused = false
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.secondsUntilRefresh).toBe(60)
    await vi.advanceTimersByTimeAsync(59_999)

    expect(refresh).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(refresh).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('clears the interval when the table is unmounted', async () => {
    const refresh = vi.fn()
    const wrapper = mountSubject(refresh)

    wrapper.vm.setAutoRefreshInterval(1)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(refresh).not.toHaveBeenCalled()
  })
})
