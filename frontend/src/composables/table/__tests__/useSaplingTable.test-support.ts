import { mount } from '@vue/test-utils'
import { defineComponent, reactive, type Ref } from 'vue'
import { vi } from 'vitest'

import type { EntityTemplate } from '@/entity/structure'

const {
  apiFindMock,
  apiFindAllMock,
  loadGenericMock,
  fetchCurrentPermissionMock,
  getEntityTemplateMock,
  listFormConfigsMock,
  routeState,
} = vi.hoisted(() => ({
  apiFindMock: vi.fn(),
  apiFindAllMock: vi.fn().mockResolvedValue([]),
  loadGenericMock: vi.fn(),
  fetchCurrentPermissionMock: vi.fn(),
  getEntityTemplateMock: vi.fn(),
  listFormConfigsMock: vi.fn(),
  routeState: { query: {} as Record<string, unknown> },
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: apiFindMock,
    findAll: apiFindAllMock,
  },
}))

vi.mock('@/services/api.template.service', () => ({
  default: {
    getEntityTemplate: getEntityTemplateMock,
  },
}))

vi.mock('@/services/api.form-config.service', () => ({
  default: {
    list: listFormConfigsMock,
  },
}))

vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({
    getState: (key: string) => getMockedEntityState(key),
    loadGeneric: loadGenericMock,
  }),
}))

vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({
    accumulatedPermission: [
      { entityHandle: 'ticketStatus', allowRead: true },
      { entityHandle: 'chipStatus', allowRead: true },
      { entityHandle: 'person', allowRead: true },
      { entityHandle: 'company', allowRead: true },
    ],
    fetchCurrentPermission: fetchCurrentPermissionMock,
  }),
}))

import { useSaplingTable } from '../useSaplingTable'

export type SaplingTableTestState = ReturnType<typeof useSaplingTable>

const entityStates = reactive<Record<string, ReturnType<typeof createEntityState>>>({
  partner: createEntityState([
    createTemplate({
      name: 'name',
      type: 'string',
      options: ['isOrderASC'],
    }),
    createTemplate({
      name: 'status',
      type: 'string',
      kind: 'm:1',
      referenceName: 'ticketStatus',
      referencedPks: ['handle'],
    }),
    createTemplate({
      name: 'amount',
      type: 'number',
    }),
  ]),
  document: createEntityState([
    createTemplate({
      name: 'title',
      type: 'string',
      options: ['isOrderASC'],
    }),
    createTemplate({
      name: 'filename',
      type: 'string',
      tableVisible: false,
    }),
    createTemplate({
      name: 'mimetype',
      type: 'string',
      tableVisible: false,
    }),
  ]),
  contract: createEntityState([
    createTemplate({
      name: 'title',
      type: 'string',
      options: ['isOrderASC'],
    }),
  ]),
  ticket: createEntityState([
    createTemplate({
      name: 'status',
      type: 'string',
      kind: 'm:1',
      referenceName: 'ticketStatus',
      referencedPks: ['handle'],
      options: ['isChip'],
    }),
    createTemplate({
      name: 'deadlineDate',
      type: 'date',
    }),
    createTemplate({
      name: 'assigneePerson',
      type: 'string',
      kind: 'm:1',
      referenceName: 'person',
      referencedPks: ['handle'],
    }),
  ]),
  chipRecord: createEntityState([
    createTemplate({
      name: 'status',
      type: 'string',
      kind: 'm:1',
      referenceName: 'chipStatus',
      referencedPks: ['handle'],
      options: ['isChip'],
    }),
  ]),
  chipStatus: createEntityState([
    createTemplate({
      name: 'title',
      type: 'string',
      options: ['isValue'],
    }),
    createTemplate({
      name: 'color',
      type: 'string',
      options: ['isColor'],
    }),
    createTemplate({
      name: 'icon',
      type: 'string',
      options: ['isIcon'],
    }),
  ]),
  event: createEntityState([
    createTemplate({
      name: 'creatorCompany',
      type: 'string',
      kind: 'm:1',
      referenceName: 'company',
      referencedPks: ['handle'],
    }),
    createTemplate({
      name: 'startDate',
      type: 'datetime',
    }),
    createTemplate({
      name: 'endDate',
      type: 'datetime',
    }),
    createTemplate({
      name: 'isAllDay',
      type: 'boolean',
    }),
  ]),
  company: createEntityState([
    createTemplate({
      name: 'name',
      type: 'string',
      options: ['isValue'],
    }),
    createTemplate({
      name: 'accountManager',
      type: 'PersonItem',
      kind: 'm:1',
      isReference: true,
      referenceName: 'person',
      referencedPks: ['handle'],
    }),
  ]),
  person: createEntityState([
    createTemplate({
      name: 'firstName',
      type: 'string',
      options: ['isValue'],
    }),
    createTemplate({
      name: 'lastName',
      type: 'string',
      options: ['isValue'],
    }),
    createTemplate({
      name: 'company',
      type: 'CompanyItem',
      kind: 'm:1',
      isReference: true,
      referenceName: 'company',
      referencedPks: ['handle'],
      options: ['isValue'],
    }),
  ]),
})

