import { mount } from '@vue/test-utils'
import { focusFieldQuietly } from '@/utils/fieldFocus'
import { computed, defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingFieldSelect from '../SaplingFieldSelect.vue'
import { saplingTableDisplayContextKey } from '@/components/table/saplingTableDisplayContext'

const { loadDataMock, onSearchUpdateMock, tableState } = vi.hoisted(() => {
  const makeRef = <T>(value: T) => ({ value })
  const state = {
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
        name: 'description',
        options: ['isValue'],
      },
    ]),
    entity: makeRef(null),
    entityPermission: makeRef(null),
    parentFilter: makeRef(null),
    isInitialized: makeRef(true),
  }

  const onSearchUpdate = vi.fn((value: string) => {
    state.search.value = value
    state.page.value = 1
  })

  return {
    loadDataMock: vi.fn(),
    onSearchUpdateMock: onSearchUpdate,
    tableState: state,
  }
})

vi.mock('@/composables/table/useSaplingTable', () => ({
  useSaplingTable: () => ({
    ...tableState,
    initializeEntityState: vi.fn(),
    loadData: loadDataMock,
    onSearchUpdate: onSearchUpdateMock,
    onPageUpdate: (value: number) => {
      tableState.page.value = value
    },
    onItemsPerPageUpdate: vi.fn(),
    onColumnFiltersUpdate: vi.fn(),
    onSortByUpdate: vi.fn(),
  }),
}))

vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({
    loadGeneric: vi.fn(),
  }),
}))

const VMenuStub = defineComponent({
  name: 'VMenu',
  props: {
    modelValue: Boolean,
    width: String,
    maxWidth: String,
    maxHeight: String,
    location: String,
    scrollStrategy: String,
  },
  template: '<div><slot name="activator" :props="{}" /><slot /></div>',
})

const VAutocompleteStub = defineComponent({
  name: 'VAutocomplete',
  props: {
    search: String,
  },
  emits: [
    'update:search',
    'update:focused',
    'update:modelValue',
    'focus',
    'mousedown:control',
    'click:clear',
    'click:append-inner',
  ],
  template: '<div><input /><slot name="append-inner" /></div>',
})

const SaplingTableStub = defineComponent({
  name: 'SaplingTable',
  props: {
    disableMobileView: Boolean,
    multiSelect: Boolean,
    showToolbar: Boolean,
    allowRowDoubleClick: Boolean,
  },
  emits: ['update:selected', 'update:page'],
  template:
    '<div><button class="sapling-table-row" data-test="result-row-1" /><button class="sapling-table-row" data-test="result-row-2" /></div>',
})

function mountSelectField(
  modelValue: Array<Record<string, unknown>> = [],
  options: { parentIsMobileTable?: boolean } = {},
) {
  return mount(SaplingFieldSelect, {
    props: {
      label: 'Batches',
      entityHandle: 'batch',
      modelValue,
    },
    global: {
      stubs: {
        'v-menu': VMenuStub,
        'v-autocomplete': VAutocompleteStub,
        'v-btn': {
          template: '<button v-bind="$attrs"><slot /></button>',
        },
        'v-icon': {
          template: '<span><slot /></span>',
        },
        SaplingTable: SaplingTableStub,
      },
      provide:
        options.parentIsMobileTable === undefined
          ? {}
          : {
              [saplingTableDisplayContextKey as symbol]: {
                isMobileTable: computed(() => options.parentIsMobileTable === true),
              },
            },
    },
  })
}

