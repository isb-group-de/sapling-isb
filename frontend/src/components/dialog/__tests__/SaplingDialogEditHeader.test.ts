import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SaplingDialogEditHeader from '../SaplingDialogEditHeader.vue'

function mountHeader(isSmallViewport: boolean) {
  return mount(SaplingDialogEditHeader, {
    props: {
      loading: false,
      eyebrow: 'Unternehmen',
      title: 'Datensatz bearbeiten',
      createdAtTitle: '',
      createdAtLabel: '',
      updatedAtTitle: '',
      updatedAtLabel: '',
      selectedFormConfigChipLabel: '',
      isDirty: false,
      dirtySummaryLabel: '',
      mode: 'edit',
      canOpenFormConfigEditor: true,
      isSmallViewport,
    },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        VCardTitle: { template: '<div><slot /></div>' },
        VBtn: {
          inheritAttrs: false,
          template: '<button v-bind="$attrs"><slot /></button>',
        },
        SaplingDialogEditHero: {
          template: '<div><slot name="actions" /></div>',
        },
      },
    },
  })
}

describe('SaplingDialogEditHeader', () => {
  it('shows form configuration on desktop and omits it on mobile', () => {
    expect(mountHeader(false).find('button').exists()).toBe(true)
    expect(mountHeader(true).find('button').exists()).toBe(false)
  })
})
