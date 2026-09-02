import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColumnFilterItem, EntityTemplate } from '@/entity/structure'
import type {
  SaplingChipFilterGroup,
  SaplingFilterHandle,
} from '@/components/filter/saplingWorkFilter.types'

const mocks = vi.hoisted(() => ({
  tableReturn: undefined as unknown,
  chipReturn: undefined as unknown,
  routeQuery: {} as Record<string, string | undefined>,
  beforeInitialLoad: undefined as (() => Promise<void> | void) | undefined,
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
}))

vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({
    person: { handle: 1 },
    fetchCurrentPerson: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/composables/table/useSaplingTable', () => ({
  useSaplingTable: (...args: unknown[]) => {
    const optionsFactory = args[4] as
      (() => { beforeInitialLoad?: () => Promise<void> | void }) | undefined
    mocks.beforeInitialLoad = optionsFactory?.().beforeInitialLoad
    return mocks.tableReturn
  },
}))

vi.mock('@/composables/filter/useSaplingChipFilters', () => ({
  useSaplingChipFilters: () => mocks.chipReturn,
}))

import {
  arePartnerColumnFiltersEqual,
  buildChipColumnFilterFromSelection,
  combinePartnerFilters,
  extractPartnerHandlesFromFilter,
  getChipSelectionFromColumnFilter,
  useSaplingPartner,
} from './useSaplingPartner'

type MockTableReturn = {
  columnFilters: Ref<Record<string, ColumnFilterItem>>
  entityTemplates: Ref<EntityTemplate[]>
  parentFilter: Ref<Record<string, unknown>>
  isInitialized: Ref<boolean>
  deletePersonalFormConfig: ReturnType<typeof vi.fn>
}

type MockChipReturn = {
  chipFilters: Ref<SaplingChipFilterGroup[]>
  selectedChipFilters: Ref<Record<string, SaplingFilterHandle[]>>
  loadChipFilters: ReturnType<typeof vi.fn>
}

let tableReturn: MockTableReturn
let chipReturn: MockChipReturn

beforeEach(() => {
  mocks.routeQuery = {}
  mocks.beforeInitialLoad = undefined
  tableReturn = createMockTableReturn()
  chipReturn = createMockChipReturn()
  mocks.tableReturn = tableReturn
  mocks.chipReturn = chipReturn
})

describe('useSaplingPartner filter synchronization helpers', () => {
  it('stores partial chip selections as table column filters and treats full selections as unfiltered', () => {
    const statusFilter = createChipFilter()

    expect(buildChipColumnFilterFromSelection(statusFilter, ['open', 'waiting'])).toEqual({
      operator: 'eq',
      value: '',
      relationItems: [{ handle: 'open' }, { handle: 'waiting' }],
    })

    expect(
      buildChipColumnFilterFromSelection(statusFilter, [
        'closed',
        'in_progress',
        'open',
        'waiting',
      ]),
    ).toBeNull()
  })

  it('keeps an empty chip selection as an explicit no-match filter', () => {
    expect(buildChipColumnFilterFromSelection(createChipFilter(), [])).toEqual({
      operator: 'eq',
      value: '',
      relationItems: [{ handle: '__sapling_empty_chip_filter__' }],
    })
  })

  it('hydrates chip selections from table column filters', () => {
    const statusFilter = createChipFilter()

    expect(getChipSelectionFromColumnFilter(statusFilter)).toEqual([
      'closed',
      'in_progress',
      'open',
      'waiting',
    ])

    expect(
      getChipSelectionFromColumnFilter(statusFilter, {
        operator: 'nin',
        value: '',
        relationItems: [{ handle: 'closed' }],
      }),
    ).toEqual(['in_progress', 'open', 'waiting'])
  })

  it('extracts partner person handles from favorite-style URL filters', () => {
    const templates = [
      createPartnerTemplate('assigneePerson'),
      createPartnerTemplate('creatorPerson'),
      createPartnerTemplate('observerPerson'),
    ]

    expect(
      extractPartnerHandlesFromFilter(
        {
          $and: [
            { status: { handle: { $in: ['open'] } } },
            {
              $or: [
                { assigneePerson: { $in: [1] } },
                { creatorPerson: { handle: { $in: [1, '2'] } } },
              ],
            },
          ],
        },
        templates,
      ),
    ).toEqual([1, 2])
  })

  it('does not duplicate an already restored partner filter', () => {
    const restoredFilter = {
      $or: [{ assigneePerson: { $in: [1] } }, { creatorPerson: { $in: [1] } }],
    }

    expect(combinePartnerFilters(restoredFilter, { ...restoredFilter })).toEqual(restoredFilter)
  })

  it('treats chip column filters with the same relation handles as equal', () => {
    expect(
      arePartnerColumnFiltersEqual(
        {
          status: {
            operator: 'eq',
            value: '',
            relationItems: [{ handle: 'open' }, { handle: 'waiting' }],
          },
        },
        {
          status: {
            operator: 'eq',
            value: '',
            relationItems: [{ handle: 'waiting' }, { handle: 'open' }],
          },
        },
      ),
    ).toBe(true)
  })
})

describe('useSaplingPartner chip filter hydration', () => {
  it('keeps url-restored chip column filters when chip filter defaults load', async () => {
    mount(
      defineComponent({
        setup() {
          return useSaplingPartner(ref('ticket'))
        },
        template: '<div />',
      }),
    )

    tableReturn.isInitialized.value = true
    await nextTick()
    await flushPromises()
    await nextTick()

    expect(tableReturn.columnFilters.value.priority).toEqual({
      operator: 'eq',
      value: '',
      relationItems: [{ handle: 'high' }],
    })
    expect(chipReturn.selectedChipFilters.value.priority).toEqual(['high'])
  })
})

