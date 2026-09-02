import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type {
  AccumulatedPermission,
  ColumnFilterItem,
  DialogState,
  EntityState,
  EntityTemplate,
  SortItem,
} from '@/entity/structure'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import ApiGenericService from '@/services/api.generic.service'
import { useGenericStore } from '@/stores/genericStore'
import { getRelationTableHeaders } from '@/utils/saplingTableUtil'
import { sortDialogTemplates } from '@/utils/saplingDialogLayoutUtil'
import { useSaplingPendingRelations } from './useSaplingPendingRelations'
import { useSaplingRelationTableLoader } from './useSaplingRelationTableLoader'

type GetItemHandle = (item?: SaplingGenericItem | null) => string | number | null

export interface UseSaplingDialogEditRelationsOptions {
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

  const {
    appendPendingRelationsToPayload,
    clearPendingRelationContexts,
    discardPendingRelation,
    getStagedRelationIdentity,
    haveSameRelationIdentities,
    persistPendingRelations,
    stageNewRelationRecord,
    stageRelations,
  } = useSaplingPendingRelations({
    hasPendingRelationParent,
    relationTemplates,
    relationTableItems,
    relationTableTotal,
    relationTableLoaded,
    selectedRelations,
    getItemHandle: options.getItemHandle,
    getDirtyRelationNames: () => dirtyRelationNames.value,
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

  const { loadRelationTableItem, loadRelationTableTemplates } = useSaplingRelationTableLoader({
    options,
    genericStore,
    relationTemplates,
    hasPendingRelationParent,
    relationTableState,
    relationTableItems,
    relationTableSearch,
    relationTablePage,
    relationTableTotal,
    relationTableItemsPerPage,
    relationTableSortBy,
    relationTableColumnFilters,
    relationTableRequestId,
    relationTableLoaded,
    getRelationTableState,
  })

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

          discardPendingRelation(item)
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
    relationTableSortBy.value[name] ??= getInitialRelationTableSort(name)
    relationTableColumnFilters.value[name] ??= {}
    relationTableRequestId.value[name] ??= 0
    relationTableLoaded.value[name] ??= false
    relationMutationState.value[name] ??= false
    relationTableItems.value[name] ??= []
  }

  function getInitialRelationTableSort(name: string): SortItem[] {
    const orderColumn = getRelationTableState(name).entityTemplates?.find(
      (template) =>
        template.fieldAccess?.allowRead !== false &&
        Array.isArray(template.options) &&
        (template.options.includes('isOrderASC') || template.options.includes('isOrderDESC')),
    )

    if (!orderColumn || !Array.isArray(orderColumn.options)) {
      return []
    }

    return [
      {
        key: orderColumn.name,
        order: orderColumn.options.includes('isOrderDESC') ? 'desc' : 'asc',
      },
    ]
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
    clearPendingRelationContexts()
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
