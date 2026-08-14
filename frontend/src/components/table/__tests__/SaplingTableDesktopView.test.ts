import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SaplingTableDesktopView from '../SaplingTableDesktopView.vue'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

const VDataTableServerStub = defineComponent({
  props: {
    headers: {
      type: Array,
      default: () => [],
    },
  },
  template: `
    <table>
      <thead>
        <slot
          name="headers"
          :columns="headers"
          :is-sorted="() => false"
          :get-sort-icon="() => ''"
          :toggle-sort="() => undefined"
        />
      </thead>
    </table>
  `,
})

const VCheckboxStub = defineComponent({
  inheritAttrs: true,
  props: {
    modelValue: Boolean,
    indeterminate: Boolean,
    ariaLabel: String,
    title: String,
  },
  emits: ['update:modelValue'],
  template: `
    <input
      type="checkbox"
      :checked="modelValue"
      :data-indeterminate="String(indeterminate)"
      :aria-label="ariaLabel"
      :title="title"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
  `,
})

function mountDesktopTable(selectedRows: number[]) {
  return mount(SaplingTableDesktopView, {
    props: {
      tableKey: 'person',
      items: [{ handle: 1 }, { handle: 2 }],
      totalItems: 2,
      itemsPerPage: 20,
      page: 1,
      isLoading: false,
      sortBy: [],
      visibleHeaders: [{ key: '__select', title: '', name: '__select', type: 'select' }],
      multiSelect: true,
      entity: null,
      entityPermission: null,
      entityTemplates: [],
      entityHandle: 'person',
      rowScriptButtons: [],
      canNavigate: false,
      canShowInformation: false,
      showActions: false,
      selectedRows,
      selectedRow: null,
      isHeaderTranslationLoading: false,
      columnOrderEditing: false,
      getColumnFilterItem: () => null,
      getFilterOperatorOptions: () => [],
      isColumnFilterable: () => false,
    },
    global: {
      stubs: {
        VDataTableServer: VDataTableServerStub,
        VCheckbox: VCheckboxStub,
        VProgressLinear: true,
      },
    },
  })
}

describe('SaplingTableDesktopView page selection', () => {
  it('selects all rows on the current page from the header checkbox', async () => {
    const wrapper = mountDesktopTable([])
    const checkbox = wrapper.get('[data-testid="table-page-selection"]')

    expect(checkbox.attributes('aria-label')).toBe('global.selectAll')

    await checkbox.setValue(true)

    expect(wrapper.emitted('select-all-rows')).toHaveLength(1)
  })

  it('shows a partial selection as indeterminate', () => {
    const wrapper = mountDesktopTable([0])

    expect(
      wrapper.get('[data-testid="table-page-selection"]').attributes('data-indeterminate'),
    ).toBe('true')
  })

  it('clears the current page selection when all rows are selected', async () => {
    const wrapper = mountDesktopTable([0, 1])
    const checkbox = wrapper.get('[data-testid="table-page-selection"]')

    expect(checkbox.attributes('aria-label')).toBe('global.clearSelection')

    await checkbox.setValue(false)

    expect(wrapper.emitted('clear-selection')).toHaveLength(1)
  })
})
