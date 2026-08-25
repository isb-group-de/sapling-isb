import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'

let resizeCallback: ResizeObserverCallback | null = null

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }

  observe() {}
  disconnect() {}
  unobserve() {}
}

class MutationObserverMock {
  observe() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

function setElementWidth(element: Element, width: number, scrollWidth = width) {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scrollWidth })
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 36,
    x: 0,
    y: 0,
    top: 0,
    right: width,
    bottom: 36,
    left: 0,
    toJSON: () => ({}),
  })
}

describe('SaplingActionBar', () => {
  beforeEach(() => {
    resizeCallback = null
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('MutationObserver', MutationObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses icon-only presentation when expanded action labels do not fit', async () => {
    const wrapper = mount(SaplingActionBar, {
      slots: {
        leading: '<button>Keep editing</button>',
        trailing: '<button>Discard changes</button><button>Save and close</button>',
      },
      global: {
        stubs: {
          'v-card-actions': { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()

    const content = wrapper.get('.sapling-action-bar__content').element
    const groups = wrapper.findAll('.sapling-action-bar__group')
    const buttons = wrapper.findAll('button')
    const spacer = wrapper.get('.sapling-action-bar__spacer').element
    Object.defineProperty(content, 'clientWidth', { configurable: true, value: 320 })
    setElementWidth(buttons[0].element, 110)
    setElementWidth(buttons[1].element, 150)
    setElementWidth(buttons[2].element, 140)
    setElementWidth(spacer, 600)
    groups.forEach((group) => setElementWidth(group.element, 0))

    resizeCallback?.([], {} as ResizeObserver)
    await flushPromises()

    expect(wrapper.classes()).toContain('sapling-action-bar--compact')

    Object.defineProperty(content, 'clientWidth', { configurable: true, value: 500 })
    resizeCallback?.([], {} as ResizeObserver)
    await flushPromises()

    expect(wrapper.classes()).not.toContain('sapling-action-bar--compact')
  })
})
