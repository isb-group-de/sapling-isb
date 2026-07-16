import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SaplingDialogConfirm from '../SaplingDialogConfirm.vue'

function mountDialog(closeDisabled = false) {
  return mount(SaplingDialogConfirm, {
    props: {
      modelValue: true,
      closeDisabled,
    },
    global: {
      stubs: {
        VDialog: {
          name: 'VDialog',
          props: ['modelValue'],
          template: '<div v-if="modelValue"><slot /></div>',
        },
        SaplingActionBarSkeleton: true,
        SaplingDialogCard: { template: '<div><slot /></div>' },
        SaplingDialogHero: true,
        VCardText: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('SaplingDialogConfirm', () => {
  it('emits escape from Escape on the dialog root', async () => {
    const wrapper = mountDialog()

    await wrapper.getComponent({ name: 'VDialog' }).trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('escape')).toHaveLength(1)
  })

  it('keeps Escape disabled while closing is disabled', async () => {
    const wrapper = mountDialog(true)

    await wrapper.getComponent({ name: 'VDialog' }).trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('escape')).toBeUndefined()
  })
})
