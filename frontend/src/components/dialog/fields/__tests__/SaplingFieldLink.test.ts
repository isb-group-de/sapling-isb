import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingFieldLink from '../SaplingFieldLink.vue'

function mountField(modelValue: string) {
  return mount(SaplingFieldLink, {
    props: {
      label: 'Website',
      modelValue,
      placeholder: 'https://example.com',
    },
    global: {
      stubs: {
        SaplingTextField: {
          template: '<div><slot name="append-inner" /></div>',
        },
        VIcon: {
          props: ['icon'],
          template: '<span :data-icon="icon" />',
        },
      },
    },
  })
}

describe('SaplingFieldLink', () => {
  it('renders a native link without forcing a target', () => {
    const wrapper = mountField('example.com')
    const link = wrapper.get('a')

    expect(link.attributes('href')).toBe('https://example.com')
    expect(link.attributes('target')).toBeUndefined()
  })

  it('preserves an absolute HTTP URL and trims surrounding whitespace', () => {
    const wrapper = mountField('  http://example.com/path  ')

    expect(wrapper.get('a').attributes('href')).toBe('http://example.com/path')
  })

  it('does not render an empty link target', () => {
    const wrapper = mountField('   ')

    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('[data-icon="mdi-link-variant"]').exists()).toBe(true)
  })
})
