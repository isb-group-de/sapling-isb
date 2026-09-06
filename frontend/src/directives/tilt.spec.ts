import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { vTilt } from './tilt'

function mountTilt() {
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => frames.delete(id))
  const wrapper = mount({
    template: '<div v-tilt="{ max: 3, scale: 1 }" />',
    directives: { tilt: vTilt },
  })
  const element = wrapper.element as HTMLElement
  const bounds = vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 200,
    height: 200,
  } as DOMRect)
  const move = (x: number, y: number) =>
    element.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }))
  const paint = () => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  }
  const transform = () => element.style.getPropertyValue('--sapling-tilt-transform')
  return { wrapper, element, bounds, move, paint, transform }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete document.documentElement.dataset.saplingTilt
})

describe('vTilt pointer movement', () => {
  it('keeps the same tilt for the same pointer position while the card animates', () => {
    const { wrapper, bounds, move, paint, transform } = mountTilt()
    try {
      move(150, 50)
      paint()
      const initial = transform()
      expect(initial).toContain('rotateX(1.5deg)')
      expect(initial).toContain('rotateY(1.5deg)')
      bounds.mockReturnValue({ left: -10, top: -10, width: 220, height: 220 } as DOMRect)
      move(150, 50)
      paint()
      expect(transform()).toBe(initial)
      move(400, -200)
      paint()
      expect(transform()).toContain('rotateX(3deg)')
      expect(transform()).toContain('rotateY(3deg)')
    } finally {
      wrapper.unmount()
    }
  })

  it('cancels queued movement when disabled and resets after scrolling', () => {
    const { wrapper, move, paint, transform } = mountTilt()
    try {
      move(150, 50)
      document.documentElement.dataset.saplingTilt = 'off'
      window.dispatchEvent(new Event('sapling:appearance-change'))
      paint()
      expect(transform()).toBe('')
      document.documentElement.dataset.saplingTilt = 'on'
      move(150, 50)
      paint()
      expect(transform()).not.toBe('')
      window.dispatchEvent(new Event('scroll'))
      expect(transform()).toBe('')
    } finally {
      wrapper.unmount()
    }
  })
})
