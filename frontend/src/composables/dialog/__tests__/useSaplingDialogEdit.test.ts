import { computed, defineComponent, nextTick, ref, type PropType } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccumulatedPermission, DialogState, EntityTemplate } from '@/entity/structure'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'

const {
  fetchCurrentPersonMock,
  fetchCurrentPermissionMock,
  buildSavePayloadMock,
  listFormConfigsMock,
  findAllMock,
  initializeFormMock,
  syncParentReferencesMock,
  extractDependencyIdentifierMock,
  applyReferenceDependencyParentMock,
  findSingleReferenceForDependencyMock,
  validateFormMock,
  ensureRelationTableItemsMock,
  relationTemplatesState,
  relationOptionsState,
} = vi.hoisted(() => ({
  fetchCurrentPersonMock: vi.fn(),
  fetchCurrentPermissionMock: vi.fn(),
  buildSavePayloadMock: vi.fn(),
  listFormConfigsMock: vi.fn(),
  findAllMock: vi.fn(),
  initializeFormMock: vi.fn(),
  syncParentReferencesMock: vi.fn(),
  extractDependencyIdentifierMock: vi.fn(),
  applyReferenceDependencyParentMock: vi.fn(),
  findSingleReferenceForDependencyMock: vi.fn(),
  validateFormMock: vi.fn(),
  ensureRelationTableItemsMock: vi.fn(),
  relationTemplatesState: { templates: [] as EntityTemplate[] },
  relationOptionsState: {
    onPersistedItemUpdated: null as ((item: SaplingGenericItem) => void) | null,
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: vi.fn(),
  },
}))

vi.mock('@/services/api.form-config.service', () => ({
  default: {
    listApplicable: listFormConfigsMock,
  },
}))

vi.mock('@/services/api.template.service', () => ({
  default: {
    getEntityTemplate: findAllMock,
  },
}))

vi.mock('@/constants/mdi.icons', () => ({
  mdiIcons: [],
}))

vi.mock('@/utils/saplingTableUtil', () => ({
  getEditDialogHeaders: (templates: EntityTemplate[]) => templates,
}))

vi.mock('@/utils/saplingDialogLayoutUtil', () => ({
  getDialogTemplateColumns: () => ({ cols: 12 }),
  groupDialogTemplates: (templates: EntityTemplate[]) => [{ id: 'main', label: '', templates }],
  sortDialogTemplates: (templates: EntityTemplate[]) => templates,
}))

vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({
    accumulatedPermission: [] as AccumulatedPermission[],
    fetchCurrentPermission: fetchCurrentPermissionMock,
  }),
}))

vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({
    person: null,
    fetchCurrentPerson: fetchCurrentPersonMock,
  }),
}))

vi.mock('../useSaplingDialogEditRelations', () => ({
  useSaplingDialogEditRelations: (options: {
    onPersistedItemUpdated?: (item: SaplingGenericItem) => void
  }) => {
    relationOptionsState.onPersistedItemUpdated = options.onPersistedItemUpdated ?? null
    return {
      relationTemplates: computed(() => relationTemplatesState.templates),
      dirtyRelationNames: computed(() => []),
      hasPendingRelationChanges: computed(() => false),
      relationTableHeaders: ref({}),
      relationTableState: ref({}),
      relationTableItems: ref({}),
      relationTableSearch: ref({}),
      relationTablePage: ref({}),
      relationTableTotal: ref({}),
      relationTableItemsPerPage: ref({}),
      relationTableSortBy: ref({}),
      relationTableColumnFilters: ref({}),
      relationMutationState: ref({}),
      relationTableLoaded: ref({}),
      selectedRelations: ref({}),
      selectedItems: ref([]),
      addRelation: vi.fn(),
      stageNewRelationRecord: vi.fn(),
      removeRelation: vi.fn(),
      initializeRelationTables: vi.fn().mockResolvedValue(undefined),
      ensureRelationTableItems: ensureRelationTableItemsMock,
      onRelationTablePage: vi.fn(),
      onRelationTableItemsPerPage: vi.fn(),
      onRelationTableSort: vi.fn(),
      onRelationTableColumnFilters: vi.fn(),
      onRelationTableReload: vi.fn(),
      clearSelectedItems: vi.fn(),
      resetRelationTableItems: vi.fn(),
      resetRelationSelections: vi.fn(),
      appendPendingRelationsToPayload: (payload: SaplingGenericItem) => payload,
      persistPendingRelations: vi.fn().mockResolvedValue(true),
    }
  },
}))

