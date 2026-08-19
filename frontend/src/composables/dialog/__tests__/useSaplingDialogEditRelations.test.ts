import { computed, ref, reactive } from 'vue'
import { describe, expect, it, beforeEach, vi } from 'vitest'

import type {
  AccumulatedPermission,
  DialogSaveContext,
  DialogState,
  EntityState,
  EntityTemplate,
} from '@/entity/structure'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'

const { apiCreateMock, apiFindMock, apiUpdateMock, loadGenericManyMock } = vi.hoisted(() => ({
  apiCreateMock: vi.fn(),
  apiFindMock: vi.fn(),
  apiUpdateMock: vi.fn(),
  loadGenericManyMock: vi.fn(),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    create: apiCreateMock,
    find: apiFindMock,
    update: apiUpdateMock,
  },
}))

vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({
    getState: (key: string) => getMockedEntityState(key),
    loadGenericMany: loadGenericManyMock,
  }),
}))

import { useSaplingDialogEditRelations } from '../useSaplingDialogEditRelations'

const entityStates = reactive<Record<string, EntityState>>({
  note: createEntityState('note', [
    createTemplate({
      name: 'title',
      type: 'string',
    }),
  ]),
  event: createEntityState('event', [
    createTemplate({
      name: 'subject',
      type: 'string',
    }),
  ]),
  effortEstimatePosition: createEntityState('effortEstimatePosition', [
    createTemplate({ name: 'title', type: 'string', options: ['isValue'], tableVisible: true }),
    createTemplate({
      name: 'estimate',
      type: 'EffortEstimateItem',
      kind: 'm:1',
      isReference: true,
      referenceName: 'effortEstimate',
      tableVisible: true,
    }),
  ]),
  effortEstimate: createEntityState('effortEstimate', [
    createTemplate({ name: 'title', type: 'string', options: ['isValue'] }),
    createTemplate({
      name: 'status',
      type: 'EffortEstimateStatusItem',
      kind: 'm:1',
      isReference: true,
      referenceName: 'effortEstimateStatus',
      options: ['isValue'],
    }),
    createTemplate({
      name: 'assigneeCompany',
      type: 'CompanyItem',
      kind: 'm:1',
      isReference: true,
      referenceName: 'company',
      options: ['isValue'],
    }),
  ]),
  effortEstimateStatus: createEntityState('effortEstimateStatus', [
    createTemplate({ name: 'description', type: 'string', options: ['isValue'] }),
  ]),
  company: createEntityState('company', [
    createTemplate({ name: 'name', type: 'string', options: ['isValue'] }),
  ]),
})

