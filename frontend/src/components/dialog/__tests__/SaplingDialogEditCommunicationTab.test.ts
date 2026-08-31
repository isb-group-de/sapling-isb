import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openMailDialog: vi.fn(),
  openPhoneDialog: vi.fn(),
  initializeEntityState: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'mail.compose': 'E-Mail verfassen',
        'navigation.ticket': 'Tickets',
        'navigationGroup.mails': 'E-Mails',
        'ticket.invoiceEmail': 'Rechnungsadresse',
      })[key] ?? key,
    te: (key: string) => ['navigation.ticket', 'ticket.invoiceEmail'].includes(key),
  }),
}))

vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: () => ({ isLoading: ref(false) }),
}))

vi.mock('@/composables/dialog/useSaplingMailDialog', () => ({
  useSaplingMailDialog: () => ({
    isOpen: ref(false),
    openMailDialog: mocks.openMailDialog,
  }),
}))

vi.mock('@/composables/dialog/useSaplingPhoneDialog', () => ({
  useSaplingPhoneDialog: () => ({
    isOpen: ref(false),
    openPhoneDialog: mocks.openPhoneDialog,
  }),
}))

vi.mock('@/composables/table/useSaplingTable', () => ({
  useSaplingTable: () => ({
    items: ref([]),
    search: ref(''),
    page: ref(1),
    itemsPerPage: ref(10),
    totalItems: ref(0),
    isLoading: ref(false),
    sortBy: ref([]),
    columnFilters: ref({}),
    activeFilter: ref({}),
    entityTemplates: ref([]),
    entity: ref(null),
    entityPermission: ref(null),
    isInitialized: ref(true),
    loadData: vi.fn(),
    initializeEntityState: mocks.initializeEntityState,
    onSearchUpdate: vi.fn(),
    onPageUpdate: vi.fn(),
    onItemsPerPageUpdate: vi.fn(),
    onColumnFiltersUpdate: vi.fn(),
    onSortByUpdate: vi.fn(),
    parentFilter: ref({}),
  }),
}))

import SaplingDialogEditCommunicationTab from '../SaplingDialogEditCommunicationTab.vue'

const VMenuStub = defineComponent({
  template: '<div><slot name="activator" :props="{}" /><slot /></div>',
})
const VBtnStub = defineComponent({
  props: ['disabled', 'title'],
  emits: ['click'],
  template:
    '<button :disabled="disabled" :title="title" @click="$emit(\'click\')"><slot /></button>',
})
const VListItemStub = defineComponent({
  props: ['title', 'subtitle'],
  emits: ['click'],
  template:
    '<button type="button" @click="$emit(\'click\')"><span>{{ title }}</span><small>{{ subtitle }}</small></button>',
})

describe('SaplingDialogEditCommunicationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers every record address separately and opens the composer with only the selected one', async () => {
    const wrapper = mount(SaplingDialogEditCommunicationTab, {
      props: {
        kind: 'email',
        item: { handle: 10 },
        recordEntityHandle: 'ticket',
        canCreate: true,
        recordLabel: '2026#00010 Testticket',
        emailActions: [
          {
            templateName: 'creatorPersonEmail',
            fieldLabel: 'creatorPersonEmail',
            recipientName: 'Ada Lovelace',
            email: 'ada@example.com',
            source: 'record',
          },
          {
            templateName: 'invoiceEmail',
            fieldLabel: 'invoiceEmail',
            email: 'billing@example.com',
            source: 'record',
          },
        ],
      },
      global: {
        stubs: {
          VMenu: VMenuStub,
          VBtn: VBtnStub,
          VList: { template: '<div><slot /></div>' },
          VListItem: VListItemStub,
          VIcon: true,
          VSkeletonLoader: true,
          SaplingTable: true,
        },
      },
    })

    const actions = wrapper.findAll('[data-test="record-email-action"]')
    expect(actions).toHaveLength(2)
    expect(actions[0].text()).toContain('E-Mail verfassen: Ada Lovelace')
    expect(actions[0].text()).toContain('ada@example.com')
    expect(actions[1].text()).toContain('E-Mail verfassen: Rechnungsadresse')

    await actions[1].trigger('click')

    expect(mocks.openMailDialog).toHaveBeenCalledExactlyOnceWith({
      entityHandle: 'ticket',
      itemHandle: '10',
      draftValues: undefined,
      initialTo: ['billing@example.com'],
      recordLabel: '2026#00010 Testticket',
    })
  })

  it('uses the selected recipient name as the composer label', async () => {
    const wrapper = mount(SaplingDialogEditCommunicationTab, {
      props: {
        kind: 'email',
        item: { handle: 10 },
        recordEntityHandle: 'ticket',
        canCreate: true,
        recordLabel: '2026#00010 Testticket',
        emailActions: [
          {
            templateName: 'creatorPersonEmail',
            fieldLabel: 'creatorPersonEmail',
            recipientName: 'Ada Lovelace',
            email: 'ada@example.com',
            source: 'record',
          },
        ],
      },
      global: {
        stubs: {
          VMenu: VMenuStub,
          VBtn: VBtnStub,
          VList: { template: '<div><slot /></div>' },
          VListItem: VListItemStub,
          VIcon: true,
          VSkeletonLoader: true,
          SaplingTable: true,
        },
      },
    })

    await wrapper.get('[data-test="record-email-action"]').trigger('click')

    expect(mocks.openMailDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        initialTo: ['ada@example.com'],
        recordLabel: 'Ada Lovelace',
      }),
    )
  })
})
