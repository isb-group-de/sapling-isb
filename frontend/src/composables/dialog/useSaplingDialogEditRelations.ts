import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type {
  AccumulatedPermission,
  ColumnFilterItem,
  DialogSaveContext,
  DialogState,
  EntityState,
  EntityTemplate,
  SortItem,
} from '@/entity/structure'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import ApiGenericService from '@/services/api.generic.service'
import { useGenericStore } from '@/stores/genericStore'
import {
  buildTableFilter,
  buildTableOrderBy,
  canReadReferenceTemplate,
  getListProjectionFieldNames,
  getListProjectionReferenceDependencyNames,
  getReadableReferenceRelationNames,
  getRelationTableHeaders,
} from '@/utils/saplingTableUtil'
import { sortDialogTemplates } from '@/utils/saplingDialogLayoutUtil'

type GetItemHandle = (item?: SaplingGenericItem | null) => string | number | null
const TABLE_VALUE_REFERENCE_KINDS = ['m:1', '1:1']
const PENDING_RELATION_DRAFT_KEY = '__saplingPendingRelationDraftId'

interface UseSaplingDialogEditRelationsOptions {
  entity: ComputedRef<EntityItem | null>
  item: ComputedRef<SaplingGenericItem | null>
  mode: ComputedRef<DialogState>
  permissions: Ref<AccumulatedPermission[] | null>
  showReference: ComputedRef<boolean>
  templates: ComputedRef<EntityTemplate[]>
  t: (key: string) => string
  getItemHandle: GetItemHandle
  onPersistedItemUpdated?: (item: SaplingGenericItem) => void
}

