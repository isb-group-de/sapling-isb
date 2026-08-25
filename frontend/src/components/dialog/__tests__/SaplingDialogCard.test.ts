import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import SaplingDialogCard from '../SaplingDialogCard.vue'

function mountCard(props: { tilt?: boolean } = {}) {
  return mount(SaplingDialogCard, {
    props,
    global: {
      plugins: [createI18n({ legacy: false, locale: 'de', messages: { de: {} } })],
      stubs: {
        SaplingSurface: {
          name: 'SaplingSurface',
          props: {
            tilt: { type: Boolean, default: false },
          },
          template: '<div><slot /></div>',
        },
      },
    },
  })
}

describe('SaplingDialogCard', () => {
  it('keeps dialog surfaces static by default', () => {
    expect(mountCard().getComponent({ name: 'SaplingSurface' }).props('tilt')).toBe(false)
  })

  it('allows the login surface to opt in to tilt', () => {
    expect(mountCard({ tilt: true }).getComponent({ name: 'SaplingSurface' }).props('tilt')).toBe(
      true,
    )
  })
})
