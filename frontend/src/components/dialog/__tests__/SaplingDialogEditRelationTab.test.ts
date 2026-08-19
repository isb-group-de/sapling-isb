import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SaplingDialogEditRelationTab from '../SaplingDialogEditRelationTab.vue'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type {
  AccumulatedPermission,
  EntityTemplate,
  SaplingTableHeaderItem,
} from '@/entity/structure'

const { openCreateDialogMock, routerPushMock } = vi.hoisted(() => ({
  openCreateDialogMock: vi.fn(),
  routerPushMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  const translations: Record<string, string> = {
    'company.people': 'People',
    'global.createRecord': 'Create record',
    'kpi.openEntity': 'Open page',
  }

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => translations[key] ?? key,
    }),
  }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

const SaplingTableStub = defineComponent({
  name: 'SaplingTable',
  props: {
    allowDeleteActions: {
      type: Boolean,
      default: true,
    },
  },
  setup(_, { expose }) {
    expose({ openCreateDialog: openCreateDialogMock })
    return () => h('div', { 'data-testid': 'relation-table' })
  },
})

const VBtnStub = defineComponent({
  name: 'VBtn',
  inheritAttrs: false,
  emits: ['click'],
  setup(_, { attrs, emit, slots }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          disabled: attrs.disabled,
          onClick: () => emit('click'),
        },
        slots.default?.(),
      )
  },
})

function mountRelationTab(
  overrides: {
    relationEntity?: EntityItem | null
    entityPermission?: AccumulatedPermission | null
    mode?: 'create' | 'edit' | 'readonly'
    relationKind?: '1:m' | 'm:n'
  } = {},
) {
  const template = {
    key: 'people',
    name: 'people',
    type: 'PersonItem',
    kind: overrides.relationKind ?? 'm:n',
    referenceName: 'person',
    fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: true },
  } as EntityTemplate
  const relationEntity = {
    handle: 'person',
    canInsert: true,
    routes: [{ route: 'table/person' }],
  } as EntityItem
  const entityPermission = {
    entityHandle: 'person',
    allowRead: true,
    allowInsert: true,
  } as AccumulatedPermission

  return mount(SaplingDialogEditRelationTab, {
    props: {
      template,
      mode: overrides.mode ?? 'edit',
      entityHandle: 'company',
      entityLabel: 'Companies',
      item: { handle: 1 } as SaplingGenericItem,
      parentDraft: { name: 'Draft company' } as SaplingGenericItem,
      entity: { handle: 'company' } as EntityItem,
      headers: [] as SaplingTableHeaderItem[],
      items: [],
      search: '',
      page: 1,
      itemsPerPage: 10,
      totalItems: 0,
      isLoading: false,
      sortBy: [],
      columnFilters: {},
      entityTemplates: [],
      relationEntity:
        overrides.relationEntity === undefined ? relationEntity : overrides.relationEntity,
      entityPermission:
        overrides.entityPermission === undefined ? entityPermission : overrides.entityPermission,
      selectedRelations: [],
      selectedItems: [],
      isMutating: false,
      isInitialLoading: false,
    },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        SaplingTable: SaplingTableStub,
        SaplingSelectAddField: { template: '<div data-testid="relation-select-add" />' },
        VCard: { template: '<div><slot /></div>' },
        VCardText: { template: '<div><slot /></div>' },
        VIcon: { template: '<span><slot /></span>' },
        VBtn: VBtnStub,
      },
    },
  })
}

describe('SaplingDialogEditRelationTab', () => {
  beforeEach(() => {
    openCreateDialogMock.mockClear()
    routerPushMock.mockClear()
  })

  it('opens the existing relation table create workflow', async () => {
    const wrapper = mountRelationTab()

    expect(wrapper.getComponent(SaplingTableStub).props('allowDeleteActions')).toBe(false)

    await wrapper.get('[data-testid="relation-create-record"]').trigger('click')

    expect(openCreateDialogMock).toHaveBeenCalledTimes(1)
  })

  it('navigates to the configured relation entity route', async () => {
    const wrapper = mountRelationTab()

    await wrapper.get('[data-testid="relation-open-entity"]').trigger('click')

    expect(routerPushMock).toHaveBeenCalledWith('/table/person')
  })

  it('hides record creation without insert permission while keeping navigation', () => {
    const wrapper = mountRelationTab({
      entityPermission: {
        entityHandle: 'person',
        allowRead: true,
        allowInsert: false,
      } as AccumulatedPermission,
    })

    expect(wrapper.find('[data-testid="relation-create-record"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="relation-open-entity"]').exists()).toBe(true)
  })

  it('allows staging existing relations during create without creating a child record', () => {
    const wrapper = mountRelationTab({ mode: 'create' })

    expect(wrapper.find('[data-testid="relation-select-add"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="relation-create-record"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="relation-open-entity"]').exists()).toBe(true)
  })

  it('opens a deferred child create dialog for 1:m relations during parent creation', async () => {
    const wrapper = mountRelationTab({ mode: 'create', relationKind: '1:m' })

    await wrapper.get('[data-testid="relation-create-record"]').trigger('click')

    expect(openCreateDialogMock).toHaveBeenCalledTimes(1)
  })
})
