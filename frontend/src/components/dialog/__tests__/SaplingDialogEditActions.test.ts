import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import SaplingDialogEditActions from '../SaplingDialogEditActions.vue'

vi.mock('vuetify', async () => {
  const { ref: vueRef } = await import('vue')
  return {
    useDisplay: () => ({
      mdAndUp: vueRef(true),
      smAndDown: vueRef(false),
    }),
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

function mountActions() {
  return mount(SaplingDialogEditActions, {
    props: {
      mode: 'edit',
      isLoading: false,
      isDirty: true,
      canSubmit: true,
      isSaving: false,
      pendingSaveAction: null,
      validationFeedback: null,
      canDeleteRecord: false,
      recordActionButtonsDisabled: false,
      editMobileSecondaryActionsDisabled: false,
      hasReadonlyMobileActionMenu: false,
      recordActionMenuItems: [],
      mobileRecordActionMenuGroups: [],
      resetButtonLabel: 'Reset',
    },
    global: {
      stubs: {
        VBtn: {
          inheritAttrs: false,
          template: '<button v-bind="$attrs"><slot /></button>',
        },
        VMenu: { template: '<div><slot /></div>' },
        VList: { template: '<div><slot /></div>' },
        VListItem: { template: '<div><slot /></div>' },
        VDivider: { template: '<hr />' },
        SaplingActionBar: {
          template: '<div><slot name="leading" /><slot name="trailing" /></div>',
        },
        SaplingActionBarSkeleton: { template: '<div />' },
        SaplingRecordActionMenuList: { template: '<div />' },
      },
    },
  })
}

describe('SaplingDialogEditActions', () => {
  it('pulses only the save action that caused the validation error', async () => {
    const wrapper = mountActions()
    const saveButton = wrapper.get('[data-dialog-save-action="save"]')
    const saveAndCloseButton = wrapper.get('[data-dialog-save-action="saveAndClose"]')

    expect(saveButton.attributes('aria-keyshortcuts')).toBe('Control+S Meta+S')
    expect(saveAndCloseButton.attributes('aria-keyshortcuts')).toBe('Control+Enter Meta+Enter')

    await wrapper.setProps({ validationFeedback: { action: 'save', attempt: 1 } })
    await flushPromises()

    expect(saveButton.classes()).toContain('sapling-dialog-edit-save-action--validation-error')
    expect(saveAndCloseButton.classes()).not.toContain(
      'sapling-dialog-edit-save-action--validation-error',
    )

    await wrapper.setProps({ validationFeedback: { action: 'saveAndClose', attempt: 2 } })
    await flushPromises()

    expect(saveButton.classes()).not.toContain('sapling-dialog-edit-save-action--validation-error')
    expect(saveAndCloseButton.classes()).toContain(
      'sapling-dialog-edit-save-action--validation-error',
    )

    wrapper.unmount()
  })

  it('allows saving a prefilled create record without marking it as dirty', async () => {
    const wrapper = mountActions()
    await wrapper.setProps({ mode: 'create', isDirty: false, canSubmit: true })

    const saveButton = wrapper.get('[data-dialog-save-action="save"]')
    const saveAndCloseButton = wrapper.get('[data-dialog-save-action="saveAndClose"]')
    const resetButton = wrapper.findAll('button').find((button) => button.text() === 'Reset')

    expect(saveButton.attributes('disabled')).toBeUndefined()
    expect(saveAndCloseButton.attributes('disabled')).toBeUndefined()
    expect(resetButton?.attributes('disabled')).toBeDefined()

    await saveAndCloseButton.trigger('click')
    expect(wrapper.emitted('save-and-close')).toHaveLength(1)
  })
})