describe('useSaplingDialogEditRelations', () => {
  beforeEach(() => {
    apiCreateMock.mockReset()
    apiFindMock.mockReset()
    apiUpdateMock.mockReset()
    loadGenericManyMock.mockReset()
    loadGenericManyMock.mockResolvedValue(undefined)
    apiUpdateMock.mockResolvedValue({})
    apiCreateMock.mockResolvedValue({ handle: 101 })
    apiFindMock.mockResolvedValue({
      data: [{ handle: 1, title: 'First note' }],
      meta: { total: 1 },
    })
  })

  it('initializes relation metadata without loading relation table rows', async () => {
    const relations = createRelations()

    await relations.initializeRelationTables()

    expect(loadGenericManyMock).toHaveBeenCalledWith([
      { entityHandle: 'note', namespaces: ['global'] },
      { entityHandle: 'event', namespaces: ['global'] },
    ])
    expect(apiFindMock).not.toHaveBeenCalled()
    expect(relations.relationTableItems.value.notes).toEqual([])
    expect(relations.relationTableTotal.value.notes).toBe(0)
    expect(relations.relationTableLoaded.value.notes).toBe(false)
  })

  it('loads a relation table once when that tab is requested', async () => {
    const relations = createRelations()
    await relations.initializeRelationTables()

    await relations.ensureRelationTableItems('notes')
    await relations.ensureRelationTableItems('notes')

    expect(apiFindMock).toHaveBeenCalledTimes(1)
    expect(apiFindMock).toHaveBeenCalledWith(
      'note',
      expect.objectContaining({
        filter: { ticket: 42 },
        page: 1,
      }),
    )
    expect(relations.relationTableItems.value.notes).toEqual([{ handle: 1, title: 'First note' }])
    expect(relations.relationTableTotal.value.notes).toBe(1)
    expect(relations.relationTableLoaded.value.notes).toBe(true)
  })

  it('loads relation table rows in readonly mode for persisted records', async () => {
    const relations = createRelations({ mode: 'readonly' })
    await relations.initializeRelationTables()

    await relations.ensureRelationTableItems('notes')

    expect(apiFindMock).toHaveBeenCalledTimes(1)
    expect(apiFindMock).toHaveBeenCalledWith(
      'note',
      expect.objectContaining({
        filter: { ticket: 42 },
        page: 1,
      }),
    )
  })

  it('loads nested value references for labels in embedded relation tables', async () => {
    const relations = createRelations({
      templates: [
        createTemplate({
          name: 'positions',
          type: 'Collection<EffortEstimatePositionItem>',
          kind: '1:m',
          referenceName: 'effortEstimatePosition',
          mappedBy: 'estimate',
        }),
      ],
      permissions: ['effortEstimatePosition', 'effortEstimate', 'effortEstimateStatus', 'company'],
    })

    await relations.initializeRelationTables()
    await relations.ensureRelationTableItems('positions')

    expect(loadGenericManyMock).toHaveBeenNthCalledWith(2, [
      { entityHandle: 'effortEstimate', namespaces: ['global'] },
    ])
    expect(loadGenericManyMock).toHaveBeenNthCalledWith(3, [
      { entityHandle: 'effortEstimateStatus', namespaces: ['global'] },
      { entityHandle: 'company', namespaces: ['global'] },
    ])
    expect(apiFindMock).toHaveBeenCalledWith(
      'effortEstimatePosition',
      expect.objectContaining({
        relations: ['estimate', 'estimate.status', 'estimate.assigneeCompany'],
      }),
    )
  })

  it('keeps the initialized layout visible while a loaded relation refreshes', async () => {
    const relations = createRelations()
    await relations.initializeRelationTables()
    await relations.ensureRelationTableItems('notes')
    const deferred = createDeferred<{
      data: SaplingGenericItem[]
      meta: { total: number }
    }>()
    apiFindMock.mockReturnValueOnce(deferred.promise)

    const refreshPromise = relations.loadRelationTableItems(['notes'])

    expect(relations.relationTableLoaded.value.notes).toBe(true)
    expect(relations.relationTableState.value.notes?.isLoading).toBe(true)

    deferred.resolve({
      data: [{ handle: 2, title: 'Refreshed note' }],
      meta: { total: 1 },
    })
    await refreshPromise

    expect(relations.relationTableItems.value.notes).toEqual([
      { handle: 2, title: 'Refreshed note' },
    ])
  })

  it('does not load relation table rows while creating a new record', async () => {
    const relations = createRelations({ mode: 'create' })
    await relations.initializeRelationTables()

    await relations.ensureRelationTableItems('notes')

    expect(apiFindMock).not.toHaveBeenCalled()
    expect(relations.relationTableItems.value.notes).toEqual([])
    expect(relations.relationTableTotal.value.notes).toBe(0)
  })

  it('stages and removes 1:m relations locally while creating a record', async () => {
    const relations = createRelations({ mode: 'create' })
    const selected = { handle: 7, title: 'Existing note' }
    relations.selectedRelations.value.notes = [selected, selected]

    await relations.addRelation(relations.relationTemplates.value[0])

    expect(apiUpdateMock).not.toHaveBeenCalled()
    expect(relations.relationTableItems.value.notes).toEqual([selected])
    expect(relations.hasPendingRelationChanges.value).toBe(true)
    expect(relations.dirtyRelationNames.value).toEqual(['notes'])

    await relations.removeRelation(relations.relationTemplates.value[0], [selected])

    expect(apiUpdateMock).not.toHaveBeenCalled()
    expect(relations.relationTableItems.value.notes).toEqual([])
    expect(relations.hasPendingRelationChanges.value).toBe(false)
    expect(relations.dirtyRelationNames.value).toEqual([])
  })

  it('includes staged m:n handles in the initial create payload', async () => {
    const relations = createRelations({
      mode: 'create',
      templates: [
        createTemplate({
          name: 'watchers',
          type: 'Collection<PersonItem>',
          kind: 'm:n',
          referenceName: 'note',
        }),
      ],
    })
    relations.selectedRelations.value.watchers = [
      { handle: 4, title: 'Ada' },
      { handle: 5, title: 'Grace' },
    ]

    await relations.addRelation(relations.relationTemplates.value[0])

    expect(relations.appendPendingRelationsToPayload({ title: 'Draft' })).toEqual({
      title: 'Draft',
      watchers: [4, 5],
    })
  })

  it('persists staged 1:m relations after the parent receives its handle', async () => {
    const relations = createRelations({ mode: 'create' })
    relations.selectedRelations.value.notes = [
      { handle: 7, title: 'First' },
      { handle: 8, title: 'Second' },
    ]
    await relations.addRelation(relations.relationTemplates.value[0])

    await expect(relations.persistPendingRelations(99)).resolves.toBe(true)

    expect(apiUpdateMock).toHaveBeenNthCalledWith(1, 'note', 7, { ticket: 99 })
    expect(apiUpdateMock).toHaveBeenNthCalledWith(2, 'note', 8, { ticket: 99 })
    expect(relations.relationTableItems.value.notes).toEqual([])
  })

  it('creates staged new 1:m records after the parent receives its handle', async () => {
    const relations = createRelations({ mode: 'create' })
    const persistNestedRelations = vi.fn().mockResolvedValue(true)
    const context = {
      persistPendingRelations: persistNestedRelations,
      complete: vi.fn(),
    } as DialogSaveContext

    relations.stageNewRelationRecord(
      relations.relationTemplates.value[0],
      { title: 'New note', ticket: '__sapling_pending_parent__' },
      context,
    )

    expect(relations.relationTableItems.value.notes).toEqual([
      expect.objectContaining({ title: 'New note' }),
    ])
    expect(relations.hasPendingRelationChanges.value).toBe(true)

    await expect(relations.persistPendingRelations(99)).resolves.toBe(true)

    expect(apiCreateMock).toHaveBeenCalledWith('note', {
      title: 'New note',
      ticket: 99,
    })
    expect(apiUpdateMock).not.toHaveBeenCalled()
    expect(persistNestedRelations).toHaveBeenCalledWith(101)
    expect(relations.relationTableItems.value.notes).toEqual([])
  })

  it('removes a staged new 1:m record without calling the API', async () => {
    const relations = createRelations({ mode: 'create' })
    const template = relations.relationTemplates.value[0]

    relations.stageNewRelationRecord(template, { title: 'Mistaken draft' })
    const stagedDraft = relations.relationTableItems.value.notes[0]
    await relations.removeRelation(template, [stagedDraft])

    expect(apiCreateMock).not.toHaveBeenCalled()
    expect(apiUpdateMock).not.toHaveBeenCalled()
    expect(relations.relationTableItems.value.notes).toEqual([])
    expect(relations.dirtyRelationNames.value).toEqual([])
  })

  it('keeps failed 1:m drafts selected for retry after the parent was created', async () => {
    const relations = createRelations({ mode: 'create' })
    const first = { handle: 7, title: 'First' }
    const second = { handle: 8, title: 'Second' }
    relations.selectedRelations.value.notes = [first, second]
    await relations.addRelation(relations.relationTemplates.value[0])
    apiUpdateMock.mockRejectedValueOnce(new Error('update failed'))

    await expect(relations.persistPendingRelations(99)).resolves.toBe(false)

    expect(apiUpdateMock).toHaveBeenCalledTimes(1)
    expect(relations.selectedRelations.value.notes).toEqual([first, second])
  })

  it('adds a 1:m relation with a minimal update payload', async () => {
    const relations = createRelations()
    const selected = {
      handle: 7,
      title: 'Existing note',
      createdAt: '2026-07-21T06:36:53.771Z',
    }
    relations.selectedRelations.value.notes = [selected]

    await relations.addRelation(relations.relationTemplates.value[0])

    expect(apiUpdateMock).toHaveBeenCalledWith('note', 7, { ticket: 42 })
    expect(selected).not.toHaveProperty('ticket')
  })

  it('removes a 1:m relation with a minimal update payload', async () => {
    const relations = createRelations()
    const selected = {
      handle: 7,
      title: 'Existing note',
      ticket: 42,
      createdAt: '2026-07-21T06:36:53.771Z',
    }

    await relations.removeRelation(relations.relationTemplates.value[0], [selected])

    expect(apiUpdateMock).toHaveBeenCalledWith('note', 7, { ticket: null })
    expect(selected.ticket).toBe(42)
  })

  it('keeps a relation mutation busy and ignores duplicate submissions', async () => {
    const relations = createRelations()
    const deferred = createDeferred<object>()
    const template = relations.relationTemplates.value[0]
    relations.selectedRelations.value.notes = [{ handle: 7, title: 'Existing note' }]
    apiUpdateMock.mockReturnValueOnce(deferred.promise)

    const firstSubmission = relations.addRelation(template)
    const duplicateSubmission = relations.addRelation(template)

    expect(relations.relationMutationState.value.notes).toBe(true)
    expect(apiUpdateMock).toHaveBeenCalledTimes(1)

    deferred.resolve({})
    await Promise.all([firstSubmission, duplicateSubmission])

    expect(relations.relationMutationState.value.notes).toBe(false)
    expect(relations.selectedRelations.value.notes).toEqual([])
  })

  it('ignores stale relation responses after item changes reset the table state', async () => {
    const relations = createRelations()
    const deferred = createDeferred<{ data: SaplingGenericItem[]; meta: { total: number } }>()

    apiFindMock.mockReturnValueOnce(deferred.promise)

    await relations.initializeRelationTables()
    const loadingPromise = relations.ensureRelationTableItems('notes')

    relations.resetRelationTableItems()
    deferred.resolve({
      data: [{ handle: 99, title: 'Stale note' }],
      meta: { total: 1 },
    })
    await loadingPromise

    expect(relations.relationTableItems.value.notes).toEqual([])
    expect(relations.relationTableTotal.value.notes).toBe(0)
  })
})

