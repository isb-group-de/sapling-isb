import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SaplingDialogEdit from '../SaplingDialogEdit.vue'
import type { AccumulatedPermission } from '@/entity/structure'

const dialogHarness = vi.hoisted(() => ({
  state: null as Record<string, unknown> | null,
}))
const useTranslationLoaderMock = vi.hoisted(() => vi.fn())
const getEntityTemplateMock = vi.hoisted(() => vi.fn())

vi.mock('vue-i18n', () => ({
  createI18n: () => ({
    global: {
      t: (key: string) => key,
      te: () => false,
    },
  }),
  useI18n: () => ({
    t: (key: string) => key,
    d: () => '',
    te: () => false,
  }),
}))

vi.mock('@/composables/dialog/useSaplingDialogEdit', () => ({
  useSaplingDialogEdit: () => dialogHarness.state,
}))

vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: useTranslationLoaderMock,
}))

vi.mock('@/services/api.template.service', () => ({
  default: {
    getEntityTemplate: getEntityTemplateMock,
  },
}))

vi.mock('@/composables/dialog/useSaplingDialogRecordActions', () => ({
  useSaplingDialogRecordActions: () => ({
    canDeleteRecord: computed(() => false),
    canOpenFormConfigEditor: computed(() => false),
    editMobileSecondaryActionsDisabled: computed(() => true),
    hasReadonlyMobileActionMenu: computed(() => false),
    mobileRecordActionMenuGroups: computed(() => []),
    recordActionButtonsDisabled: computed(() => true),
    recordActionMenuItems: computed(() => []),
    recordDeleteDialog: ref(false),
    showExternalRecordLinksDialog: ref(false),
    showInformationDialog: ref(false),
    showUploadDialog: ref(false),
    closeExternalRecordLinksDialog: vi.fn(),
    closeInformationDialog: vi.fn(),
    closeRecordDeleteDialog: vi.fn(),
    closeUploadDialog: vi.fn(),
    confirmRecordDelete: vi.fn(),
    handleRecordAction: vi.fn(),
    openFormConfigEditor: vi.fn(),
    openRecordDeleteDialog: vi.fn(),
  }),
}))

function createDialogState() {
  return {
    isLoading: ref(true),
    form: ref<Record<string, unknown>>({ title: '' }),
    formRef: ref(null),
    activeTab: ref(0),
    selectedRelations: ref({}),
    visibleTemplates: computed(() => [{ name: 'title', type: 'string' }]),
    visibleTemplateGroups: computed(() => [{ id: 'main', label: '', templates: [] }]),
    relationTemplates: computed(() => []),
    dirtyRelationNames: computed<string[]>(() => []),
    relationTableHeaders: ref({}),
    relationTableState: ref({}),
    relationTableItems: ref({}),
    relationTableSearch: ref({}),
    relationTablePage: ref({}),
    relationTableTotal: ref({}),
    relationTableItemsPerPage: ref({}),
    relationTableSortBy: ref({}),
    relationTableColumnFilters: ref({}),
    permissions: ref<AccumulatedPermission[]>([]),
    iconNames: ref([]),
    selectedItems: ref([]),
    isDirty: computed(() => false),
    canSubmit: computed(() => false),
    isSaving: computed(() => false),
    unsavedChangesDialog: ref(false),
    pendingSaveAction: ref(null),
    validationFeedback: ref<{
      action: 'save' | 'saveAndClose'
      attempt: number
    } | null>(null),
    dirtyFieldCount: computed(() => 0),
    formConfigMenuItems: computed(() => []),
    selectedFormConfigLabel: computed(() => ''),
    selectFormConfig: vi.fn(),
    getRules: vi.fn().mockReturnValue([]),
    getTemplateColumnProps: vi.fn().mockReturnValue({ cols: 12 }),
    isTemplateDirty: vi.fn().mockReturnValue(false),
    getDirtyTemplateCount: vi.fn().mockReturnValue(0),
    isFieldDisabled: vi.fn().mockReturnValue(false),
    isReferenceFieldDisabled: vi.fn().mockReturnValue(false),
    getReferenceParentFilter: vi.fn(),
    handleDialogUpdate: vi.fn(),
    onDuplicateSelect: vi.fn(),
    cancel: vi.fn(),
    keepEditing: vi.fn(),
    discardChanges: vi.fn(),
    saveChangesAndClose: vi.fn(),
    resetForm: vi.fn(),
    save: vi.fn(),
    saveAndClose: vi.fn(),
    addRelation: vi.fn(),
    stageNewRelationRecord: vi.fn(),
    removeRelation: vi.fn(),
    onRelationTablePage: vi.fn(),
    onRelationTableItemsPerPage: vi.fn(),
    onRelationTableSort: vi.fn(),
    onRelationTableColumnFilters: vi.fn(),
    onRelationTableReload: vi.fn(),
  }
}

