import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SaplingImageViewer from '../SaplingImageViewer.vue'

vi.mock('@/composables/generic/useTranslationLoader', () => ({ useTranslationLoader: vi.fn() }))

function mountViewer() {
  return mount(SaplingImageViewer, {
    props: { src: '/screenshot.png', alt: 'Screenshot', expandable: true },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        SaplingFileNoPreview: true,
        'v-slider': {
          props: ['modelValue', 'min', 'max', 'step', 'disabled'],
          emits: ['update:modelValue'],
          template:
            '<input type="range" :value="modelValue" :min="min" :max="max" :step="step" :disabled="disabled" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
        },
        'v-btn': { template: '<button><slot /></button>' },
      },
    },
  })
}

async function loadImage(wrapper: ReturnType<typeof mountViewer>) {
  Object.defineProperties(wrapper.get('img').element, {
    naturalWidth: { value: 1600 },
    naturalHeight: { value: 900 },
  })
  await wrapper.get('img').trigger('load')
}

async function pointer(
  element: Element,
  type: string,
  pointerId: number,
  clientX = 0,
  clientY = 0,
) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  element.dispatchEvent(event)
  await nextTick()
}

describe('SaplingImageViewer', () => {
  it('uses original dimensions at 100%, supports 50–200%, and resets on image changes', async () => {
    const wrapper = mountViewer()
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    await loadImage(wrapper)
    expect(wrapper.get('img').attributes('width')).toBe('1600')
    expect(wrapper.get('img').attributes('height')).toBe('900')
    await wrapper.get('input').setValue('200')
    expect(wrapper.get('img').attributes('width')).toBe('3200')
    await wrapper.get('input').setValue('50')
    expect(wrapper.get('img').attributes('width')).toBe('800')
    expect(wrapper.get('img').attributes('height')).toBe('450')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('img').attributes('width')).toBe('1600')
    await wrapper.get('input').setValue('200')
    await wrapper.setProps({ src: '/second.gif' })
    expect(wrapper.get('input').element.value).toBe('100')
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('pans overflow with pointer capture, ignores other pointers and stops on cancellation', async () => {
    const wrapper = mountViewer()
    await loadImage(wrapper)
    const frame = wrapper.get('.sapling-image-viewer__viewport')
    const element = frame.element as HTMLDivElement
    element.setPointerCapture = vi.fn()
    element.hasPointerCapture = vi.fn().mockReturnValue(true)
    element.releasePointerCapture = vi.fn()
    element.scrollLeft = 300
    element.scrollTop = 200
    await pointer(element, 'pointerdown', 1, 100, 100)
    await pointer(element, 'pointerdown', 2, 40, 60)
    await pointer(element, 'pointermove', 2, 40, 60)
    expect(element.scrollLeft).toBe(300)
    await pointer(element, 'pointermove', 1, 40, 60)
    expect(element.scrollLeft).toBe(360)
    expect(element.scrollTop).toBe(240)
    await pointer(element, 'pointercancel', 1)
    expect(element.releasePointerCapture).toHaveBeenCalledWith(1)
    await pointer(element, 'pointermove', 1)
    expect(element.scrollLeft).toBe(360)
    expect(frame.classes()).not.toContain('sapling-image-viewer__viewport--dragging')
    wrapper.unmount()
  })

  it('expands on double-click and exposes a decoding failure without a broken image', async () => {
    const wrapper = mountViewer()
    await loadImage(wrapper)
    await wrapper.get('img').trigger('dblclick')
    expect(wrapper.emitted('expand')).toHaveLength(1)
    await wrapper.setProps({ expandable: false })
    await wrapper.get('img').trigger('dblclick')
    expect(wrapper.emitted('expand')).toHaveLength(1)
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'SaplingFileNoPreview' }).exists()).toBe(true)
    wrapper.unmount()
  })
})