function createRelations(
  overrides: {
    mode?: DialogState
    templates?: EntityTemplate[]
    permissions?: string[]
  } = {},
) {
  const entity = ref({ handle: 'ticket' } as EntityItem)
  const item = ref({ handle: 42 } as SaplingGenericItem)
  const mode = ref<DialogState>(overrides.mode ?? 'edit')
  const permissions = ref<AccumulatedPermission[] | null>(
    (overrides.permissions ?? ['note', 'event']).map(
      (entityHandle) => ({ entityHandle, allowRead: true }) as AccumulatedPermission,
    ),
  )
  const showReference = ref(true)
  const templates = ref<EntityTemplate[]>(
    overrides.templates ?? [
      createTemplate({
        name: 'notes',
        type: 'Collection<NoteItem>',
        kind: '1:m',
        referenceName: 'note',
        mappedBy: 'ticket',
      }),
      createTemplate({
        name: 'events',
        type: 'Collection<EventItem>',
        kind: '1:m',
        referenceName: 'event',
        mappedBy: 'ticket',
      }),
    ],
  )

  return useSaplingDialogEditRelations({
    entity: computed(() => entity.value),
    item: computed(() => item.value),
    mode: computed(() => mode.value),
    permissions,
    showReference: computed(() => showReference.value),
    templates: computed(() => templates.value),
    t: (key: string) => key,
    getItemHandle: (record?: SaplingGenericItem | null) => {
      const handle = record?.handle
      return typeof handle === 'string' || typeof handle === 'number' ? handle : null
    },
  })
}

function createEntityState(entityHandle: string, entityTemplates: EntityTemplate[]): EntityState {
  return {
    entity: { handle: entityHandle } as EntityItem,
    entityPermission: null,
    entityTranslation: {} as never,
    entityTemplates,
    isLoading: false,
    currentEntityName: entityHandle,
    currentNamespaces: [],
  }
}

function getMockedEntityState(key: string): EntityState {
  return entityStates[key] ?? createEntityState(key, [])
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
    mappedBy: overrides.mappedBy,
    referenceName: overrides.referenceName,
    options: overrides.options ?? [],
    tableVisible: overrides.tableVisible,
    mobileVisible: overrides.mobileVisible,
    isAutoIncrement: false,
    isPersistent: true,
    isReference: overrides.isReference ?? false,
    referencedPks: [],
    length: undefined,
  } as EntityTemplate
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve,
  }
}
