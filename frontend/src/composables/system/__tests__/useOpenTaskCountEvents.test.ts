import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
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
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  static instances: FakeEventSource[] = []
  readyState = FakeEventSource.CONNECTING
  close = vi.fn()

  constructor(
    readonly url: string,
    readonly options: EventSourceInit,
  ) {
    super()
    FakeEventSource.instances.push(this)
  }

  snapshot() {
    this.readyState = FakeEventSource.OPEN
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
  vi.useFakeTimers()
  vi.resetModules()
  pushMessage.mockClear()
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
  streamModule = await import('../useOpenTaskCountEvents')
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
  vi.useRealTimers()
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

  it('recovers quietly when a backend restart interrupts the connection briefly', () => {
    const { wrapper } = mountListener()
    const source = FakeEventSource.instances[0]!
    source.snapshot()
    source.readyState = FakeEventSource.CONNECTING
    source.dispatchEvent(new Event('error'))
    vi.advanceTimersByTime(5000)
    source.snapshot()
    vi.advanceTimersByTime(15000)
    expect(wrapper.vm.streamError).toBeNull()
    expect(pushMessage).not.toHaveBeenCalled()
    expect(source.close).not.toHaveBeenCalled()
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('reports a persistent outage once without extending the deadline on retries or open', () => {
    const { wrapper } = mountListener()
    const source = FakeEventSource.instances[0]!
    source.dispatchEvent(new Event('error'))
    expect(wrapper.vm.streamError).toBeNull()
    vi.advanceTimersByTime(10000)
    source.dispatchEvent(new Event('error'))
    source.dispatchEvent(new Event('open'))
    vi.advanceTimersByTime(5000)
    expect(wrapper.vm.streamError).toBe('exception.connectionException')
    expect(pushMessage).toHaveBeenCalledExactlyOnceWith(
      'error',
      'exception.connectionException',
      '',
      'inbox',
      expect.objectContaining({ transport: 'EventSource', elapsedMs: 15000, failedAttempts: 2 }),
    )
    source.dispatchEvent(new Event('error'))
    vi.advanceTimersByTime(20000)
    expect(pushMessage).toHaveBeenCalledTimes(1)
    source.snapshot()
    expect(wrapper.vm.streamError).toBeNull()
  })

  it('reports a terminal connection failure immediately', () => {
    const { wrapper } = mountListener()
    const source = FakeEventSource.instances[0]!
    source.readyState = FakeEventSource.CLOSED
    source.dispatchEvent(new Event('error'))
    expect(wrapper.vm.streamError).toBe('exception.connectionException')
    expect(pushMessage).toHaveBeenCalledOnce()
  })

  it('reports server errors immediately during transport recovery', () => {
    const { wrapper } = mountListener()
    const source = FakeEventSource.instances[0]!
    source.dispatchEvent(new Event('error'))
    source.serverError()
    expect(wrapper.vm.streamError).toBe('exception.serverException')
    vi.advanceTimersByTime(20000)
    expect(pushMessage).toHaveBeenCalledOnce()
  })

  it('cancels a pending outage report when the last listener unmounts', () => {
    const { wrapper } = mountListener()
    FakeEventSource.instances[0]!.dispatchEvent(new Event('error'))
    wrapper.unmount()
    wrappers.length = 0
    vi.advanceTimersByTime(20000)
    expect(pushMessage).not.toHaveBeenCalled()
  })

  it('does not treat a local snapshot update as a recovered connection', () => {
    const { wrapper } = mountListener()
    FakeEventSource.instances[0]!.dispatchEvent(new Event('error'))
    streamModule.updateOpenTaskSnapshot(snapshot)
    vi.advanceTimersByTime(15000)
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

  it.each(['server', 'transport'])(
    'ends inbox loading on a %s error and restores normal state after reconnect',
    async (kind) => {
      const { useSaplingInbox } = await import('@/composables/account/useSaplingInbox')
      const wrapper = mount(
        defineComponent({
          setup: () => useSaplingInbox(vi.fn()),
          template: '<div />',
        }),
        { global: { plugins: [createPinia()] } },
      )
      wrappers.push(wrapper)
      expect(wrapper.vm.isLoading).toBe(true)
      const source = FakeEventSource.instances[0]!
      if (kind === 'server') {
        source.serverError()
      } else {
        source.dispatchEvent(new Event('error'))
      }
      await nextTick()
      expect(wrapper.vm.isLoading).toBe(kind === 'transport')
      if (kind === 'transport') vi.advanceTimersByTime(15000)
      await nextTick()
      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.streamError).toBe(
        kind === 'server' ? 'exception.serverException' : 'exception.connectionException',
      )
      source.snapshot()
      await nextTick()
      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.streamError).toBeNull()
    },
  )
})
