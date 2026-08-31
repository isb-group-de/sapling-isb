import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingCellLink from '../SaplingCellLink.vue'

describe('SaplingCellLink', () => {
  it('uses the browser default link behavior', () => {
    const wrapper = mount(SaplingCellLink, {
      props: {
        value: 'example.com',
        href: 'https://example.com',
      },
      slots: {
        default: 'example.com',
      },
      global: {
        stubs: {
          VIcon: true,
        },
      },
    })

    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('https://example.com')
    expect(link.attributes('target')).toBeUndefined()
  })
})