function mountDialog(propOverrides: Record<string, unknown> = {}) {
  return mount(SaplingDialogEdit, {
    props: {
      modelValue: true,
      mode: 'edit',
      item: { handle: 1, title: 'Existing' },
      templates: [{ key: 'title', name: 'title', type: 'string' }],
      entity: { handle: 'ticket' } as never,
      ...propOverrides,
    },
    global: {
      stubs: {
        VDialog: {
          name: 'VDialog',
          props: ['modelValue'],
          template: '<div v-if="modelValue"><slot /></div>',
        },
        VCardText: { template: '<div><slot /></div>' },
        VDefaultsProvider: { template: '<div><slot /></div>' },
        VForm: { template: '<form><slot /></form>' },
        VIcon: { template: '<span><slot /></span>' },
        VSkeletonLoader: { template: '<div />' },
        VTab: { template: '<button><slot /></button>' },
        VTabs: { template: '<div><slot /></div>' },
        VWindow: { template: '<div><slot /></div>' },
        VWindowItem: { template: '<div><slot /></div>' },
        SaplingDialogCard: { template: '<div><slot /></div>' },
        SaplingDialogEditActions: { template: '<div />' },
        SaplingDialogEditFormSections: {
          template:
            '<section data-dialog-group-id="main"><div data-dialog-field-name="title"><input data-test="first-field" class="v-input--error" aria-invalid="true" /></div></section>',
        },
        SaplingDialogEditHeader: {
          name: 'SaplingDialogEditHeader',
          props: ['dirtySummaryLabel'],
          template: '<div data-test="dialog-dirty-summary">{{ dirtySummaryLabel }}</div>',
        },
        SaplingDialogEditRelationTab: { template: '<div />' },
        SaplingDialogEditCommunicationTab: {
          name: 'SaplingDialogEditCommunicationTab',
          props: ['kind', 'emailRecipients', 'recordLabel'],
          template: '<div />',
        },
        SaplingDialogEditInformationTab: { template: '<div />' },
        SaplingDialogEditDocumentsTab: { template: '<div />' },
        SaplingDialogRecordActionDialogs: { template: '<div />' },
        SaplingDialogUnsavedChanges: { template: '<div />' },
      },
    },
  })
}

async function settleFocus() {
  await nextTick()
  await nextTick()
}