describe('SaplingFieldSelect', () => {
  beforeEach(() => {
    onSearchUpdateMock.mockClear()
    tableState.items.value = []
    tableState.search.value = ''
  })

  it('keeps initial focus closed but opens on click and subsequent focus', async () => {
    const wrapper = mountSelectField()
    document.body.appendChild(wrapper.element)
    const autocomplete = wrapper.findComponent(VAutocompleteStub)
    const input = autocomplete.get('input').element as HTMLInputElement
    input.addEventListener('focus', (event) => autocomplete.vm.$emit('focus', event))
    try {
      focusFieldQuietly(input)
      await nextTick()
      expect(wrapper.findComponent(SaplingTableStub).exists()).toBe(false)
      await autocomplete.vm.$emit('mousedown:control', new MouseEvent('mousedown'))
      expect(wrapper.findComponent(SaplingTableStub).exists()).toBe(true)
      await wrapper
        .findComponent({ name: 'SaplingFieldTablePicker' })
        .vm.$emit('update:modelValue', false)
      input.blur()
      input.focus()
      await nextTick()
      expect(wrapper.findComponent(SaplingTableStub).exists()).toBe(true)
    } finally {
      const element = wrapper.element
      wrapper.unmount()
      element.remove()
    }
  })

  it('keeps the typed search when a selected chip label is emitted as autocomplete search', async () => {
    const wrapper = mountSelectField()

    const autocomplete = wrapper.findComponent(VAutocompleteStub)
    await autocomplete.vm.$emit('update:focused', true)
    await autocomplete.vm.$emit('update:search', 'bat')

    expect(onSearchUpdateMock).toHaveBeenLastCalledWith('bat')
    expect(tableState.search.value).toBe('bat')

    const selectedBatch = { handle: 'batch-1', description: 'Batch 1' }
    await wrapper.find('.sapling-menu-surface').trigger('mousedown')
    await autocomplete.vm.$emit('update:search', '')
    await wrapper.findComponent(SaplingTableStub).vm.$emit('update:selected', [selectedBatch])
    await autocomplete.vm.$emit('update:search', 'Batch 1')

    expect(onSearchUpdateMock).toHaveBeenCalledTimes(1)
    expect(tableState.search.value).toBe('bat')
    const modelValueEvents = wrapper.emitted('update:modelValue') ?? []
    expect(modelValueEvents[modelValueEvents.length - 1]?.[0]).toEqual([selectedBatch])

    await autocomplete.vm.$emit('update:search', 'Batch 1')

    expect(onSearchUpdateMock).toHaveBeenLastCalledWith('Batch 1')
    expect(tableState.search.value).toBe('Batch 1')
  })

  it.each(['mouse', 'keyboard'])(
    'preserves search while moving focus to the table by %s and allows clearing it afterwards',
    async (navigation) => {
      const wrapper = mountSelectField()
      const input = wrapper.getComponent(VAutocompleteStub)
      await input.vm.$emit('focus')
      await input.vm.$emit('update:focused', true)
      await input.vm.$emit('update:search', 'bat')
      if (navigation === 'mouse') await wrapper.find('.sapling-menu-surface').trigger('mousedown')
      await input.vm.$emit('update:focused', false)
      await input.vm.$emit('update:search', '')
      await wrapper.getComponent(SaplingTableStub).vm.$emit('update:page', 2)
      expect(tableState.search.value).toBe('bat')
      expect(tableState.page.value).toBe(2)

      await input.vm.$emit('update:focused', true)
      await input.get('input').setValue('')
      expect(tableState.search.value).toBe('')
      expect(tableState.page.value).toBe(1)
      wrapper.unmount()
    },
  )

  it('keeps selections that are not part of the currently filtered table items', async () => {
    const existingBatch = { handle: 'batch-1', description: 'Batch 1' }
    const filteredBatch = { handle: 'batch-2', description: 'Batch 2' }
    tableState.items.value = [filteredBatch]

    const wrapper = mountSelectField([existingBatch])
    await wrapper.findComponent(VAutocompleteStub).vm.$emit('focus')

    await wrapper.findComponent(SaplingTableStub).vm.$emit('update:selected', [filteredBatch])
    await nextTick()

    const modelValueEvents = wrapper.emitted('update:modelValue') ?? []
    expect(modelValueEvents[modelValueEvents.length - 1]?.[0]).toEqual([
      existingBatch,
      filteredBatch,
    ])
  })

  it('keeps the dropdown table in desktop mode while the parent table is desktop', async () => {
    const wrapper = mountSelectField([], { parentIsMobileTable: false })

    await wrapper.findComponent(VAutocompleteStub).vm.$emit('focus')

    expect(wrapper.findComponent(SaplingTableStub).props('disableMobileView')).toBe(true)
  })

  it('hides the dropdown toolbar without disabling multi-selection', async () => {
    const wrapper = mountSelectField()

    await wrapper.findComponent(VAutocompleteStub).vm.$emit('focus')

    const table = wrapper.findComponent(SaplingTableStub)
    expect(table.props('showToolbar')).toBe(false)
    expect(table.props('multiSelect')).toBe(true)
    expect(table.props('allowRowDoubleClick')).toBe(false)
  })

  it('keeps nested header blur outside the menu backdrop root', () => {
    expect(mountSelectField().find('.sapling-menu-surface').classes()).toContain(
      'sapling-nested-backdrop-host',
    )
  })

  it('constrains and repositions the dropdown within zoomed viewports', () => {
    const menu = mountSelectField().findComponent(VMenuStub)

    expect(menu.props()).toMatchObject({
      width: 'min(600px, calc(100vw - 2rem))',
      maxWidth: 'min(600px, calc(100vw - 2rem))',
      maxHeight: '400px',
      location: 'bottom start',
      scrollStrategy: 'reposition',
    })
  })

  it('opens and closes the dropdown from the same toggle button', async () => {
    const wrapper = mountSelectField()
    const menu = wrapper.findComponent(VMenuStub)
    const toggle = wrapper.get('[data-testid="toggle-reference-menu"]')

    expect(menu.props('modelValue')).toBe(false)

    await toggle.trigger('click')
    expect(menu.props('modelValue')).toBe(true)

    await toggle.trigger('click')
    expect(menu.props('modelValue')).toBe(false)
  })

  it('closes the dropdown on Tab and when focus moves to another field', async () => {
    const wrapper = mountSelectField()
    const autocomplete = wrapper.findComponent(VAutocompleteStub)
    const menu = wrapper.findComponent(VMenuStub)

    await autocomplete.vm.$emit('focus')
    expect(menu.props('modelValue')).toBe(true)

    await wrapper.get('.sapling-field-table-picker').trigger('keydown', { key: 'Tab' })
    expect(menu.props('modelValue')).toBe(false)

    await autocomplete.vm.$emit('focus')
    const nextField = document.createElement('input')
    await wrapper
      .get('.sapling-field-table-picker')
      .trigger('focusout', { relatedTarget: nextField })

    await vi.waitFor(() => expect(menu.props('modelValue')).toBe(false))
  })

  it('keeps the dropdown open when focus moves into its menu surface', async () => {
    const wrapper = mountSelectField()
    const autocomplete = wrapper.findComponent(VAutocompleteStub)
    const menu = wrapper.findComponent(VMenuStub)
    const menuSurface = wrapper.get('.sapling-menu-surface')

    await autocomplete.vm.$emit('focus')
    await wrapper
      .get('.sapling-field-table-picker')
      .trigger('focusout', { relatedTarget: menuSurface.element })

    expect(menu.props('modelValue')).toBe(true)
  })

  it('moves keyboard focus from the input into the first result row', async () => {
    const wrapper = mountSelectField()
    const autocomplete = wrapper.findComponent(VAutocompleteStub)
    await autocomplete.vm.$emit('focus')
    await nextTick()
    const firstRow = wrapper.get('[data-test="result-row-1"]')
    const focusSpy = vi.spyOn(firstRow.element as HTMLButtonElement, 'focus')

    await autocomplete.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })
})
