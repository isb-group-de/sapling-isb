import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SaplingDialogEdit from '../SaplingDialogEdit.vue'

const dialogHarness = vi.hoisted(() => ({
  state: null as Record<string, unknown> | null,
}))

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
    form: ref({ title: '' }),
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
    permissions: ref([]),
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

function mountDialog() {
  return mount(SaplingDialogEdit, {
    props: {
      modelValue: true,
      mode: 'edit',
      item: { handle: 1, title: 'Existing' },
      templates: [{ key: 'title', name: 'title', type: 'string' }],
      entity: { handle: 'ticket' } as never,
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
