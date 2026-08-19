import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingFieldSingleSelect from '../SaplingFieldSingleSelect.vue'

const {
  findMock,
  updateMock,
  loadGenericMock,
  getEntityTemplateMock,
  pushMessageMock,
  initializeEntityStateMock,
  loadDataMock,
  useSaplingTableMock,
  tableState,
} = vi.hoisted(() => {
  const makeRef = <T>(value: T) => ({ value })
  return {
    findMock: vi.fn(),
    updateMock: vi.fn(),
    loadGenericMock: vi.fn(),
    getEntityTemplateMock: vi.fn(),
    pushMessageMock: vi.fn(),
    initializeEntityStateMock: vi.fn(),
    loadDataMock: vi.fn(),
    useSaplingTableMock: vi.fn(),
    tableState: {
      items: makeRef<Array<Record<string, unknown>>>([]),
      search: makeRef(''),
      page: makeRef(1),
      itemsPerPage: makeRef(25),
      totalItems: makeRef(0),
      isLoading: makeRef(false),
      sortBy: makeRef<Array<Record<string, unknown>>>([]),
      columnFilters: makeRef({}),
      activeFilter: makeRef(null),
      entityTemplates: makeRef<Array<Record<string, unknown>>>([
        {
          key: 'name',
          name: 'name',
          type: 'string',
          isPersistent: true,
          options: ['isValue'],
        },
        {
          key: 'country',
          name: 'country',
          type: 'CountryItem',
          isPersistent: true,
          isReference: true,
          kind: 'm:1',
          referenceName: 'country',
        },
      ]),
      entity: makeRef({ handle: 'company', icon: null, canRead: true }),
      entityPermission: makeRef({
        entityHandle: 'company',
        allowRead: true,
        allowUpdate: true,
      }),
      parentFilter: makeRef<Record<string, unknown> | null>(null),
      isInitialized: makeRef(true),
    },
  }
})

vi.mock('@/composables/table/useSaplingTable', () => ({
  useSaplingTable: (...args: unknown[]) => {
    useSaplingTableMock(...args)
    return {
      ...tableState,
      initializeEntityState: initializeEntityStateMock,
      loadData: loadDataMock,
      onSearchUpdate: vi.fn(),
      onPageUpdate: vi.fn(),
      onItemsPerPageUpdate: vi.fn(),
      onColumnFiltersUpdate: vi.fn(),
      onSortByUpdate: vi.fn(),
    }
  },
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: findMock,
    update: updateMock,
  },
}))

vi.mock('@/services/api.template.service', () => ({
  default: {
    getEntityTemplate: getEntityTemplateMock,
  },
}))

vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({
    loadGeneric: loadGenericMock,
  }),
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({
    pushMessage: pushMessageMock,
  }),
}))

const VMenuStub = defineComponent({
  name: 'VMenu',
  props: { modelValue: Boolean },
  template: '<div><slot name="activator" :props="{}" /><slot /></div>',
})

const VAutocompleteStub = defineComponent({
  name: 'VAutocomplete',
  props: { modelValue: Object },
  emits: ['update:search', 'update:modelValue', 'focus', 'mousedown:control', 'click:clear'],
  template: '<div />',
})

const VTooltipStub = defineComponent({
  name: 'VTooltip',
  template: '<div><slot name="activator" :props="{}" /></div>',
})

const VBtnStub = defineComponent({
  name: 'VBtn',
  props: { disabled: Boolean, loading: Boolean },
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
})

const SaplingDialogEditStub = defineComponent({
  name: 'SaplingDialogEdit',
  props: {
    modelValue: Boolean,
    mode: String,
    item: Object,
    entity: Object,
    templates: Array,
  },
  emits: ['update:modelValue', 'update:item', 'save', 'deleted'],
  template: '<div data-test="reference-edit-dialog" />',
})

function mountField(
  modelValue: Record<string, unknown> | null = null,
  extraProps: Record<string, unknown> = {},
) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        global: {
          editRecord: 'Edit record',
          recordSaved: 'Saved',
          recordSavedDescription: 'The record was saved.',
        },
      },
    },
  })

  return mount(SaplingFieldSingleSelect, {
    props: {
      label: 'Company',
      entityHandle: 'company',
      modelValue,
      showOpenAction: true,
      openActionLabel: 'Open record',
      ...extraProps,
    },
    global: {
      plugins: [i18n],
      stubs: {
        'v-menu': VMenuStub,
        'v-autocomplete': VAutocompleteStub,
        'v-tooltip': VTooltipStub,
        'v-btn': VBtnStub,
        SaplingTable: true,
        SaplingDialogEdit: SaplingDialogEditStub,
      },
    },
  })
}

