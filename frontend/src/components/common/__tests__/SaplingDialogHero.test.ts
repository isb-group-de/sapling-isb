import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingDialogHero from '../SaplingDialogHero.vue'

describe('SaplingDialogHero', () => {
  it('renders the confirmation subtitle', () => {
    const wrapper = mount(SaplingDialogHero, {
      props: {
        title: 'Delete worklist',
        subtitle: 'Do you really want to delete this worklist?',
      },
    })

    expect(wrapper.get('.sapling-dialog-hero__subtitle').text()).toBe(
      'Do you really want to delete this worklist?',
    )
  })
})
