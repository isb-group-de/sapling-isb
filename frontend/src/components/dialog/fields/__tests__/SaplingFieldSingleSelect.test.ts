import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingFieldSingleSelect from '../SaplingFieldSingleSelect.vue'

const { findMock, updateMock, loadGenericMock, pushMessageMock, tableState } = vi.hoisted(() => {
  const makeRef = <T>(value: T) => ({ value })
  return {
    findMock: vi.fn(),
    updateMock: vi.fn(),
    loadGenericMock: vi.fn(),
    pushMessageMock: vi.fn(),
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
      entityTemplates: makeRef([
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
      parentFilter: makeRef(null),
      isInitialized: makeRef(true),
    },
  }
})

vi.mock('@/composables/table/useSaplingTable', () => ({
  useSaplingTable: () => ({
    ...tableState,
    initializeEntityState: vi.fn(),
    loadData: vi.fn(),
    onSearchUpdate: vi.fn(),
    onPageUpdate: vi.fn(),
    onItemsPerPageUpdate: vi.fn(),
    onColumnFiltersUpdate: vi.fn(),
    onSortByUpdate: vi.fn(),
  }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: findMock,
    update: updateMock,
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

function mountField(modelValue: Record<string, unknown> | null = null) {
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
    tableState.entityPermission.value = {
      entityHandle: 'company',
      allowRead: true,
      allowUpdate: true,
    }
  })

  it('keeps the open action disabled until a record is selected', () => {
    const wrapper = mountField()

    expect(wrapper.get('[data-test="open-reference-record"]').attributes('disabled')).toBeDefined()
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
})