describe('SaplingDialogEdit', () => {
  beforeEach(() => {
    useTranslationLoaderMock.mockReset()
    getEntityTemplateMock.mockReset().mockResolvedValue([])
    useTranslationLoaderMock.mockReturnValue({
      isLoading: ref(false),
      loadTranslations: vi.fn(),
    })
    dialogHarness.state = createDialogState()
  })

  it('auto-focuses the first field only once per open dialog', async () => {
    const offsetParentDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetParent',
    )
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get() {
        return document.body
      },
    })
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus')

    try {
      mountDialog()

      const state = dialogHarness.state as ReturnType<typeof createDialogState>
      state.isLoading.value = false
      await settleFocus()

      expect(focusSpy).toHaveBeenCalledTimes(1)

      state.isLoading.value = true
      await nextTick()
      state.isLoading.value = false
      await settleFocus()

      expect(focusSpy).toHaveBeenCalledTimes(1)
    } finally {
      focusSpy.mockRestore()
      if (offsetParentDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParentDescriptor)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'offsetParent')
      }
    }
  })

  it('cancels from Escape on the dialog root', async () => {
    const wrapper = mountDialog()
    const state = dialogHarness.state as ReturnType<typeof createDialogState>

    await wrapper.getComponent({ name: 'VDialog' }).trigger('keydown', { key: 'Escape' })

    expect(state.cancel).toHaveBeenCalledOnce()
  })

  it('shows a dirty summary when only a relation has changed', () => {
    const state = createDialogState()
    state.dirtyRelationNames = computed(() => ['participants'])
    state.isDirty = computed(() => true)
    dialogHarness.state = state

    const wrapper = mountDialog()

    expect(wrapper.get('[data-test="dialog-dirty-summary"]').text()).toBe('global.dirtyFieldCount')
  })

  it('appends information, documents, email, and phone-call tabs for records', async () => {
    const state = createDialogState()
    state.isLoading.value = false
    state.activeTab.value = 3
    state.permissions.value = [
      { entityHandle: 'information', allowRead: true, allowShow: false },
      { entityHandle: 'document', allowRead: true, allowShow: false },
      { entityHandle: 'emailDelivery', allowRead: true, allowShow: false },
      { entityHandle: 'phoneCall', allowRead: true, allowShow: false, allowInsert: true },
    ]
    state.form.value = {
      title: 'Existing',
      email: 'ticket@example.com',
      phone: '+49 30 1234567',
    }
    dialogHarness.state = state

    const wrapper = mountDialog({
      templates: [
        { key: 'title', name: 'title', type: 'string', options: ['isValue'] },
        { key: 'email', name: 'email', type: 'string', options: ['isMail'] },
        { key: 'phone', name: 'phone', type: 'string', options: ['isPhone'] },
      ],
    })
    await nextTick()

    expect(useTranslationLoaderMock).toHaveBeenCalledWith('navigationGroup')
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual([
      expect.stringContaining('navigation.ticket'),
      expect.stringContaining('navigation.information'),
      expect.stringContaining('navigation.document'),
      expect.stringContaining('navigationGroup.mails'),
      expect.stringContaining('navigation.phoneCall'),
    ])
  })

  it.each([
    ['information', 'navigation.information'],
    ['document', 'navigation.document'],
    ['emailDelivery', 'navigationGroup.mails'],
    ['phoneCall', 'navigation.phoneCall'],
  ] as const)(
    'hides the %s supplemental tab without read permission regardless of show permission',
    async (restrictedEntity, hiddenLabel) => {
      const state = createDialogState()
      state.isLoading.value = false
      state.form.value = {
        title: 'Existing',
        email: 'ticket@example.com',
        phone: '+49 30 1234567',
      }
      state.permissions.value = ['information', 'document', 'emailDelivery', 'phoneCall'].map(
        (entityHandle) => ({
          entityHandle,
          allowRead: entityHandle !== restrictedEntity,
          allowShow: true,
        }),
      )
      dialogHarness.state = state

      const wrapper = mountDialog({
        templates: [
          { key: 'title', name: 'title', type: 'string', options: ['isValue'] },
          { key: 'email', name: 'email', type: 'string', options: ['isMail'] },
          { key: 'phone', name: 'phone', type: 'string', options: ['isPhone'] },
        ],
      })
      await nextTick()

      const tabLabels = wrapper.findAll('[role="tab"]').map((tab) => tab.text())
      expect(tabLabels.some((label) => label.includes(hiddenLabel))).toBe(false)
    },
  )

  it('returns to the record tab when read permission for the active supplemental tab is removed', async () => {
    const state = createDialogState()
    state.isLoading.value = false
    state.activeTab.value = 1
    state.permissions.value = [{ entityHandle: 'information', allowRead: true }]
    dialogHarness.state = state

    const wrapper = mountDialog()
    await nextTick()
    expect(
      wrapper.findAll('[role="tab"]').some((tab) => tab.text().includes('navigation.information')),
    ).toBe(true)

    state.permissions.value = [{ entityHandle: 'information', allowRead: false, allowShow: true }]
    await nextTick()

    expect(state.activeTab.value).toBe(0)
    expect(
      wrapper.findAll('[role="tab"]').some((tab) => tab.text().includes('navigation.information')),
    ).toBe(false)
  })

  it('passes every populated isMail field to the email composer tab', async () => {
    const state = createDialogState()
    state.isLoading.value = false
    state.activeTab.value = 3
    state.form.value = {
      email: 'info@example.com',
      invoiceEmail: ' billing@example.com ',
      ignoredEmail: 'ignored@example.com',
    }
    state.permissions.value = [{ entityHandle: 'emailDelivery', allowRead: true }]
    dialogHarness.state = state

    const wrapper = mountDialog({
      templates: [
        { key: 'email', name: 'email', type: 'string', options: ['isMail'] },
        { key: 'invoiceEmail', name: 'invoiceEmail', type: 'string', options: ['isMail'] },
        { key: 'ignoredEmail', name: 'ignoredEmail', type: 'string' },
      ],
    })
    await nextTick()

    expect(
      wrapper.getComponent({ name: 'SaplingDialogEditCommunicationTab' }).props('emailRecipients'),
    ).toEqual(['info@example.com', 'billing@example.com'])
  })

  it('uses isValue metadata generically and hides communication tabs without contact values', async () => {
    const state = createDialogState()
    state.isLoading.value = false
    state.activeTab.value = 3
    state.form.value = {
      caseNumber: 'T-1042',
      summary: 'Drucker defekt',
      creatorPerson: { handle: 42 },
      creatorPersonFirstName: 'Ada',
      creatorPersonLastName: 'Lovelace',
      creatorPersonCompany: { handle: 5 },
      creatorPersonEmail: 'creator@example.com',
      creatorPersonPhone: '+49 30 7654321',
    }
    state.permissions.value = [
      { entityHandle: 'information', allowRead: true },
      { entityHandle: 'document', allowRead: true },
      { entityHandle: 'emailDelivery', allowRead: true },
      { entityHandle: 'phoneCall', allowRead: true },
    ]
    dialogHarness.state = state
    getEntityTemplateMock.mockResolvedValue([
      { key: 'firstName', name: 'firstName', type: 'string', options: ['isValue'] },
      { key: 'lastName', name: 'lastName', type: 'string', options: ['isValue'] },
      {
        key: 'company',
        name: 'company',
        type: 'object',
        isReference: true,
        referenceName: 'company',
        options: ['isValue'],
      },
    ])

    const wrapper = mountDialog({
      entity: { handle: 'customWorkItem' } as never,
      templates: [
        { key: 'caseNumber', name: 'caseNumber', type: 'string', options: ['isValue'] },
        { key: 'summary', name: 'summary', type: 'string', options: ['isValue'] },
        {
          key: 'creatorPerson',
          name: 'creatorPerson',
          type: 'object',
          kind: 'm:1',
          isReference: true,
          referenceName: 'person',
        },
        {
          key: 'creatorPersonFirstName',
          name: 'creatorPersonFirstName',
          type: 'string',
          isPersistent: false,
        },
        {
          key: 'creatorPersonLastName',
          name: 'creatorPersonLastName',
          type: 'string',
          isPersistent: false,
        },
        {
          key: 'creatorPersonCompany',
          name: 'creatorPersonCompany',
          type: 'object',
          isPersistent: false,
        },
        {
          key: 'creatorPersonEmail',
          name: 'creatorPersonEmail',
          type: 'string',
          isPersistent: false,
          options: ['isMail'],
        },
        {
          key: 'creatorPersonPhone',
          name: 'creatorPersonPhone',
          type: 'string',
          isPersistent: false,
          options: ['isPhone'],
        },
      ],
    })
    await flushPromises()

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      expect.stringContaining('navigation.customWorkItem'),
      expect.stringContaining('navigation.information'),
      expect.stringContaining('navigation.document'),
      expect.stringContaining('navigationGroup.mails'),
      expect.stringContaining('navigation.phoneCall'),
    ])
    expect(
      wrapper.getComponent({ name: 'SaplingDialogEditCommunicationTab' }).props('recordLabel'),
    ).toBe('Ada Lovelace')
    expect(getEntityTemplateMock).toHaveBeenCalledWith('person')

    state.form.value = { caseNumber: 'T-1042', summary: 'Drucker defekt' }
    await nextTick()

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      expect.stringContaining('navigation.customWorkItem'),
      expect.stringContaining('navigation.information'),
      expect.stringContaining('navigation.document'),
    ])
  })

  it('returns to the form tab, scrolls to and focuses the first invalid field', async () => {
    const scrollDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    )
    const scrollIntoView = vi.fn()
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0)
        return 1
      })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    try {
      const state = dialogHarness.state as ReturnType<typeof createDialogState>
      state.isLoading.value = false
      state.activeTab.value = 1
      const wrapper = mountDialog()
      await settleFocus()
      const invalidField = wrapper.get('[data-test="first-field"]')
      const focusSpy = vi.spyOn(invalidField.element as HTMLInputElement, 'focus')

      state.validationFeedback.value = { action: 'save', attempt: 1 }
      await nextTick()
      await flushPromises()

      expect(state.activeTab.value).toBe(0)
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      })
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    } finally {
      requestAnimationFrameSpy.mockRestore()
      if (scrollDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
      }
    }
  })
})
