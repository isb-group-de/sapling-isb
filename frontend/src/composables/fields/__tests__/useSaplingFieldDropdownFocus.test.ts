import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useSaplingFieldDropdownFocus } from '../useSaplingFieldDropdownFocus'

const TestHost = defineComponent({
  template: `
    <div ref="fieldRootRef" data-test="field-root">
      <input />
    </div>
    <div ref="menuSurfaceRef" data-test="menu-surface" />
  `,
  setup() {
    const menuOpen = ref(true)
    const focus = useSaplingFieldDropdownFocus(menuOpen)
    return { menuOpen, ...focus }
  },
})

describe('useSaplingFieldDropdownFocus', () => {
  it('keeps the parent selector open across nested teleported overlays', async () => {
    const wrapper = mount(TestHost, { attachTo: document.body })
    const menuSurface = wrapper.get('[data-test="menu-surface"]').element

    const filterActivator = document.createElement('button')
    filterActivator.setAttribute('aria-controls', 'filter-overlay')
    menuSurface.appendChild(filterActivator)

    const filterOverlay = document.createElement('div')
    filterOverlay.id = 'filter-overlay'
    filterOverlay.className = 'v-overlay'
    const filterInput = document.createElement('input')
    filterOverlay.appendChild(filterInput)
    document.body.appendChild(filterOverlay)

    const nestedActivator = document.createElement('button')
    nestedActivator.setAttribute('aria-controls', 'nested-overlay')
    filterOverlay.appendChild(nestedActivator)

    const nestedOverlay = document.createElement('div')
    nestedOverlay.id = 'nested-overlay'
    nestedOverlay.className = 'v-overlay'
    const nestedInput = document.createElement('input')
    nestedOverlay.appendChild(nestedInput)
    document.body.appendChild(nestedOverlay)

    const vm = wrapper.vm as unknown as {
      menuOpen: boolean
      closeMenuWhenFocusLeaves: (event: FocusEvent) => void
    }

    vm.closeMenuWhenFocusLeaves({ relatedTarget: filterInput } as unknown as FocusEvent)
    expect(vm.menuOpen).toBe(true)

    vm.closeMenuWhenFocusLeaves({ relatedTarget: nestedInput } as unknown as FocusEvent)
    expect(vm.menuOpen).toBe(true)

    const unrelatedInput = document.createElement('input')
    document.body.appendChild(unrelatedInput)
    vm.closeMenuWhenFocusLeaves({ relatedTarget: unrelatedInput } as unknown as FocusEvent)
    expect(vm.menuOpen).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(vm.menuOpen).toBe(false)

    wrapper.unmount()
    filterOverlay.remove()
    nestedOverlay.remove()
    unrelatedInput.remove()
  })

  it('ignores transient focus loss when an internal control is replaced', async () => {
    const wrapper = mount(TestHost)
    const vm = wrapper.vm as unknown as {
      menuOpen: boolean
      closeMenuWhenFocusLeaves: (event: FocusEvent) => void
    }

    vm.closeMenuWhenFocusLeaves({ relatedTarget: null } as unknown as FocusEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(vm.menuOpen).toBe(true)
    wrapper.unmount()
  })
})
