import { computed, reactive, ref } from 'vue'
import type {
  AccumulatedPermission,
  DialogState,
  EntityState,
  EntityTemplate,
} from '@/entity/structure'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import { useSaplingDialogEditRelations } from '../useSaplingDialogEditRelations'

const entityStates = reactive<Record<string, EntityState>>({
  note: createEntityState('note', [createTemplate({ name: 'title', type: 'string' })]),
  event: createEntityState('event', [
    createTemplate({ name: 'subject', type: 'string' }),
    createTemplate({ name: 'startDate', type: 'datetime', options: ['isOrderDESC'] }),
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

export function createRelations(
  overrides: {
    entityHandle?: string
    mode?: DialogState
    templates?: EntityTemplate[]
    permissions?: string[]
    item?: SaplingGenericItem
    onPersistedItemUpdated?: (item: SaplingGenericItem) => void
  } = {},
) {
  const entity = ref({ handle: overrides.entityHandle ?? 'ticket' } as EntityItem)
  const item = ref(overrides.item ?? ({ handle: 42 } as SaplingGenericItem))
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
    onPersistedItemUpdated: overrides.onPersistedItemUpdated,
  })
}

export function createEntityState(
  entityHandle: string,
  entityTemplates: EntityTemplate[],
): EntityState {
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

export function getMockedEntityState(key: string): EntityState {
  return entityStates[key] ?? createEntityState(key, [])
}

export function createTemplate(
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
