import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { pushMessage } = vi.hoisted(() => ({ pushMessage: vi.fn() }))
vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage }),
}))
vi.mock('@/composables/generic/useTranslationLoader', async () => {
  const { ref } = await import('vue')
  return { useTranslationLoader: () => ({ isLoading: ref(false) }) }
})
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api.current.service', () => ({ default: {} }))
vi.mock('@/services/api.calendar.service', () => ({ default: {} }))
vi.mock('@/services/api.generic.service', () => ({ default: {} }))

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = []
  close = vi.fn()

  constructor(
    readonly url: string,
    readonly options: EventSourceInit,
  ) {
    super()
    FakeEventSource.instances.push(this)
  }

  snapshot() {
    this.dispatchEvent(new MessageEvent('open-task-snapshot', { data: JSON.stringify(snapshot) }))
  }

  serverError() {
    this.dispatchEvent(new MessageEvent('error', { data: 'column s2.notify_actor does not exist' }))
  }
}

const snapshot = {
  count: 0,
  tickets: [],
  tasks: [],
  salesOpportunities: [],
  effortEstimates: [],
  internalCases: [],
  notifications: [],
}
let streamModule: typeof import('../useOpenTaskCountEvents')
const wrappers: Array<{ unmount(): void }> = []

function mountListener(listener = vi.fn()) {
  const wrapper = mount(
    defineComponent({
      setup: () => streamModule.useOpenTaskCountEvents(listener),
      template: '<div />',
    }),
  )
  wrappers.push(wrapper)
  return { wrapper, listener }
}

beforeEach(async () => {
  vi.resetModules()
  pushMessage.mockClear()
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
  streamModule = await import('../useOpenTaskCountEvents')
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('open-task streaming', () => {
  it('shares the credentialed connection and delivers empty snapshots to current and late listeners', () => {
    const first = mountListener()
    const source = FakeEventSource.instances[0]!
    source.snapshot()
    const second = mountListener()

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(source.options).toEqual({ withCredentials: true })
    expect(first.listener).toHaveBeenCalledWith(snapshot, { source: 'stream', newItems: [] })
    expect(second.listener).toHaveBeenCalledWith(snapshot, { source: 'local', newItems: [] })
  })

  it('reports server diagnostics once per outage and recovers only when a snapshot arrives', () => {
    const { wrapper } = mountListener()
    const source = FakeEventSource.instances[0]!
    source.serverError()
    source.dispatchEvent(new Event('error'))
    source.dispatchEvent(new Event('open'))
    source.serverError()

    expect(wrapper.vm.streamError).toBe('exception.serverException')
    expect(pushMessage).toHaveBeenCalledExactlyOnceWith(
      'error',
      'exception.serverException',
      '',
      'inbox',
      'column s2.notify_actor does not exist',
    )
    expect(source.close).not.toHaveBeenCalled()
    source.snapshot()
    expect(wrapper.vm.streamError).toBeNull()
    source.serverError()
    expect(pushMessage).toHaveBeenCalledTimes(2)
  })

  it('reports transport errors without requiring an SSE payload', () => {
    const { wrapper } = mountListener()
    FakeEventSource.instances[0]!.dispatchEvent(new Event('error'))
    expect(wrapper.vm.streamError).toBe('exception.connectionException')
  })

  it.each(['{', '{}', 'null'])(
    'reports malformed snapshots (%s) without replacing cached data',
    (data) => {
      const { wrapper, listener } = mountListener()
      const source = FakeEventSource.instances[0]!
      source.snapshot()
      listener.mockClear()
      source.dispatchEvent(new MessageEvent('open-task-snapshot', { data }))

      expect(wrapper.vm.streamError).toBe('exception.serverException')
      expect(listener).not.toHaveBeenCalled()
      expect(streamModule.getLatestOpenTaskSnapshot()).toEqual(snapshot)
    },
  )

  it('keeps the stream until the final listener unmounts and removes its error handler', () => {
    const first = mountListener()
    const second = mountListener()
    const source = FakeEventSource.instances[0]!
    first.wrapper.unmount()
    expect(source.close).not.toHaveBeenCalled()
    second.wrapper.unmount()
    expect(source.close).toHaveBeenCalledOnce()
    source.serverError()
    expect(pushMessage).not.toHaveBeenCalled()
    wrappers.length = 0
  })

  it('ends inbox loading on a stream error and restores normal state after reconnect', async () => {
    const { useSaplingInbox } = await import('@/composables/account/useSaplingInbox')
    const wrapper = mount(
      defineComponent({
        setup: () => useSaplingInbox(vi.fn()),
        template: '<div />',
      }),
    )
    wrappers.push(wrapper)
    expect(wrapper.vm.isLoading).toBe(true)
    const source = FakeEventSource.instances[0]!
    source.serverError()
    await nextTick()
    expect(wrapper.vm.isLoading).toBe(false)
    expect(wrapper.vm.streamError).toBe('exception.serverException')
    source.snapshot()
    await nextTick()
    expect(wrapper.vm.isLoading).toBe(false)
    expect(wrapper.vm.streamError).toBeNull()
  })
})
