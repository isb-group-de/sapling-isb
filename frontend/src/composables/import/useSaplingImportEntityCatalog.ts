import { computed, ref, type Ref } from 'vue'
import type { EntityItem } from '@/entity/entity'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import type { useGenericStore } from '@/stores/genericStore'
import type { useCurrentPermissionStore } from '@/stores/currentPermissionStore'

type GenericStore = ReturnType<typeof useGenericStore>
type CurrentPermissionStore = ReturnType<typeof useCurrentPermissionStore>

export interface SaplingImportEntityCatalogOptions {
  selectedEntityHandle: Ref<string | null>
  selectedSourceHandle: Ref<string | null>
  genericStore: GenericStore
  currentPermissionStore: CurrentPermissionStore
  entityLabel: (entityHandle: string) => string
}

const OPEN_IMPORT_BATCH_STATUSES = [
  'analyzed',
  'validationQueued',
  'validating',
  'validationFailed',
  'validated',
  'validatedWithErrors',
  'executionQueued',
  'executing',
  'executionFailed',
]

export function useSaplingImportEntityCatalog(options: SaplingImportEntityCatalogOptions) {
  const entities = ref<EntityItem[]>([])
  const selectedEntityTemplates = computed<EntityTemplate[]>(() =>
    options.selectedEntityHandle.value
      ? options.genericStore.getState(options.selectedEntityHandle.value).entityTemplates
      : [],
  )
  const selectedEntity = computed<EntityItem | null>(() =>
    options.selectedEntityHandle.value
      ? options.genericStore.getState(options.selectedEntityHandle.value).entity
      : null,
  )
  const selectedEntityPermission = computed<AccumulatedPermission | null>(() =>
    options.selectedEntityHandle.value
      ? options.genericStore.getState(options.selectedEntityHandle.value).entityPermission
      : null,
  )
  const currentPermissions = computed(
    () => options.currentPermissionStore.accumulatedPermission ?? [],
  )
  const importableFields = computed(() =>
    selectedEntityTemplates.value.filter((template) => {
      if (!template.name || template.name === 'handle') return Boolean(template.name)
      if (template.isPersistent === false || template.options?.includes('isReadOnly')) {
        return false
      }
      return !['1:m', 'm:n', 'n:m', '1:1'].includes(template.kind ?? '')
    }),
  )
  const entityOptions = computed(() =>
    entities.value
      .filter((entity) => entity.canRead !== false)
      .map((entity) => ({
        title: options.entityLabel(entity.handle),
        value: entity.handle,
      }))
      .sort((left, right) => left.title.localeCompare(right.title)),
  )
  const selectedEntityPlaceholder = computed(() => options.selectedEntityHandle.value)
  const selectedSourcePlaceholder = computed(() => options.selectedSourceHandle.value)
  const openBatchFilter = computed<FilterQuery>(() => ({
    status: { $in: OPEN_IMPORT_BATCH_STATUSES },
    executedAt: null,
  }))
  const entityFilter = computed<FilterQuery>(() => ({ canRead: { $ne: false } }))
  const sourceFilter = computed<FilterQuery>(() => ({ isActive: true }))

  async function loadEntities(): Promise<void> {
    const response = await ApiGenericService.findAll<EntityItem>('entity', {
      orderBy: { handle: 'ASC' },
    })
    entities.value = response
  }

  return {
    selectedEntityTemplates,
    selectedEntity,
    selectedEntityPermission,
    currentPermissions,
    importableFields,
    entityOptions,
    selectedEntityPlaceholder,
    selectedSourcePlaceholder,
    openBatchFilter,
    entityFilter,
    sourceFilter,
    loadEntities,
  }
}
