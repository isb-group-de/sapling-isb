import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingSurface from '../SaplingSurface.vue'

const mountSurface = (props: Record<string, unknown> = {}) =>
  mount(SaplingSurface, {
    props,
    global: {
      directives: {
        tilt: () => undefined,
      },
    },
  })

describe('SaplingSurface', () => {
  it('applies the glass class exactly once for the default variant', () => {
    const wrapper = mountSurface()
    const classes = (wrapper.attributes('class') ?? '').split(/\s+/)

    expect(classes.filter((className) => className === 'glass-panel')).toHaveLength(1)
    expect(classes).toContain('sapling-surface--glass')
  })

  it('does not keep the glass class for non-glass variants', () => {
    const wrapper = mountSurface({ variant: 'solid' })

    expect(wrapper.classes()).toContain('sapling-surface--solid')
    expect(wrapper.classes()).not.toContain('glass-panel')
  })

  it('honors glass=false for the glass variant', () => {
    const wrapper = mountSurface({ glass: false })

    expect(wrapper.classes()).toContain('sapling-surface--glass')
    expect(wrapper.classes()).not.toContain('glass-panel')
  })
})
