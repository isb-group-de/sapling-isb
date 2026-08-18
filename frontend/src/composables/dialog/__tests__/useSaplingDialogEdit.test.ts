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
    list: listFormConfigsMock,
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
  useSaplingDialogEditRelations: () => ({
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
    selectedRelations: ref({}),
    selectedItems: ref([]),
    addRelation: vi.fn(),
    removeRelation: vi.fn(),
    initializeRelationTables: vi.fn().mockResolvedValue(undefined),
    ensureRelationTableItems: vi.fn().mockResolvedValue(undefined),
    onRelationTablePage: vi.fn(),
    onRelationTableItemsPerPage: vi.fn(),
    onRelationTableSort: vi.fn(),
    onRelationTableColumnFilters: vi.fn(),
    onRelationTableReload: vi.fn(),
    clearSelectedItems: vi.fn(),
    resetRelationTableItems: vi.fn(),
    resetRelationSelections: vi.fn(),
  }),
}))

vi.mock('../useSaplingDialogEditReferences', () => ({
  useSaplingDialogEditReferences: () => ({
    extractDependencyIdentifier: extractDependencyIdentifierMock,
    getReferenceParentFilter: vi.fn(),
    isReferenceDependencyBlocked: vi.fn().mockReturnValue(false),
    isReferenceValueValidForDependency: vi.fn().mockReturnValue(true),
    applyReferenceDependencyParent: applyReferenceDependencyParentMock,
    findSingleReferenceForDependency: findSingleReferenceForDependencyMock,
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
      unsavedChangesDialog: dialog.unsavedChangesDialog,
      formConfigMenuItems: dialog.formConfigMenuItems,
      selectedFormConfigLabel: dialog.selectedFormConfigLabel,
      visibleTemplates: dialog.visibleTemplates,
      form: dialog.form,
      isFieldDisabled: dialog.isFieldDisabled,
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
  })

  it('disables every primary key outside create mode', () => {
    const manualPrimaryKey = {
      name: 'externalId',
      type: 'string',
      isPrimaryKey: true,
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

  it('emits saveAndClose without closing the dialog before the save handler runs', async () => {
    const wrapper = mount(TestHost)

    await (wrapper.vm as { saveAndClose: () => Promise<void> }).saveAndClose()

    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('save')?.[0]?.[1]).toBe('saveAndClose')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
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

    vm.selectFormConfig(null)
    await nextTick()

    expect(vm.selectedFormConfigLabel).toBe('')
    expect(vm.formConfigMenuItems.find((item) => item.handle === null)?.active).toBe(true)

    await wrapper.setProps({ modelValue: false })
    await nextTick()
    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect(vm.selectedFormConfigLabel).toBe('Default view')
    expect(vm.formConfigMenuItems.find((item) => item.handle === 7)?.active).toBe(true)
  })

  it('falls back to the entity standard view when no default form configuration exists', async () => {
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
    ])

    const wrapper = mount(TestHost, { props: { modelValue: true } })
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      formConfigMenuItems: Array<{ handle: number | null; active: boolean }>
      selectedFormConfigLabel: string
      visibleTemplates: EntityTemplate[]
    }

    expect(vm.selectedFormConfigLabel).toBe('')
    expect(vm.formConfigMenuItems.find((item) => item.handle === null)?.active).toBe(true)
    expect(vm.visibleTemplates[0]?.formConfig?.label).toBeUndefined()
  })

  it('uses the raw entity template for standard view even when the default config is selected automatically', async () => {
    findAllMock.mockResolvedValue([
      {
        name: 'title',
        type: 'string',
        formGroup: 'Entity group',
        formOrder: 1,
        formWidth: 4,
      },
    ])
    listFormConfigsMock.mockResolvedValue([
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
              group: 'Default group',
              order: 9,
              width: 1,
            },
          },
        },
      },
    ])

    const wrapper = mount(TestHost, {
      props: {
        modelValue: true,
        templates: [
          {
            name: 'title',
            type: 'string',
            formGroup: 'Default group',
            formOrder: 9,
            formWidth: 1,
            formConfig: {
              label: 'Default title',
              group: 'Default group',
              order: 9,
              width: 1,
            },
          },
        ] as EntityTemplate[],
      },
    })
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      selectedFormConfigLabel: string
      visibleTemplates: EntityTemplate[]
      selectFormConfig: (handle: number | null) => void
    }

    expect(vm.selectedFormConfigLabel).toBe('Default view')
    expect(vm.visibleTemplates[0]?.formConfig?.label).toBe('Default title')
    expect(vm.visibleTemplates[0]?.formGroup).toBe('Default group')

    vm.selectFormConfig(null)
    await nextTick()

    expect(vm.selectedFormConfigLabel).toBe('')
    expect(vm.visibleTemplates[0]?.formConfig?.label).toBeUndefined()
    expect(vm.visibleTemplates[0]?.formGroup).toBe('Entity group')
    expect(vm.visibleTemplates[0]?.formOrder).toBe(1)
    expect(vm.visibleTemplates[0]?.formWidth).toBe(4)
  })

  it('hydrates the form from the current item every time the dialog opens', async () => {
    const firstItem = { handle: 42, title: 'Old title' }
    const currentItem = { handle: 42, title: 'Merged title' }
    const wrapper = mount(TestHost, {
      props: {
        modelValue: false,
        item: firstItem,
      },
    })
    await flushPromises()
    initializeFormMock.mockClear()

    await wrapper.setProps({
      item: currentItem,
      modelValue: true,
    })
    await nextTick()

    expect(initializeFormMock).toHaveBeenCalled()
    expect(initializeFormMock.mock.calls[initializeFormMock.mock.calls.length - 1]?.[0]).toEqual(
      currentItem,
    )
  })

  it('reapplies parent references when a create dialog is reopened from a relation table', async () => {
    const wrapper = mount(TestHost, {
      props: {
        modelValue: false,
        mode: 'create',
        item: null,
        parent: { handle: 7, name: 'Muster GmbH' },
        parentEntity: createEntity('company'),
        entity: createEntity('person'),
      },
    })
    await flushPromises()

    initializeFormMock.mockClear()
    syncParentReferencesMock.mockClear()

    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect(initializeFormMock).toHaveBeenCalled()
    expect(syncParentReferencesMock).toHaveBeenCalled()
    expect(syncParentReferencesMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      initializeFormMock.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('auto-selects one dependent child after a parent change without forcing manual clears', async () => {
    const companyTemplate = {
      name: 'creatorCompany',
      type: 'CompanyItem',
      isReference: true,
      referenceName: 'company',
    } as EntityTemplate
    const contractTemplate = {
      name: 'contract',
      type: 'ContractItem',
      isReference: true,
      referenceName: 'contract',
      referenceDependency: {
        parentField: 'creatorCompany',
        targetField: 'company',
        clearOnParentChange: true,
      },
    } as EntityTemplate
    const typeTemplate = {
      name: 'type',
      type: 'TicketTypeItem',
      isReference: true,
      referenceName: 'ticketType',
    } as EntityTemplate
    const categoryTemplate = {
      name: 'category',
      type: 'TicketCategoryItem',
      isReference: true,
      referenceName: 'ticketCategory',
      referenceDependency: {
        parentField: 'type',
        targetField: 'type',
        clearOnParentChange: true,
      },
    } as EntityTemplate
    const onlyContract = { handle: 31, name: 'Premium support' }
    const onlyCategory = { handle: 'incident', name: 'Incident' }
    const templates = [companyTemplate, contractTemplate, typeTemplate, categoryTemplate]
    findAllMock.mockResolvedValue(templates)
    findSingleReferenceForDependencyMock.mockImplementation((template: EntityTemplate) =>
      Promise.resolve(template.name === 'contract' ? onlyContract : onlyCategory),
    )
    const wrapper = mount(TestHost, {
      props: {
        mode: 'create',
        item: null,
        templates,
      },
    })
    await flushPromises()
    findSingleReferenceForDependencyMock.mockClear()
    const vm = wrapper.vm as unknown as {
      form: SaplingGenericItem
      updateFormField: (key: string, value: unknown) => void
    }

    vm.updateFormField('creatorCompany', { handle: 17, name: 'Example GmbH' })
    await flushPromises()

    expect(findSingleReferenceForDependencyMock).toHaveBeenCalledWith(contractTemplate)
    expect(vm.form.contract).toEqual(onlyContract)

    findSingleReferenceForDependencyMock.mockClear()
    vm.updateFormField('contract', null)
    await flushPromises()

    expect(vm.form.contract).toBeNull()
    expect(findSingleReferenceForDependencyMock).not.toHaveBeenCalled()

    vm.updateFormField('type', { handle: 'incident', name: 'Incident' })
    await flushPromises()

    expect(findSingleReferenceForDependencyMock).toHaveBeenCalledWith(categoryTemplate)
    expect(findSingleReferenceForDependencyMock).not.toHaveBeenCalledWith(contractTemplate)
    expect(vm.form.contract).toBeNull()
  })
})