export function useSaplingDialogEditRelations(options: UseSaplingDialogEditRelationsOptions) {
  const genericStore = useGenericStore()
  const relationTableItems = ref<Record<string, SaplingGenericItem[]>>({})
  const relationTableSearch = ref<Record<string, string>>({})
  const relationTablePage = ref<Record<string, number>>({})
  const relationTableTotal = ref<Record<string, number>>({})
  const relationTableItemsPerPage = ref<Record<string, number>>({})
  const relationTableSortBy = ref<Record<string, SortItem[]>>({})
  const relationTableColumnFilters = ref<Record<string, Record<string, ColumnFilterItem>>>({})
  const relationTableRequestId = ref<Record<string, number>>({})
  const relationTableLoaded = ref<Record<string, boolean>>({})
  const relationMutationState = ref<Record<string, boolean>>({})
  const selectedRelations = ref<Record<string, SaplingGenericItem[]>>({})
  const relationTableState = ref<Record<string, EntityState>>({})
  const selectedItems = ref<SaplingGenericItem[]>([])
  const pendingRelationCreateContexts = new Map<string, DialogSaveContext>()
  let nextPendingRelationDraftId = 1

  const hasPendingRelationParent = computed(
    () =>
      options.mode.value === 'create' ||
      (options.mode.value === 'edit' &&
        options.item.value != null &&
        options.getItemHandle(options.item.value) == null),
  )

  const relationTemplates = computed(() => {
    if (!options.showReference.value) {
      return []
    }

    return sortDialogTemplates(
      options.templates.value.filter(
        (template) =>
          ['1:m', 'm:n', 'n:m'].includes(template.kind || '') &&
          !template.inlineCollection &&
          !template.options?.includes('isHideAsReference') &&
          options.permissions.value?.find(
            (permission) => permission.entityHandle === template.referenceName,
          )?.allowRead,
      ),
    )
  })

  const dirtyRelationNames = computed(() =>
    hasPendingRelationParent.value
      ? relationTemplates.value
          .filter(
            (template) =>
              !haveSameRelationIdentities(
                relationTableItems.value[template.name] ?? [],
                options.item.value?.[template.name],
              ),
          )
          .map((template) => template.name)
      : [],
  )
  const hasPendingRelationChanges = computed(
    () =>
      dirtyRelationNames.value.length > 0 ||
      (hasPendingRelationParent.value &&
        relationTemplates.value.some(
          (template) => (relationTableItems.value[template.name]?.length ?? 0) > 0,
        )),
  )

  const relationTableHeaders = computed(() =>
    getRelationTableHeaders(relationTableState.value, options.t, options.permissions.value ?? []),
  )

  function getRelationTemplateByName(name: string): EntityTemplate | undefined {
    return relationTemplates.value.find((template) => template.name === name)
  }

  function getRelationTableState(name: string): EntityState {
    return relationTableState.value[name] ?? (relationTableState.value[name] = {} as EntityState)
  }

  async function addRelation(template: EntityTemplate): Promise<void> {
    const items = Array.isArray(selectedRelations.value[template.name])
      ? selectedRelations.value[template.name]
      : []

    if (items.length === 0 || relationMutationState.value[template.name]) {
      return
    }

    relationMutationState.value[template.name] = true

    try {
      if (hasPendingRelationParent.value) {
        stageRelations(template, items)
        selectedRelations.value[template.name] = []
        selectedItems.value = []
        return
      }

      switch (template.kind) {
        case '1:m':
          await addRelation1M(template, items)
          break
        default:
          {
            const persistedItem = await addRelationNM(template, items)
            if (template.kind === 'm:n' && persistedItem) {
              options.onPersistedItemUpdated?.(persistedItem)
            }
          }
          break
      }

      selectedRelations.value[template.name] = []
      selectedItems.value = []
      await loadRelationTableItem(template)
    } finally {
      relationMutationState.value[template.name] = false
    }
  }

  async function addRelationNM(
    template: EntityTemplate,
    items: SaplingGenericItem[],
  ): Promise<SaplingGenericItem | null> {
    const entityHandle = options.entity.value?.handle ?? ''
    const referenceName = template.name
    const entityItemHandle = options.getItemHandle(options.item.value)

    if (entityItemHandle == null) {
      return null
    }

    let persistedItem: SaplingGenericItem | null = null
    for (const referenceItem of items) {
      const referenceItemHandle = options.getItemHandle(referenceItem)
      if (referenceItemHandle == null) {
        continue
      }

      persistedItem = await ApiGenericService.createReference<SaplingGenericItem>(
        entityHandle,
        referenceName,
        entityItemHandle,
        referenceItemHandle,
      )
    }

    return persistedItem
  }

  async function removeRelation(
    template: EntityTemplate,
    itemsToRemove: SaplingGenericItem[],
  ): Promise<void> {
    if (itemsToRemove.length === 0 || relationMutationState.value[template.name]) {
      return
    }

    relationMutationState.value[template.name] = true

    try {
      if (hasPendingRelationParent.value) {
        const removedIdentities = new Set(
          itemsToRemove
            .map(getStagedRelationIdentity)
            .filter((identity): identity is string => Boolean(identity)),
        )
        relationTableItems.value[template.name] = (
          relationTableItems.value[template.name] ?? []
        ).filter((item) => {
          const identity = getStagedRelationIdentity(item)
          if (!identity || !removedIdentities.has(identity)) {
            return true
          }

          const draftId = getPendingRelationDraftId(item)
          if (draftId) {
            pendingRelationCreateContexts.delete(draftId)
          }
          return false
        })
        relationTableTotal.value[template.name] =
          relationTableItems.value[template.name]?.length ?? 0
        selectedItems.value = []
        return
      }

      switch (template.kind) {
        case '1:m':
          await removeRelation1M(template, itemsToRemove)
          break
        default:
          {
            const persistedItem = await removeRelationNM(template, itemsToRemove)
            if (template.kind === 'm:n' && persistedItem) {
              options.onPersistedItemUpdated?.(persistedItem)
            }
          }
          break
      }
    } finally {
      relationMutationState.value[template.name] = false
    }
  }

  function stageNewRelationRecord(
    template: EntityTemplate,
    item: SaplingGenericItem,
    context?: DialogSaveContext,
  ): void {
    if (!hasPendingRelationParent.value || template.kind !== '1:m') {
      return
    }

    const draftId = `${template.name}:${nextPendingRelationDraftId++}`
    const draft = {
      ...item,
      [PENDING_RELATION_DRAFT_KEY]: draftId,
    }
    relationTableItems.value[template.name] = [
      ...(relationTableItems.value[template.name] ?? []),
      draft,
    ]
    relationTableTotal.value[template.name] = relationTableItems.value[template.name].length
    relationTableLoaded.value[template.name] = true
    if (context) {
      pendingRelationCreateContexts.set(draftId, context)
    }
  }

  function getPendingRelationDraftId(item: SaplingGenericItem): string | null {
    const value = item[PENDING_RELATION_DRAFT_KEY]
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  function getStagedRelationIdentity(item: SaplingGenericItem): string | null {
    const draftId = getPendingRelationDraftId(item)
    if (draftId) {
      return `draft:${draftId}`
    }

    const handle = options.getItemHandle(item)
    return handle == null ? null : `handle:${String(handle)}`
  }

  function haveSameRelationIdentities(
    stagedItems: SaplingGenericItem[],
    initialValue: unknown,
  ): boolean {
    const stagedIdentities = stagedItems
      .map(getStagedRelationIdentity)
      .filter((identity): identity is string => Boolean(identity))
      .sort()
    const initialIdentities = (Array.isArray(initialValue) ? initialValue : [])
      .flatMap((item) => {
        if (item && typeof item === 'object') {
          return [getStagedRelationIdentity(item as SaplingGenericItem)]
        }

        return typeof item === 'string' || typeof item === 'number'
          ? [`handle:${String(item)}`]
          : []
      })
      .filter((identity): identity is string => Boolean(identity))
      .sort()

    return (
      stagedIdentities.length === initialIdentities.length &&
      stagedIdentities.every((identity, index) => identity === initialIdentities[index])
    )
  }

  function stageRelations(template: EntityTemplate, items: SaplingGenericItem[]): void {
    const staged = relationTableItems.value[template.name] ?? []
    const handles = new Set(
      staged
        .map((item) => options.getItemHandle(item))
        .filter((handle): handle is string | number => handle != null),
    )

    relationTableItems.value[template.name] = [
      ...staged,
      ...items.filter((item) => {
        const handle = options.getItemHandle(item)
        if (handle == null || handles.has(handle)) {
          return false
        }
        handles.add(handle)
        return true
      }),
    ]
    relationTableTotal.value[template.name] = relationTableItems.value[template.name].length
    relationTableLoaded.value[template.name] = true
  }

  function appendPendingRelationsToPayload(payload: SaplingGenericItem): SaplingGenericItem {
    if (!hasPendingRelationParent.value) {
      return payload
    }

    const output = { ...payload }
    relationTemplates.value
      .filter((template) => ['m:n', 'n:m'].includes(template.kind ?? ''))
      .forEach((template) => {
        const handles = (relationTableItems.value[template.name] ?? [])
          .map((item) => options.getItemHandle(item))
          .filter((handle): handle is string | number => handle != null)

        if (handles.length > 0) {
          output[template.name] = handles
        }
      })

    return output
  }

  async function persistPendingRelations(parentHandle: string | number): Promise<boolean> {
    let allPersisted = true

    for (const template of relationTemplates.value.filter((entry) => entry.kind === '1:m')) {
      const pending = relationTableItems.value[template.name] ?? []
      const mappedBy = template.mappedBy
      if (!mappedBy || pending.length === 0) {
        continue
      }

      const failed: SaplingGenericItem[] = []
      for (let index = 0; index < pending.length; index += 1) {
        let item = pending[index]
        let handle = options.getItemHandle(item)
        const draftId = getPendingRelationDraftId(item)

        try {
          if (handle == null) {
            const createPayload = { ...item, [mappedBy]: parentHandle }
            delete createPayload[PENDING_RELATION_DRAFT_KEY]
            const created = await ApiGenericService.create(
              template.referenceName ?? '',
              createPayload,
            )
            handle = options.getItemHandle(created)
            if (handle == null) {
              throw new Error('Created relation record has no handle')
            }
            item = { ...item, ...created }
            pending[index] = item
          } else {
            await ApiGenericService.update(template.referenceName ?? '', handle, {
              [mappedBy]: parentHandle,
            })
          }

          const nestedRelationsPersisted =
            (draftId && handle != null
              ? await pendingRelationCreateContexts.get(draftId)?.persistPendingRelations?.(handle)
              : undefined) ?? true
          if (!nestedRelationsPersisted) {
            failed.push(item, ...pending.slice(index + 1))
            break
          }
          if (draftId) {
            pendingRelationCreateContexts.delete(draftId)
          }
        } catch {
          failed.push(item, ...pending.slice(index + 1))
          break
        }
      }

      relationTableItems.value[template.name] = failed
      relationTableTotal.value[template.name] = failed.length
      selectedRelations.value[template.name] = failed
      allPersisted = allPersisted && failed.length === 0
    }

    return allPersisted
  }

  async function removeRelationNM(
    template: EntityTemplate,
    itemsToRemove: SaplingGenericItem[],
  ): Promise<SaplingGenericItem | null> {
    const entityHandle = options.entity.value?.handle ?? ''
    const referenceName = template.name
    const entityItemHandle = options.getItemHandle(options.item.value)

    if (entityItemHandle == null) {
      return null
    }

    let persistedItem: SaplingGenericItem | null = null
    for (const referenceItem of itemsToRemove) {
      const referenceItemHandle = options.getItemHandle(referenceItem)
      if (referenceItemHandle == null) {
        continue
      }

      persistedItem = await ApiGenericService.deleteReference<SaplingGenericItem>(
        entityHandle,
        referenceName,
        entityItemHandle,
        referenceItemHandle,
      )
    }

    selectedItems.value = []
    await loadRelationTableItem(template)
    return persistedItem
  }

  async function addRelation1M(
    template: EntityTemplate,
    items: SaplingGenericItem[],
  ): Promise<void> {
    const mappedBy = template.mappedBy
    const entityItemHandle = options.getItemHandle(options.item.value)

    if (!mappedBy || entityItemHandle == null) {
      return
    }

    for (const selected of items) {
      const selectedHandle = options.getItemHandle(selected)
      if (selectedHandle == null) {
        continue
      }

      await ApiGenericService.update(template.referenceName ?? '', selectedHandle, {
        [mappedBy]: entityItemHandle,
      })
    }
  }

  async function removeRelation1M(
    template: EntityTemplate,
    itemsToRemove: SaplingGenericItem[],
  ): Promise<void> {
    const mappedBy = template.mappedBy
    if (!mappedBy) {
      return
    }

    for (const selected of itemsToRemove) {
      const selectedHandle = options.getItemHandle(selected)
      if (selectedHandle == null) {
        continue
      }

      await ApiGenericService.update(template.referenceName ?? '', selectedHandle, {
        [mappedBy]: null,
      })
    }

    selectedItems.value = []
    await loadRelationTableItem(template)
  }

  async function initializeRelationTables(): Promise<void> {
    await loadRelationTableTemplates()

    const relationTemplateNames = new Set(relationTemplates.value.map((template) => template.name))
    clearStaleRelationTableState(relationTemplateNames)

    for (const template of relationTemplates.value) {
      initializeRelationTableState(template.name)
    }

    initializeCreateRelationItems()
  }

  function initializeCreateRelationItems(): void {
    if (!hasPendingRelationParent.value || !options.item.value) {
      return
    }

    relationTemplates.value.forEach((template) => {
      if ((relationTableItems.value[template.name]?.length ?? 0) > 0) {
        return
      }

      const initialValue = options.item.value?.[template.name]
      if (!Array.isArray(initialValue)) {
        return
      }

      const initialItems = initialValue.flatMap((item) => {
        if (item && typeof item === 'object') {
          return [item as SaplingGenericItem]
        }

        return typeof item === 'string' || typeof item === 'number'
          ? [{ handle: item } as SaplingGenericItem]
          : []
      })
      stageRelations(template, initialItems)
    })
  }

  function clearStaleRelationTableState(templateNames: Set<string>): void {
    deleteKeysOutsideTemplateNames(relationTableItems, templateNames)
    deleteKeysOutsideTemplateNames(relationTableSearch, templateNames)
    deleteKeysOutsideTemplateNames(relationTablePage, templateNames)
    deleteKeysOutsideTemplateNames(relationTableTotal, templateNames)
    deleteKeysOutsideTemplateNames(relationTableItemsPerPage, templateNames)
    deleteKeysOutsideTemplateNames(relationTableSortBy, templateNames)
    deleteKeysOutsideTemplateNames(relationTableColumnFilters, templateNames)
    deleteKeysOutsideTemplateNames(relationTableRequestId, templateNames)
    deleteKeysOutsideTemplateNames(relationTableLoaded, templateNames)
    deleteKeysOutsideTemplateNames(relationMutationState, templateNames)
    deleteKeysOutsideTemplateNames(relationTableState, templateNames)
  }

  function deleteKeysOutsideTemplateNames<T>(
    stateRef: Ref<Record<string, T>>,
    templateNames: Set<string>,
  ): void {
    Object.keys(stateRef.value).forEach((key) => {
      if (!templateNames.has(key)) {
        delete stateRef.value[key]
      }
    })
  }

  function initializeRelationTableState(name: string): void {
    relationTableSearch.value[name] ??= ''
    relationTablePage.value[name] ??= 1
    relationTableTotal.value[name] ??= 0
    relationTableItemsPerPage.value[name] ??= DEFAULT_PAGE_SIZE_SMALL
    relationTableSortBy.value[name] ??= []
    relationTableColumnFilters.value[name] ??= {}
    relationTableRequestId.value[name] ??= 0
    relationTableLoaded.value[name] ??= false
    relationMutationState.value[name] ??= false
    relationTableItems.value[name] ??= []
  }

  async function loadRelationTableTemplates(): Promise<void> {
    const relationLoadRequests = relationTemplates.value
      .map((template) => template.referenceName?.trim())
      .filter((referenceName): referenceName is string => Boolean(referenceName))
      .map((referenceName) => ({
        entityHandle: referenceName,
        namespaces: ['global'],
      }))

    if (relationLoadRequests.length > 0) {
      await genericStore.loadGenericMany(relationLoadRequests)
    }

    await preloadRelationValueReferenceMetadata()

    for (const template of relationTemplates.value) {
      const tableState = getRelationTableState(template.name)
      const state = genericStore.getState(template.referenceName ?? '')
      tableState.entityTemplates = state.entityTemplates
      tableState.entity = state.entity
      tableState.entityPermission = state.entityPermission
    }
  }

  async function preloadRelationValueReferenceMetadata(): Promise<void> {
    const permissions = options.permissions.value ?? []
    const relationEntityTemplates = relationTemplates.value.flatMap((template) => {
      const templates = genericStore.getState(template.referenceName ?? '').entityTemplates
      const projectedFields = getListProjectionFieldNames(templates, permissions)
      const rootRelations = [
        ...new Set([
          ...getReadableReferenceRelationNames(templates, permissions, projectedFields),
          ...getListProjectionReferenceDependencyNames(templates, permissions),
        ]),
      ]
      const rootRelationSet = new Set(rootRelations)

      return templates.filter(
        (entry) => rootRelationSet.has(entry.name) && Boolean(entry.referenceName),
      )
    })
    const rootReferenceNames = [
      ...new Set(relationEntityTemplates.map((template) => template.referenceName as string)),
    ]

    if (rootReferenceNames.length > 0) {
      await genericStore.loadGenericMany(
        rootReferenceNames.map((entityHandle) => ({
          entityHandle,
          namespaces: ['global'],
        })),
      )
    }

    const nestedValueReferenceNames = [
      ...new Set(
        rootReferenceNames.flatMap((referenceName) =>
          genericStore
            .getState(referenceName)
            .entityTemplates.filter(
              (template) =>
                TABLE_VALUE_REFERENCE_KINDS.includes(template.kind ?? '') &&
                template.options?.includes('isValue') &&
                template.fieldAccess?.allowRead !== false &&
                canReadReferenceTemplate(template, permissions) &&
                Boolean(template.referenceName),
            )
            .map((template) => template.referenceName as string),
        ),
      ),
    ]

    if (nestedValueReferenceNames.length > 0) {
      await genericStore.loadGenericMany(
        nestedValueReferenceNames.map((entityHandle) => ({
          entityHandle,
          namespaces: ['global'],
        })),
      )
    }
  }

  async function loadRelationTableItem(template: EntityTemplate): Promise<void> {
    const relState = getRelationTableState(template.name)
    const requestId = (relationTableRequestId.value[template.name] ?? 0) + 1
    relationTableRequestId.value[template.name] = requestId
    relState.isLoading = true

    try {
      const filter: Record<string, unknown> = {}
      if (options.item.value && (template.mappedBy || template.inversedBy)) {
        const itemHandle = options.getItemHandle(options.item.value)
        const indexKey = template.mappedBy ?? template.inversedBy
        if (indexKey && itemHandle != null) {
          filter[indexKey] = itemHandle
        }
      }

      const search = relationTableSearch.value[template.name] || ''
      const page = relationTablePage.value[template.name] || 1
      const limit = relationTableItemsPerPage.value[template.name] || DEFAULT_PAGE_SIZE_SMALL
      const sortBy = relationTableSortBy.value[template.name] || []
      const columns = relationTableState.value[template.name]?.entityTemplates ?? []
      const columnFilters = relationTableColumnFilters.value[template.name] || {}

      if (!hasPendingRelationParent.value && options.item.value && template.referenceName) {
        const permissions = options.permissions.value ?? []
        const projectedFields = getListProjectionFieldNames(columns, permissions)
        const relations = getReadableReferenceRelationNames(
          columns,
          permissions,
          projectedFields,
          (referenceName) => genericStore.getState(referenceName).entityTemplates,
        )
        const apiFilter = buildTableFilter({
          search,
          columnFilters,
          entityTemplates: columns,
          parentFilter: filter,
        })

        const result = await ApiGenericService.find<SaplingGenericItem>(template.referenceName, {
          filter: apiFilter,
          limit,
          page,
          orderBy: buildTableOrderBy(sortBy),
          relations,
        })

        if (relationTableRequestId.value[template.name] !== requestId) {
          return
        }

        relationTableItems.value[template.name] = result.data
        relationTableTotal.value[template.name] = result.meta?.total ?? result.data.length
        relationTableLoaded.value[template.name] = true
        return
      }

      if (relationTableRequestId.value[template.name] !== requestId) {
        return
      }

      if (!hasPendingRelationParent.value) {
        relationTableItems.value[template.name] = []
        relationTableTotal.value[template.name] = 0
      } else {
        relationTableTotal.value[template.name] =
          relationTableItems.value[template.name]?.length ?? 0
      }
      relationTableLoaded.value[template.name] = true
    } catch (error) {
      if (relationTableRequestId.value[template.name] === requestId) {
        relationTableItems.value[template.name] = []
        relationTableTotal.value[template.name] = 0
        relationTableLoaded.value[template.name] = true
      }
      console.error(`Error loading relation table items for ${template.name}:`, error)
    } finally {
      if (relationTableRequestId.value[template.name] === requestId) {
        relState.isLoading = false
      }
    }
  }

  async function loadRelationTableItems(names?: string[]): Promise<void> {
    const templatesToLoad = names?.length
      ? names
          .map(getRelationTemplateByName)
          .filter((template): template is EntityTemplate => Boolean(template))
      : relationTemplates.value

    await Promise.all(templatesToLoad.map((template) => loadRelationTableItem(template)))
  }

  async function ensureRelationTableItems(name: string): Promise<void> {
    if (relationTableLoaded.value[name] || getRelationTableState(name).isLoading) {
      return
    }

    await loadRelationTableItems([name])
  }

  function loadRelationTableItemByName(name: string): void {
    const template = getRelationTemplateByName(name)
    if (!template) {
      return
    }

    void loadRelationTableItem(template)
  }

  function onRelationTablePage(name: string, value: number): void {
    relationTablePage.value[name] = value
    loadRelationTableItemByName(name)
  }

  function onRelationTableItemsPerPage(name: string, value: number): void {
    relationTableItemsPerPage.value[name] = value
    relationTablePage.value[name] = 1
    loadRelationTableItemByName(name)
  }

  function onRelationTableSort(name: string, value: SortItem[]): void {
    relationTableSortBy.value[name] = value
    relationTablePage.value[name] = 1
    loadRelationTableItemByName(name)
  }

  function onRelationTableColumnFilters(
    name: string,
    value: Record<string, ColumnFilterItem>,
  ): void {
    relationTableColumnFilters.value[name] = { ...value }
    relationTablePage.value[name] = 1
    loadRelationTableItemByName(name)
  }

  function onRelationTableReload(name: string): void {
    onRelationTablePage(name, relationTablePage.value[name] || 1)
  }

  function resetRelationTableItems(): void {
    relationTemplates.value.forEach((template) => {
      relationTableLoaded.value[template.name] = false
      relationTableItems.value[template.name] = []
      relationTableTotal.value[template.name] = 0
      relationTableRequestId.value[template.name] =
        (relationTableRequestId.value[template.name] ?? 0) + 1
      getRelationTableState(template.name).isLoading = false
    })

    initializeCreateRelationItems()
  }

  function clearSelectedItems(): void {
    selectedItems.value = []
  }

  function resetRelationSelections(): void {
    selectedItems.value = []
    selectedRelations.value = {}
    pendingRelationCreateContexts.clear()
    if (hasPendingRelationParent.value) {
      resetRelationTableItems()
    }
  }

  return {
    relationTemplates,
    dirtyRelationNames,
    hasPendingRelationChanges,
    relationTableHeaders,
    relationTableState,
    relationTableItems,
    relationTableSearch,
    relationTablePage,
    relationTableTotal,
    relationTableItemsPerPage,
    relationTableSortBy,
    relationTableColumnFilters,
    relationMutationState,
    relationTableLoaded,
    selectedRelations,
    selectedItems,
    addRelation,
    stageNewRelationRecord,
    removeRelation,
    initializeRelationTables,
    loadRelationTableItems,
    ensureRelationTableItems,
    onRelationTablePage,
    onRelationTableItemsPerPage,
    onRelationTableSort,
    onRelationTableColumnFilters,
    onRelationTableReload,
    clearSelectedItems,
    resetRelationTableItems,
    resetRelationSelections,
    appendPendingRelationsToPayload,
    persistPendingRelations,
  }
}
