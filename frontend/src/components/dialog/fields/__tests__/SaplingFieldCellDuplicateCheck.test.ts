import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import SaplingFieldCellDuplicateCheck from '../SaplingFieldCellDuplicateCheck.vue'

vi.mock('@/composables/table/useSaplingTable', () => {
  const makeRef = <T>(value: T) => ({ value })

  return {
    useSaplingTable: () => ({
      items: makeRef([]),
      page: makeRef(1),
      itemsPerPage: makeRef(5),
      totalItems: makeRef(0),
      isLoading: makeRef(false),
      sortBy: makeRef([]),
      columnFilters: makeRef({}),
      activeFilter: makeRef(null),
      entityTemplates: makeRef([]),
      entity: makeRef(null),
      entityPermission: makeRef(null),
      loadData: vi.fn(),
      onSearchUpdate: vi.fn(),
      onPageUpdate: vi.fn(),
      onItemsPerPageUpdate: vi.fn(),
      onColumnFiltersUpdate: vi.fn(),
      onSortByUpdate: vi.fn(),
    }),
  }
})

const VMenuStub = defineComponent({
  name: 'VMenu',
  props: { modelValue: Boolean },
  template: '<div><slot name="activator" :props="{}" /><slot /></div>',
})

const VTextFieldStub = defineComponent({
  name: 'VTextField',
  props: {
    hint: String,
    prependInnerIcon: String,
    persistentHint: Boolean,
  },
  template: '<div data-test="duplicate-input">{{ hint }}</div>',
})

describe('SaplingFieldCellDuplicateCheck', () => {
  it('distinguishes duplicate checking from a reference selection', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'de',
      messages: {
        de: {
          global: {
            duplicateCheckHint:
              'Dublettenprüfung aktiv – ähnliche Datensätze werden bei der Eingabe angezeigt.',
            duplicateCheckResultsTitle: 'Mögliche Dubletten',
            duplicateCheckResultsHint:
              'Nur zur Prüfung: Die Auswahl eines Treffers öffnet den vorhandenen Datensatz.',
          },
        },
      },
    })

    const wrapper = mount(SaplingFieldCellDuplicateCheck, {
      props: {
        label: 'Vorname',
        entityHandle: 'person',
        modelName: 'firstName',
      },
      global: {
        plugins: [i18n],
        stubs: {
          'v-menu': VMenuStub,
          'v-text-field': VTextFieldStub,
          'v-icon': { template: '<span><slot /></span>' },
          SaplingTable: true,
        },
      },
    })

    expect(wrapper.getComponent(VTextFieldStub).props()).toMatchObject({
      hint: 'Dublettenprüfung aktiv – ähnliche Datensätze werden bei der Eingabe angezeigt.',
      prependInnerIcon: 'mdi-content-duplicate',
      persistentHint: true,
    })
    expect(wrapper.get('.sapling-field-duplicate-check__notice').text()).toContain(
      'Mögliche Dubletten',
    )
    expect(wrapper.get('.sapling-field-duplicate-check__notice').text()).toContain(
      'Nur zur Prüfung',
    )
  })
})