describe('useSaplingPartner initial person filter', () => {
  it('does not add the current person when a worklist supplies an explicit filter', async () => {
    mocks.routeQuery = {
      filter: JSON.stringify({ status: { handle: 'open' } }),
    }
    tableReturn.entityTemplates.value = [createPartnerTemplate('assigneePerson')]
    tableReturn.parentFilter.value = { status: { handle: 'open' } }

    const subject = useSaplingPartner(ref('ticket'))
    await mocks.beforeInitialLoad?.()

    expect(subject.selectedPeopleHandles.value).toEqual([])
    expect(tableReturn.parentFilter.value).toEqual({ status: { handle: 'open' } })
  })

  it('keeps the current person default for direct partner navigation', async () => {
    tableReturn.entityTemplates.value = [
      createPartnerTemplate('assigneePerson'),
      createPartnerTemplate('creatorPerson'),
    ]

    const subject = useSaplingPartner(ref('ticket'))
    await mocks.beforeInitialLoad?.()

    expect(subject.selectedPeopleHandles.value).toEqual([1])
    expect(tableReturn.parentFilter.value).toEqual({
      $or: [{ assigneePerson: { $in: [1] } }, { creatorPerson: { $in: [1] } }],
    })
  })

  it('does not reapply a stale person filter while a worklist route is initializing', async () => {
    let completeChipHydration: (() => void) | undefined
    chipReturn.loadChipFilters = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeChipHydration = resolve
        }),
    )
    tableReturn.entityTemplates.value = [
      createPartnerTemplate('assigneePerson'),
      createPartnerTemplate('creatorPerson'),
    ]

    const subject = useSaplingPartner(ref('ticket'))
    await mocks.beforeInitialLoad?.()
    tableReturn.isInitialized.value = true
    await nextTick()

    mocks.routeQuery.filter = JSON.stringify({
      $and: [{ status: { handle: { $in: ['open', 'qualify'] } } }, { assigneePerson: null }],
    })
    tableReturn.parentFilter.value = {}
    completeChipHydration?.()
    await flushPromises()
    await mocks.beforeInitialLoad?.()

    expect(subject.selectedPeopleHandles.value).toEqual([])
    expect(tableReturn.parentFilter.value).toEqual({})
  })
})

describe('useSaplingPartner table-view actions', () => {
  it('exposes personal table-view deletion to the partner workspace', async () => {
    const subject = useSaplingPartner(ref('ticket'))

    await subject.deletePersonalFormConfig(17)

    expect(tableReturn.deletePersonalFormConfig).toHaveBeenCalledWith(17)
  })
})

function createChipFilter(): SaplingChipFilterGroup {
  return {
    key: 'status',
    fieldName: 'status',
    referenceName: 'ticketStatus',
    label: 'Status',
    options: [
      { handle: 'closed', label: 'Geschlossen' },
      { handle: 'in_progress', label: 'In Bearbeitung' },
      { handle: 'open', label: 'Offen' },
      { handle: 'waiting', label: 'Wartend' },
    ],
  }
}

function createPartnerTemplate(name: string): EntityTemplate {
  return {
    name,
    key: name,
    title: name,
    type: 'string',
    kind: 'm:1',
    options: ['isPartner'],
    isAutoIncrement: false,
    isPersistent: true,
    isReference: true,
    referenceName: 'person',
  } as EntityTemplate
}

function createPriorityTemplate(): EntityTemplate {
  return {
    name: 'priority',
    key: 'priority',
    title: 'priority',
    type: 'string',
    kind: 'm:1',
    options: ['isChip'],
    isAutoIncrement: false,
    isPersistent: true,
    isReference: true,
    referenceName: 'ticketPriority',
  } as EntityTemplate
}

function createPriorityChipFilter(): SaplingChipFilterGroup {
  return {
    key: 'priority',
    fieldName: 'priority',
    referenceName: 'ticketPriority',
    label: 'Priority',
    options: [
      { handle: 'low', label: 'Low' },
      { handle: 'medium', label: 'Medium' },
      { handle: 'high', label: 'High' },
    ],
  }
}

function createMockTableReturn() {
  const columnFilters = ref<Record<string, ColumnFilterItem>>({
    priority: {
      operator: 'eq',
      value: '',
      relationItems: [{ handle: 'high' }],
    },
  })

  return {
    items: ref([]),
    search: ref(''),
    page: ref(1),
    itemsPerPage: ref(25),
    totalItems: ref(0),
    isLoading: ref(false),
    sortBy: ref([]),
    columnFilters,
    activeFilter: ref({}),
    entityTemplates: ref([createPriorityTemplate()]),
    entity: ref(null),
    entityPermission: ref(null),
    parentFilter: ref({}),
    isInitialized: ref(false),
    loadData: vi.fn(),
    onSearchUpdate: vi.fn(),
    onPageUpdate: vi.fn(),
    onItemsPerPageUpdate: vi.fn(),
    onColumnFiltersUpdate: vi.fn(),
    onSortByUpdate: vi.fn(),
    deletePersonalFormConfig: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockChipReturn() {
  const chipFilters = ref<SaplingChipFilterGroup[]>([])
  const selectedChipFilters = ref<Record<string, Array<string | number>>>({})

  return {
    chipFilters,
    selectedChipFilters,
    selectedChipFilterCount: ref(0),
    loadChipFilters: vi.fn(async () => {
      chipFilters.value = [createPriorityChipFilter()]
      selectedChipFilters.value = {
        priority: ['low', 'medium', 'high'],
      }
    }),
    clearChipFilters: vi.fn(),
    onSelectedChipFiltersUpdate: vi.fn((values: Record<string, Array<string | number>>) => {
      selectedChipFilters.value = values
    }),
  }
}
