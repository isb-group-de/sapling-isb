import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SaplingDialogEditHeader from '../SaplingDialogEditHeader.vue'

function mountHeader(isSmallViewport: boolean, overrides: Record<string, unknown> = {}) {
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
      dirtyChangeCount: 0,
      dirtySummaryLabel: '',
      mode: 'edit',
      canOpenFormConfigEditor: true,
      isSmallViewport,
      ...overrides,
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
        VChip: { template: '<span class="v-chip"><slot /></span>' },
        SaplingDialogEditHero: {
          template: '<div><slot name="timestamps" /><slot name="actions" /></div>',
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

  it('shows the dirty chip only when the numeric change count is greater than zero', () => {
    expect(
      mountHeader(false, { dirtyChangeCount: 0, dirtySummaryLabel: 'truthy fallback' })
        .find('.v-chip')
        .exists(),
    ).toBe(false)
    expect(
      mountHeader(false, { dirtyChangeCount: 1, dirtySummaryLabel: '1 Änderung' })
        .get('.v-chip')
        .text(),
    ).toBe('1 Änderung')
  })
})
