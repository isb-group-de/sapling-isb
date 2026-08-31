import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const translations: Record<string, string> = {
  'global.mailToSelected': 'E-Mail an alle Ausgewählten',
  'ticket.assigneeCompanyEmail': 'Verantwortlich (Firma) E-Mail',
  'ticket.creatorCompanyEmail': 'Kunde (Firma) E-Mail',
  'ticket.creatorPersonEmail': 'Kunde (Person) E-Mail',
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => translations[key] ?? key,
    te: (key: string) => key in translations,
  }),
}))

vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: () => ({ isLoading: ref(false) }),
}))

import SaplingTableMultiSelect from '../SaplingTableMultiSelect.vue'

const VMenuStub = defineComponent({
  template: '<div><slot name="activator" :props="{}" /><slot /></div>',
})

const VListItemStub = defineComponent({
  template: '<button type="button"><slot /></button>',
})

describe('SaplingTableMultiSelect', () => {
  it('distinguishes bulk mail actions by their recipient field', () => {
    const wrapper = mount(SaplingTableMultiSelect, {
      props: {
        multiSelect: true,
        selectedRows: [0, 1],
        selectedItems: [
          {
            handle: 1,
            assigneeCompanyEmail: 'support@example.com',
            creatorCompanyEmail: 'customer@example.com',
            creatorPersonEmail: 'person@example.com',
          },
          {
            handle: 2,
            assigneeCompanyEmail: 'support@example.com',
            creatorCompanyEmail: 'other-customer@example.com',
            creatorPersonEmail: 'other-person@example.com',
          },
        ],
        entityTemplates: [
          { name: 'assigneeCompanyEmail', options: ['isMail'] },
          { name: 'creatorCompanyEmail', options: ['isMail'] },
          { name: 'creatorPersonEmail', options: ['isMail'] },
        ],
        scriptButtons: [],
        showActions: true,
        entity: { handle: 'ticket', canUpdate: true },
        entityPermission: { entityHandle: 'ticket', allowUpdate: true },
      } as never,
      global: {
        mocks: {
          $t: (key: string) => translations[key] ?? key,
        },
        stubs: {
          VMenu: VMenuStub,
          VList: { template: '<div><slot /></div>' },
          VListItem: VListItemStub,
          VIcon: true,
          VBtn: true,
        },
      },
    })

    const labels = wrapper
      .findAllComponents(VListItemStub)
      .map((item) => item.text())
      .filter((label) => label.startsWith('E-Mail an alle Ausgewählten'))

    expect(labels).toEqual([
      'E-Mail an alle Ausgewählten: Verantwortlich (Firma) E-Mail',
      'E-Mail an alle Ausgewählten: Kunde (Firma) E-Mail',
      'E-Mail an alle Ausgewählten: Kunde (Person) E-Mail',
    ])
  })
})