vi.mock('../useSaplingDialogEditReferences', () => ({
  useSaplingDialogEditReferences: () => ({
    extractDependencyIdentifier: extractDependencyIdentifierMock,
    getReferenceParentFilter: vi.fn(),
    isReferenceDependencyBlocked: vi.fn().mockReturnValue(false),
    isReferenceValueValidForDependency: vi.fn().mockReturnValue(true),
    applyReferenceDependencyParent: applyReferenceDependencyParentMock,
    findSingleReferenceForDependency: findSingleReferenceForDependencyMock,
    inspectRecommendedReference: vi.fn().mockResolvedValue(undefined),
    getReferenceAvailability: vi.fn().mockReturnValue('unknown'),
    getReferenceColumnsSync: vi.fn().mockReturnValue([]),
    canReadReferenceEntity: vi.fn().mockReturnValue(true),
    prefetchReferenceColumns: vi.fn().mockResolvedValue(undefined),
    fetchReferenceData: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('../useSaplingDialogEditDirty', () => ({
  useSaplingDialogEditDirty: () => ({
    syncInitialFormSnapshot: vi.fn(),
    isDirty: computed(() => true),
    dirtyFieldCount: computed(() => 1),
    isTemplateDirty: vi.fn().mockReturnValue(true),
    getDirtyTemplateCount: vi.fn().mockReturnValue(1),
  }),
}))

vi.mock('../useSaplingDialogEditForm', () => ({
  useSaplingDialogEditForm: (options: { item: { value: SaplingGenericItem | null } }) => ({
    applyCurrentDefaults: vi.fn(),
    initializeForm: () => initializeFormMock(options.item.value),
    syncParentReferences: syncParentReferencesMock,
    buildSavePayload: buildSavePayloadMock,
  }),
}))

import { useSaplingDialogEdit } from '../useSaplingDialogEdit'

function createEntity(handle: string): EntityItem {
  return {
    handle,
    icon: '',
    canRead: true,
    createdAt: new Date(0),
  } as EntityItem
}

const TestHost = defineComponent({
  props: {
    modelValue: {
      type: Boolean,
      default: true,
    },
    templates: {
      type: Array as PropType<EntityTemplate[]>,
      default: () => [{ name: 'title', type: 'string' }],
    },
    item: {
      type: Object as PropType<SaplingGenericItem | null>,
      default: () => ({ handle: 42, title: 'Calendar event' }),
    },
    mode: {
      type: String as PropType<DialogState>,
      default: 'edit',
    },
    parent: {
      type: Object as PropType<SaplingGenericItem | null>,
      default: null,
    },
    parentEntity: {
      type: Object as PropType<EntityItem | null>,
      default: null,
    },
    entity: {
      type: Object as PropType<EntityItem | null>,
      default: () => createEntity('event'),
    },
  },
  emits: ['update:modelValue', 'save', 'cancel', 'update:mode', 'update:item'],
  setup(props, { emit }) {
    const dialogEmit = ((
      event: 'update:modelValue' | 'save' | 'cancel' | 'update:mode' | 'update:item',
      ...args: unknown[]
    ) => emit(event, ...(args as []))) as Parameters<typeof useSaplingDialogEdit>[1]

    const dialog = useSaplingDialogEdit(
      {
        get modelValue() {
          return props.modelValue
        },
        get mode() {
          return props.mode
        },
        get item() {
          return props.item
        },
        get parent() {
          return props.parent
        },
        get parentEntity() {
          return props.parentEntity
        },
        get entity() {
          return props.entity
        },
        get templates() {
          return props.templates
        },
      },
      dialogEmit,
    )

    dialog.formRef.value = {
      validate: validateFormMock,
    }

    return {
      cancel: dialog.cancel,
      discardChanges: dialog.discardChanges,
      keepEditing: dialog.keepEditing,
      saveAndClose: dialog.saveAndClose,
      save: dialog.save,
      validationFeedback: dialog.validationFeedback,
      activeTab: dialog.activeTab,
      unsavedChangesDialog: dialog.unsavedChangesDialog,
      formConfigMenuItems: dialog.formConfigMenuItems,
      selectedFormConfigLabel: dialog.selectedFormConfigLabel,
      visibleTemplates: dialog.visibleTemplates,
      form: dialog.form,
      getRules: dialog.getRules,
      hasDateRangeError: dialog.hasDateRangeError,
      isFieldDisabled: dialog.isFieldDisabled,
      isTemplateRecommendationActive: dialog.isTemplateRecommendationActive,
      updateFormField: dialog.updateFormField,
      selectFormConfig: dialog.selectFormConfig,
    }
  },
  template: '<div />',
})

describe('useSaplingDialogEdit', () => {
  beforeEach(() => {
    fetchCurrentPersonMock.mockReset()
    fetchCurrentPermissionMock.mockReset()
    buildSavePayloadMock.mockReset()
    listFormConfigsMock.mockReset()
    findAllMock.mockReset()
    initializeFormMock.mockReset()
    syncParentReferencesMock.mockReset()
    extractDependencyIdentifierMock.mockReset()
    applyReferenceDependencyParentMock.mockReset()
    findSingleReferenceForDependencyMock.mockReset()
    validateFormMock.mockReset()
    ensureRelationTableItemsMock.mockReset()
    relationTemplatesState.templates = []
    relationOptionsState.onPersistedItemUpdated = null
    fetchCurrentPersonMock.mockResolvedValue(undefined)
    fetchCurrentPermissionMock.mockResolvedValue(undefined)
    listFormConfigsMock.mockResolvedValue([])
    findAllMock.mockResolvedValue([{ name: 'title', type: 'string' }])
    buildSavePayloadMock.mockReturnValue({
      handle: 42,
      title: 'Updated event',
    })
    extractDependencyIdentifierMock.mockImplementation((value: unknown) => {
      if (value && typeof value === 'object' && 'handle' in value) {
        return (value as { handle: unknown }).handle
      }

      return value ?? null
    })
    findSingleReferenceForDependencyMock.mockResolvedValue(null)
    validateFormMock.mockResolvedValue({ valid: true })
    ensureRelationTableItemsMock.mockResolvedValue(undefined)
  })

  it('loads the selected relation tab while creating a new record', async () => {
    relationTemplatesState.templates = [
      {
        name: 'people',
        type: 'relation',
      } as EntityTemplate,
    ]
    const wrapper = mount(TestHost, {
      props: {
        mode: 'create',
        item: null,
      },
    })
    await flushPromises()
    ensureRelationTableItemsMock.mockClear()

    ;(wrapper.vm as unknown as { activeTab: number }).activeTab = 1
    await nextTick()
    await flushPromises()

    expect(ensureRelationTableItemsMock).toHaveBeenCalledWith('people')
  })

  it('disables the handle outside create mode', () => {
    const manualPrimaryKey = {
      name: 'handle',
      type: 'string',
      isAutoIncrement: false,
      fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: true },
    } as EntityTemplate

    const editWrapper = mount(TestHost, { props: { mode: 'edit' } })
    expect(
      (
        editWrapper.vm as { isFieldDisabled: (template: EntityTemplate) => boolean }
      ).isFieldDisabled(manualPrimaryKey),
    ).toBe(true)

    const createWrapper = mount(TestHost, { props: { mode: 'create' } })
    expect(
      (
        createWrapper.vm as { isFieldDisabled: (template: EntityTemplate) => boolean }
      ).isFieldDisabled(manualPrimaryKey),
    ).toBe(false)
  })

  it('marks an empty recommended scalar field without treating required fields as recommendations', async () => {
    const recommendedTemplate = {
      name: 'title',
      type: 'string',
      options: ['isRecommended'],
      fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: true },
    } as EntityTemplate
    const wrapper = mount(TestHost, {
      props: { mode: 'create', item: null, templates: [recommendedTemplate] },
    })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      isTemplateRecommendationActive: (template: EntityTemplate) => boolean
      updateFormField: (key: string, value: unknown) => void
    }

    expect(vm.isTemplateRecommendationActive(recommendedTemplate)).toBe(true)
    vm.updateFormField('title', 'Complete')
    expect(vm.isTemplateRecommendationActive(recommendedTemplate)).toBe(false)

    expect(vm.isTemplateRecommendationActive({ ...recommendedTemplate, isRequired: true })).toBe(
      false,
    )
  })

  it('adds the metadata-driven range rule to paired date fields', async () => {
    const startTemplate = {
      name: 'startDate',
      type: 'datetime',
      options: ['isDateStart'],
      formGroup: 'event.groupSchedule',
      formOrder: 100,
    } as EntityTemplate
    const endTemplate = {
      name: 'endDate',
      type: 'datetime',
      options: ['isDateEnd'],
      formGroup: 'event.groupSchedule',
      formOrder: 200,
    } as EntityTemplate
    findAllMock.mockResolvedValue([startTemplate, endTemplate])
    const wrapper = mount(TestHost, {
      props: { templates: [startTemplate, endTemplate] },
    })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      getRules: (template: EntityTemplate) => Array<() => true | string>
      hasDateRangeError: (template: EntityTemplate) => boolean
      updateFormField: (key: string, value: unknown) => void
    }

    vm.updateFormField('startDate_date', '2026-09-01')
    vm.updateFormField('startDate_time', '11:00')
    vm.updateFormField('endDate_date', '2026-09-01')
    vm.updateFormField('endDate_time', '10:00')

    expect(vm.getRules(endTemplate).slice(-1)[0]?.()).toBe('global.invalidDateRange')
    expect(vm.hasDateRangeError(startTemplate)).toBe(false)
    expect(vm.hasDateRangeError(endTemplate)).toBe(true)

    vm.updateFormField('endDate_time', '11:00')
    expect(vm.getRules(endTemplate).slice(-1)[0]?.()).toBe(true)
    expect(vm.hasDateRangeError(endTemplate)).toBe(false)
  })

  it('preserves a paired date range interval when the start changes', async () => {
    const startTemplate = {
      name: 'startDate',
      type: 'datetime',
      options: ['isDateStart'],
      formGroup: 'event.groupSchedule',
      formOrder: 100,
    } as EntityTemplate
    const endTemplate = {
      name: 'endDate',
      type: 'datetime',
      options: ['isDateEnd'],
      formGroup: 'event.groupSchedule',
      formOrder: 200,
    } as EntityTemplate
    findAllMock.mockResolvedValue([startTemplate, endTemplate])
    const wrapper = mount(TestHost, {
      props: { templates: [startTemplate, endTemplate] },
    })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      form: Record<string, unknown>
      updateFormField: (key: string, value: unknown) => void
    }

    vm.updateFormField('startDate_date', '2026-09-01')
    vm.updateFormField('startDate_time', '10:00')
    vm.updateFormField('endDate_date', '2026-09-01')
    vm.updateFormField('endDate_time', '12:00')
    vm.updateFormField('startDate_date', '2026-09-02')

    expect(vm.form).toMatchObject({
      startDate_date: '2026-09-02',
      startDate_time: '10:00',
      endDate_date: '2026-09-02',
      endDate_time: '12:00',
    })
  })

  it('emits saveAndClose without closing the dialog before the save handler runs', async () => {
    const wrapper = mount(TestHost)

    await (wrapper.vm as { saveAndClose: () => Promise<void> }).saveAndClose()

    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('save')?.[0]?.[1]).toBe('saveAndClose')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('adopts a relation mutation version without reinitializing dirty form fields', async () => {
    const initialItem = {
      handle: 42,
      title: 'Dirty local title',
      updatedAt: '2026-08-31T12:00:00.000Z',
    }
    const persistedItem = {
      handle: 42,
      title: 'Persisted title',
      updatedAt: '2026-08-31T12:30:00.000Z',
    }
    const wrapper = mount(TestHost, { props: { item: initialItem } })
    await flushPromises()
    const initializeCallCount = initializeFormMock.mock.calls.length

    relationOptionsState.onPersistedItemUpdated?.(persistedItem)
    await wrapper.setProps({ item: persistedItem })
    await nextTick()

    const itemUpdates = wrapper.emitted('update:item') ?? []
    expect(itemUpdates[itemUpdates.length - 1]).toEqual([persistedItem])
    expect(initializeFormMock).toHaveBeenCalledTimes(initializeCallCount)
  })

  it('reports the invoked save action after every failed validation attempt', async () => {
    validateFormMock.mockResolvedValue({ valid: false, errors: [{ id: 'title' }] })
    const wrapper = mount(TestHost)
    const vm = wrapper.vm as unknown as {
      save: () => Promise<void>
      saveAndClose: () => Promise<void>
      validationFeedback: { action: 'save' | 'saveAndClose'; attempt: number } | null
    }

    await vm.save()

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(vm.validationFeedback).toEqual({ action: 'save', attempt: 1 })

    await vm.saveAndClose()

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(vm.validationFeedback).toEqual({ action: 'saveAndClose', attempt: 2 })
  })

  it('asks for confirmation before cancelling a dirty dialog', async () => {
    const wrapper = mount(TestHost)
    const vm = wrapper.vm as { cancel: () => void; unsavedChangesDialog: boolean }

    vm.cancel()

    expect(vm.unsavedChangesDialog).toBe(true)
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps editing when the unsaved changes prompt is cancelled', async () => {
    const wrapper = mount(TestHost)
    const vm = wrapper.vm as {
      cancel: () => void
      keepEditing: () => void
      unsavedChangesDialog: boolean
    }

    vm.cancel()
    vm.keepEditing()

    expect(vm.unsavedChangesDialog).toBe(false)
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('closes the dialog when dirty changes are discarded', async () => {
    const wrapper = mount(TestHost)
    const vm = wrapper.vm as {
      cancel: () => void
      discardChanges: () => void
      unsavedChangesDialog: boolean
    }

    vm.cancel()
    vm.discardChanges()

    expect(vm.unsavedChangesDialog).toBe(false)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('selects the active default form configuration automatically', async () => {
    listFormConfigsMock.mockResolvedValue([
      {
        handle: 3,
        name: 'Team view',
        entity: 'event',
        scope: 'global',
        isActive: true,
        isDefault: false,
        version: 1,
        config: {
          schema: 'sapling.form-config.v1',
          entityHandle: 'event',
          fields: {
            title: {
              label: 'Team title',
            },
          },
        },
      },
      {
        handle: 7,
        name: 'Default view',
        entity: 'event',
        scope: 'global',
        isActive: true,
        isDefault: true,
        version: 1,
        config: {
          schema: 'sapling.form-config.v1',
          entityHandle: 'event',
          fields: {
            title: {
              label: 'Default title',
            },
          },
        },
      },
    ])

    const wrapper = mount(TestHost, { props: { modelValue: true } })
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      formConfigMenuItems: Array<{ handle: number | null; active: boolean }>
      selectedFormConfigLabel: string
      visibleTemplates: EntityTemplate[]
      selectFormConfig: (handle: number | null) => void
    }

    expect(vm.selectedFormConfigLabel).toBe('Default view')
    expect(vm.formConfigMenuItems.find((item) => item.handle === 7)?.active).toBe(true)
    expect(vm.visibleTemplates[0]?.formConfig?.label).toBe('Default title')
    expect(listFormConfigsMock).toHaveBeenCalledTimes(1)

    vm.selectFormConfig(null)
    await flushPromises()

    expect(vm.selectedFormConfigLabel).toBe('')
    expect(vm.formConfigMenuItems.find((item) => item.handle === null)?.active).toBe(true)
    expect(listFormConfigsMock).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ modelValue: false })
    await nextTick()
    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect(vm.selectedFormConfigLabel).toBe('Default view')
    expect(vm.formConfigMenuItems.find((item) => item.handle === 7)?.active).toBe(true)
  })
})
