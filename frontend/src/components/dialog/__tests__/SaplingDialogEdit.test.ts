import { mount } from '@vue/test-utils'
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
    isSaving: computed(() => false),
    unsavedChangesDialog: ref(false),
    pendingSaveAction: ref(null),
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
    removeRelation: vi.fn(),
    onRelationTablePage: vi.fn(),
    onRelationTableItemsPerPage: vi.fn(),
    onRelationTableSort: vi.fn(),
    onRelationTableColumnFilters: vi.fn(),
    onRelationTableReload: vi.fn(),
  }
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
      mount(SaplingDialogEdit, {
        props: {
          modelValue: true,
          mode: 'edit',
          item: { handle: 1, title: 'Existing' },
          templates: [{ key: 'title', name: 'title', type: 'string' }],
          entity: { handle: 'ticket' } as never,
        },
        global: {
          stubs: {
            VDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
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
            SaplingDialogEditFormSections: { template: '<input data-test="first-field" />' },
            SaplingDialogEditHeader: { template: '<div />' },
            SaplingDialogEditRelationTab: { template: '<div />' },
            SaplingDialogRecordActionDialogs: { template: '<div />' },
            SaplingDialogUnsavedChanges: { template: '<div />' },
          },
        },
      })

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
})