function createTestHost(entityHandle: Ref<string>) {
  return defineComponent({
    setup() {
      return useSaplingTable(entityHandle, 25, false, true)
    },
    template: '<div />',
  })
}

function createQueryEnabledTestHost(entityHandle: Ref<string>) {
  return defineComponent({
    setup() {
      return useSaplingTable(entityHandle, 25, true, true)
    },
    template: '<div />',
  })
}

function createManualTestHost(entityHandle: Ref<string>) {
  return defineComponent({
    setup() {
      return useSaplingTable(entityHandle, 25, false, false)
    },
    template: '<div />',
  })
}

function createAdditionalProjectionTestHost(
  entityHandle: Ref<string>,
  additionalListProjectionFields: string[],
) {
  return defineComponent({
    setup() {
      return useSaplingTable(
        entityHandle,
        25,
        false,
        true,
        undefined,
        additionalListProjectionFields,
      )
    },
    template: '<div />',
  })
}

function createBeforeInitialLoadTestHost(
  entityHandle: Ref<string>,
  beforeInitialLoad: (table: ReturnType<typeof useSaplingTable>) => Promise<void> | void,
) {
  return defineComponent({
    setup() {
      const table = useSaplingTable(entityHandle, 25, false, true, () => ({
        beforeInitialLoad: () => beforeInitialLoad(table),
      }))

      return table
    },
    template: '<div />',
  })
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []

function mountTestHost(entityHandle: Ref<string>) {
  const wrapper = mount(createTestHost(entityHandle))
  mountedWrappers.push(wrapper)
  return wrapper
}

function mountQueryEnabledTestHost(entityHandle: Ref<string>) {
  const wrapper = mount(createQueryEnabledTestHost(entityHandle))
  mountedWrappers.push(wrapper)
  return wrapper
}

function mountManualTestHost(entityHandle: Ref<string>) {
  const wrapper = mount(createManualTestHost(entityHandle))
  mountedWrappers.push(wrapper)
  return wrapper
}

function mountAdditionalProjectionTestHost(
  entityHandle: Ref<string>,
  additionalListProjectionFields: string[],
) {
  const wrapper = mount(
    createAdditionalProjectionTestHost(entityHandle, additionalListProjectionFields),
  )
  mountedWrappers.push(wrapper)
  return wrapper
}

function mountBeforeInitialLoadTestHost(
  entityHandle: Ref<string>,
  beforeInitialLoad: (table: ReturnType<typeof useSaplingTable>) => Promise<void> | void,
) {
  const wrapper = mount(createBeforeInitialLoadTestHost(entityHandle, beforeInitialLoad))
  mountedWrappers.push(wrapper)
  return wrapper
}

export {
  apiFindAllMock,
  apiFindMock,
  loadGenericMock,
  fetchCurrentPermissionMock,
  getEntityTemplateMock,
  listFormConfigsMock,
  routeState,
  mountTestHost,
  mountQueryEnabledTestHost,
  mountManualTestHost,
  mountAdditionalProjectionTestHost,
  mountBeforeInitialLoadTestHost,
}

export function resetTableTestMocks(): void {
  apiFindAllMock.mockReset()
  apiFindAllMock.mockResolvedValue([])
  apiFindMock.mockReset()
  loadGenericMock.mockReset()
  fetchCurrentPermissionMock.mockReset()
  getEntityTemplateMock.mockReset()
  listFormConfigsMock.mockReset()
  routeState.query = {}

  getEntityTemplateMock.mockImplementation((handle: string) =>
    Promise.resolve(getMockedEntityState(handle).entityTemplates),
  )
  listFormConfigsMock.mockResolvedValue([])
}

export function cleanupTableTestWrappers(): void {
  vi.useRealTimers()
  while (mountedWrappers.length > 0) mountedWrappers.pop()?.unmount()
}

function createEntityState(entityTemplates: EntityTemplate[] = []) {
  return {
    entity: null,
    entityPermission: null,
    entityTranslation: {} as never,
    entityTemplates,
    isLoading: false,
    currentEntityName: '',
    currentNamespaces: [],
  }
}

function getMockedEntityState(key: string) {
  return entityStates[key] ?? createEntityState()
}

export function formatLocalDateTimeInput(value: string): string {
  const date = new Date(value)
  return (
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-') +
    `T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  )
}

function createTemplate(
  overrides: Partial<EntityTemplate> & Pick<EntityTemplate, 'name' | 'type'>,
): EntityTemplate {
  return {
    name: overrides.name,
    key: overrides.name,
    title: overrides.name,
    type: overrides.type,
    kind: overrides.kind,
    options: overrides.options ?? [],
    isAutoIncrement: false,
    isPersistent: true,
    tableVisible: overrides.tableVisible ?? true,
    mobileVisible: overrides.mobileVisible ?? false,
    isReference: overrides.isReference ?? false,
    referencedPks: overrides.referencedPks ?? [],
    referenceName: overrides.referenceName,
    length: undefined,
  } as EntityTemplate
}

export function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}
