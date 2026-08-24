import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { SaplingTableHeaderItem } from '@/entity/structure'
import SaplingTableDesktopView from '../SaplingTableDesktopView.vue'

const { availableTranslationKeys } = vi.hoisted(() => ({
  availableTranslationKeys: new Set<string>(),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      te: (key: string) => availableTranslationKeys.has(key),
    }),
  }
})

const VDataTableServerStub = defineComponent({
  props: {
    headers: {
      type: Array,
      default: () => [],
    },
    items: {
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
      <tbody>
        <slot
          v-for="(item, index) in items"
          :key="item.handle"
          name="item"
          :item="item"
          :index="index"
        />
      </tbody>
    </table>
  `,
})

const SaplingTableRowStub = defineComponent({
  props: {
    item: {
      type: Object,
      required: true,
    },
  },
  template: '<tr><td data-testid="projected-email">{{ item.creatorPersonEmail ?? "" }}</td></tr>',
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

function mountDesktopTable(
  selectedRows: number[],
  items: Array<Record<string, unknown>> = [{ handle: 1 }, { handle: 2 }],
  visibleHeaders: SaplingTableHeaderItem[] = [
    { key: '__select', title: '', name: '__select', type: 'select' },
  ],
) {
  return mount(SaplingTableDesktopView, {
    props: {
      tableKey: 'person',
      items,
      totalItems: items.length,
      itemsPerPage: 20,
      page: 1,
      isLoading: false,
      sortBy: [],
      visibleHeaders,
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
        SaplingTableRow: SaplingTableRowStub,
        SaplingHelpTooltip: {
          props: ['text'],
          template: '<span data-testid="help-tooltip">{{ text }}</span>',
        },
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

  it('rerenders a row when a reloaded projection replaces the same record version', async () => {
    const unchangedVersion = '2026-08-14T12:00:00.000Z'
    const wrapper = mountDesktopTable([], [{ handle: 3, updatedAt: unchangedVersion }])

    expect(wrapper.get('[data-testid="projected-email"]').text()).toBe('')

    await wrapper.setProps({
      items: [
        {
          handle: 3,
          updatedAt: unchangedVersion,
          creatorPersonEmail: 'customer@example.com',
        },
      ],
    })

    expect(wrapper.get('[data-testid="projected-email"]').text()).toBe('customer@example.com')
  })

  it('uses a global field tooltip when the entity has no specific tooltip', () => {
    availableTranslationKeys.add('global.colorTooltip')

    const wrapper = mountDesktopTable(
      [],
      [],
      [{ key: 'color', title: 'Farbe', name: 'color', type: 'string' }],
    )

    expect(wrapper.get('[data-testid="help-tooltip"]').text()).toBe('global.colorTooltip')
    availableTranslationKeys.clear()
  })
})