describe('SaplingFieldSingleSelect reference dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initializeEntityStateMock.mockResolvedValue(undefined)
    loadDataMock.mockResolvedValue(undefined)
    tableState.parentFilter.value = null
    tableState.isInitialized.value = true
    tableState.entityTemplates.value = [
      {
        key: 'name',
        name: 'name',
        type: 'string',
        isPersistent: true,
        options: ['isValue'],
      },
      {
        key: 'country',
        name: 'country',
        type: 'CountryItem',
        isPersistent: true,
        isReference: true,
        kind: 'm:1',
        referenceName: 'country',
      },
    ]
    tableState.entityPermission.value = {
      entityHandle: 'company',
      allowRead: true,
      allowUpdate: true,
    }
    getEntityTemplateMock.mockResolvedValue([
      {
        key: 'name',
        name: 'name',
        type: 'string',
        isPersistent: true,
        options: ['isValue'],
      },
    ])
  })

  it('keeps the open action disabled until a record is selected', () => {
    const wrapper = mountField()

    expect(wrapper.get('[data-test="open-reference-record"]').attributes('disabled')).toBeDefined()
  })

  it('reapplies the latest dependency filter before the initial dropdown request', async () => {
    const companyFilter = { company: { $eq: 17 } }
    tableState.isInitialized.value = false
    initializeEntityStateMock.mockImplementation(
      async (options: { beforeInitialLoad?: () => Promise<void> | void }) => {
        tableState.parentFilter.value = {}
        await options.beforeInitialLoad?.()
        tableState.isInitialized.value = true
      },
    )
    const wrapper = mountField(null, {
      parentFilter: companyFilter,
      dependencyTargetField: 'company',
    })

    wrapper.getComponent(VAutocompleteStub).vm.$emit('focus')
    await flushPromises()

    expect(initializeEntityStateMock).toHaveBeenCalledTimes(1)
    expect(tableState.parentFilter.value).toEqual(companyFilter)
    expect(useSaplingTableMock.mock.calls[0]?.[5]).toEqual(['company'])
  })

  it('loads the complete reference and opens an edit dialog above the field', async () => {
    const selected = { handle: 'company-1', name: 'Sapling GmbH' }
    const resolved = { ...selected, country: { handle: 'de', name: 'Germany' } }
    findMock.mockResolvedValue({ data: [resolved], meta: { total: 1 } })
    const wrapper = mountField(selected)

    await wrapper.get('[data-test="open-reference-record"]').trigger('click')
    await flushPromises()

    expect(findMock).toHaveBeenCalledWith('company', {
      filter: { handle: 'company-1' },
      limit: 1,
      relations: ['m:1'],
    })
    const dialog = wrapper.getComponent(SaplingDialogEditStub)
    expect(dialog.props('mode')).toBe('edit')
    expect(dialog.props('item')).toEqual(resolved)
  })

  it('hydrates an incomplete nested isValue reference for display without changing the model', async () => {
    tableState.entityTemplates.value = [
      {
        key: 'name',
        name: 'name',
        type: 'string',
        isPersistent: true,
        options: ['isValue'],
      },
      {
        key: 'country',
        name: 'country',
        type: 'CountryItem',
        isPersistent: true,
        isReference: true,
        kind: 'm:1',
        referenceName: 'country',
        referencedPks: ['handle'],
        options: ['isValue'],
      },
    ]
    const selected = { handle: 'company-1', name: 'Sapling GmbH', country: 'de' }
    const hydrated = {
      ...selected,
      country: { handle: 'de', name: 'Germany' },
    }
    findMock.mockResolvedValue({ data: [hydrated], meta: { total: 1 } })

    const wrapper = mountField(selected)
    await flushPromises()

    expect(findMock).toHaveBeenCalledWith('company', {
      filter: { handle: 'company-1' },
      limit: 1,
      relations: ['m:1'],
    })
    expect(wrapper.getComponent(VAutocompleteStub).props('modelValue')).toEqual(hydrated)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('hydrates an identifier-only default before the reference dropdown is opened', async () => {
    tableState.entityTemplates.value = [
      {
        key: 'name',
        name: 'name',
        type: 'string',
        isPersistent: true,
        options: ['isValue'],
      },
    ]
    const hydratedLanguage = { handle: 'de', name: 'Deutsch (Deutschland)' }
    findMock.mockResolvedValue({ data: [hydratedLanguage], meta: { total: 1 } })

    const wrapper = mountField({ handle: 'de' }, { entityHandle: 'language' })
    await flushPromises()

    expect(findMock).toHaveBeenCalledWith(
      'language',
      expect.objectContaining({
        filter: { handle: 'de' },
        limit: 1,
      }),
    )
    expect(wrapper.getComponent(VAutocompleteStub).props('modelValue')).toEqual(hydratedLanguage)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('marks nested value labels as multiline without changing single-line selections', async () => {
    const singleLineWrapper = mountField({ handle: 'company-1', name: 'Sapling GmbH' })

    expect(singleLineWrapper.get('.sapling-field-single-select').classes()).not.toContain(
      'sapling-field-single-select--multiline',
    )

    tableState.entityTemplates.value = [
      {
        key: 'name',
        name: 'name',
        type: 'string',
        isPersistent: true,
        options: ['isValue'],
      },
      {
        key: 'country',
        name: 'country',
        type: 'CountryItem',
        isPersistent: true,
        isReference: true,
        kind: 'm:1',
        referenceName: 'country',
        options: ['isValue'],
      },
    ]
    const multilineWrapper = mountField({
      handle: 'company-2',
      name: 'Sapling AG',
      country: { handle: 'de', name: 'Germany' },
    })
    await flushPromises()

    expect(multilineWrapper.get('.sapling-field-single-select').classes()).toContain(
      'sapling-field-single-select--multiline',
    )
  })

  it('falls back to a read-only dialog without update permission', async () => {
    tableState.entityPermission.value = {
      entityHandle: 'company',
      allowRead: true,
      allowUpdate: false,
    }
    const selected = { handle: 'company-1', name: 'Sapling GmbH' }
    findMock.mockResolvedValue({ data: [selected], meta: { total: 1 } })
    const wrapper = mountField(selected)

    await wrapper.get('[data-test="open-reference-record"]').trigger('click')
    await flushPromises()

    expect(wrapper.getComponent(SaplingDialogEditStub).props('mode')).toBe('readonly')
  })

  it('saves the nested record, refreshes the selected value, and closes on save-and-close', async () => {
    const selected = {
      handle: 'company-1',
      name: 'Sapling GmbH',
      updatedAt: '2026-07-21T08:00:00.000Z',
    }
    const updated = {
      ...selected,
      name: 'Sapling AG',
      updatedAt: '2026-07-21T09:00:00.000Z',
    }
    findMock.mockResolvedValue({ data: [selected], meta: { total: 1 } })
    updateMock.mockResolvedValue(updated)
    const complete = vi.fn()
    const wrapper = mountField(selected)

    await wrapper.get('[data-test="open-reference-record"]').trigger('click')
    await flushPromises()
    wrapper
      .getComponent(SaplingDialogEditStub)
      .vm.$emit('save', { name: 'Sapling AG' }, 'saveAndClose', { complete })
    await flushPromises()
    await nextTick()

    expect(updateMock).toHaveBeenCalledWith(
      'company',
      'company-1',
      { name: 'Sapling AG' },
      expect.objectContaining({
        relations: ['m:1'],
        concurrency: expect.objectContaining({
          expectedUpdatedAt: '2026-07-21T08:00:00.000Z',
          resolution: 'detect',
        }),
      }),
    )
    expect(complete).toHaveBeenCalledWith(true)
    expect(pushMessageMock).toHaveBeenCalledWith(
      'success',
      'Saved',
      'The record was saved.',
      'company',
    )
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(updates[updates.length - 1]?.[0]).toEqual(updated)
    expect(wrapper.findComponent(SaplingDialogEditStub).exists()).toBe(false)
  })

  it('clears the reference when the nested record is deleted', async () => {
    const selected = { handle: 'company-1', name: 'Sapling GmbH' }
    findMock.mockResolvedValue({ data: [selected], meta: { total: 1 } })
    const wrapper = mountField(selected)

    await wrapper.get('[data-test="open-reference-record"]').trigger('click')
    await flushPromises()
    wrapper.getComponent(SaplingDialogEditStub).vm.$emit('deleted', selected)
    await nextTick()

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(updates[updates.length - 1]?.[0]).toBeNull()
    expect(wrapper.findComponent(SaplingDialogEditStub).exists()).toBe(false)
  })

  it('keeps the nested draft open when saving fails', async () => {
    const selected = { handle: 'company-1', name: 'Sapling GmbH' }
    findMock.mockResolvedValue({ data: [selected], meta: { total: 1 } })
    updateMock.mockRejectedValue(new Error('Update failed'))
    const complete = vi.fn()
    const wrapper = mountField(selected)

    await wrapper.get('[data-test="open-reference-record"]').trigger('click')
    await flushPromises()
    wrapper
      .getComponent(SaplingDialogEditStub)
      .vm.$emit('save', { name: 'Sapling AG' }, 'saveAndClose', { complete })
    await flushPromises()

    expect(complete).toHaveBeenCalledWith(false)
    expect(wrapper.findComponent(SaplingDialogEditStub).exists()).toBe(true)
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('closes the reference dropdown when Tab leaves the field', async () => {
    const wrapper = mountField()
    const autocomplete = wrapper.getComponent(VAutocompleteStub)
    const menu = wrapper.getComponent(VMenuStub)

    autocomplete.vm.$emit('focus')
    await nextTick()
    expect(menu.props('modelValue')).toBe(true)

    await wrapper.get('.sapling-field-single-select').trigger('keydown', { key: 'Tab' })

    expect(menu.props('modelValue')).toBe(false)
  })
})
