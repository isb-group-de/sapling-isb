import type { ComputedRef, Ref } from 'vue'
import type { ColumnFilterItem, EntityState, EntityTemplate, SortItem } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
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
} from '@/utils/saplingTableUtil'
import type { UseSaplingDialogEditRelationsOptions } from './useSaplingDialogEditRelations'

const TABLE_VALUE_REFERENCE_KINDS = ['m:1', '1:1']

export function useSaplingRelationTableLoader(context: {
  options: UseSaplingDialogEditRelationsOptions
  genericStore: ReturnType<typeof useGenericStore>
  relationTemplates: ComputedRef<EntityTemplate[]>
  hasPendingRelationParent: ComputedRef<boolean>
  relationTableState: Ref<Record<string, EntityState>>
  relationTableItems: Ref<Record<string, SaplingGenericItem[]>>
  relationTableSearch: Ref<Record<string, string>>
  relationTablePage: Ref<Record<string, number>>
  relationTableTotal: Ref<Record<string, number>>
  relationTableItemsPerPage: Ref<Record<string, number>>
  relationTableSortBy: Ref<Record<string, SortItem[]>>
  relationTableColumnFilters: Ref<Record<string, Record<string, ColumnFilterItem>>>
  relationTableRequestId: Ref<Record<string, number>>
  relationTableLoaded: Ref<Record<string, boolean>>
  getRelationTableState: (name: string) => EntityState
}) {
  const {
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
  } = context

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

  return { loadRelationTableItem, loadRelationTableTemplates }
}
