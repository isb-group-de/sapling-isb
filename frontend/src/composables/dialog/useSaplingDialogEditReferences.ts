import { ref, type ComputedRef, type Ref } from 'vue'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import { useGenericStore } from '@/stores/genericStore'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import { isTextSearchableTemplate } from '@/utils/saplingTableUtil'
import { getDialogRecordRelations } from './saplingDialogRecordLoader'

type DependencyComparableValue = string | number | boolean

interface UseSaplingDialogEditReferencesOptions {
  form: Ref<SaplingGenericItem>
  templates: ComputedRef<EntityTemplate[]>
  permissions: Ref<AccumulatedPermission[] | null>
  hasFormValue: (value: unknown) => boolean
}

export function useSaplingDialogEditReferences(options: UseSaplingDialogEditReferencesOptions) {
  const genericStore = useGenericStore()
  const referenceColumnsMap = ref<Record<string, EntityTemplate[]>>({})
  const autoSelectRequestIds = new Map<string, number>()

  function getTemplateByName(name: string): EntityTemplate | undefined {
    return options.templates.value.find((template) => template.name === name)
  }

  function extractDependencyIdentifier(value: unknown): DependencyComparableValue | null {
    if (typeof value === 'string') {
      const trimmedValue = value.trim()
      return trimmedValue ? trimmedValue : null
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    const handle = (value as SaplingGenericItem).handle
    return typeof handle === 'string' || typeof handle === 'number' ? handle : null
  }

  function areDependencyIdentifiersEqual(
    left: DependencyComparableValue | null,
    right: DependencyComparableValue | null,
  ): boolean {
    if (left == null || right == null) {
      return left === right
    }

    return String(left) === String(right)
  }

  function buildEmptyDependencyFilter(targetField: string): FilterQuery {
    return {
      [targetField]: { $in: [] },
    }
  }

  function getReferenceParentFilter(template: EntityTemplate): FilterQuery {
    const dependency = template.referenceDependency
    if (!dependency?.parentField || !dependency.targetField) {
      return {}
    }

    const parentIdentifier = extractDependencyIdentifier(options.form.value[dependency.parentField])

    if (parentIdentifier == null) {
      return dependency.requireParent ? buildEmptyDependencyFilter(dependency.targetField) : {}
    }

    return {
      [dependency.targetField]: { $eq: parentIdentifier },
    }
  }

  function isReferenceDependencyBlocked(template: EntityTemplate): boolean {
    const dependency = template.referenceDependency
    if (!dependency?.requireParent) {
      return false
    }

    return extractDependencyIdentifier(options.form.value[dependency.parentField]) == null
  }

  function isReferenceValueValidForDependency(template: EntityTemplate): boolean {
    const dependency = template.referenceDependency
    if (!dependency?.parentField || !dependency.targetField) {
      return true
    }

    const childValue = options.form.value[template.name]
    if (!options.hasFormValue(childValue)) {
      return true
    }

    const parentIdentifier = extractDependencyIdentifier(options.form.value[dependency.parentField])

    if (parentIdentifier == null) {
      // An optional parent makes the child selector available globally, but an
      // explicit parent removal still invalidates a previously selected child.
      return false
    }

    if (!childValue || typeof childValue !== 'object' || Array.isArray(childValue)) {
      return false
    }

    const childRecord = childValue as SaplingGenericItem
    const childIdentifier = extractDependencyIdentifier(childRecord[dependency.targetField])

    return areDependencyIdentifiersEqual(parentIdentifier, childIdentifier)
  }

  function applyReferenceDependencyParent(fieldName: string, value: unknown): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return
    }

    const template = getTemplateByName(fieldName)
    const dependency = template?.referenceDependency
    if (!dependency?.parentField || !dependency.targetField) {
      return
    }

    const parentValue = (value as SaplingGenericItem)[dependency.targetField]
    const parentIdentifier = extractDependencyIdentifier(parentValue)
    if (parentIdentifier == null) {
      return
    }

    const currentParentIdentifier = extractDependencyIdentifier(
      options.form.value[dependency.parentField],
    )
    if (areDependencyIdentifiersEqual(currentParentIdentifier, parentIdentifier)) {
      return
    }

    options.form.value[dependency.parentField] = parentValue
  }

  async function findSingleReferenceForDependency(
    template: EntityTemplate,
  ): Promise<SaplingGenericItem | null> {
    const dependency = template.referenceDependency
    const entityHandle = template.referenceName?.trim()
    const requestId = (autoSelectRequestIds.get(template.name) ?? 0) + 1
    autoSelectRequestIds.set(template.name, requestId)

    if (!dependency?.parentField || !dependency.targetField || !entityHandle) {
      return null
    }

    const parentIdentifier = extractDependencyIdentifier(options.form.value[dependency.parentField])
    if (
      parentIdentifier == null ||
      options.hasFormValue(options.form.value[template.name]) ||
      !canReadReferenceEntity(entityHandle)
    ) {
      return null
    }

    const parentSignature = JSON.stringify(parentIdentifier)
    const parentFilter = getReferenceParentFilter(template)

    try {
      await genericStore.loadGeneric(entityHandle, 'global')
      const targetTemplates = genericStore.getState(entityHandle).entityTemplates
      const result = await ApiGenericService.find<SaplingGenericItem>(entityHandle, {
        filter: parentFilter,
        page: 1,
        limit: 2,
        relations: getDialogRecordRelations(targetTemplates),
      })

      const currentParentIdentifier = extractDependencyIdentifier(
        options.form.value[dependency.parentField],
      )
      if (
        autoSelectRequestIds.get(template.name) !== requestId ||
        JSON.stringify(currentParentIdentifier) !== parentSignature ||
        options.hasFormValue(options.form.value[template.name]) ||
        result.meta.total !== 1
      ) {
        return null
      }

      return result.data[0] ?? null
    } catch {
      return null
    }
  }

  function getReferenceColumnsSync(template: EntityTemplate): EntityTemplate[] {
    const entityHandle = template.referenceName
    return referenceColumnsMap.value[entityHandle ?? ''] ?? []
  }

  function canReadReferenceEntity(referenceName?: string | null): boolean {
    const normalizedReferenceName = referenceName?.trim()
    if (!normalizedReferenceName) {
      return false
    }

    return Boolean(
      options.permissions.value?.find(
        (permission) => permission.entityHandle === normalizedReferenceName,
      )?.allowRead,
    )
  }

  function setReferenceColumns(entityHandle?: string | null): void {
    const normalizedEntityHandle = entityHandle?.trim()
    if (!normalizedEntityHandle) {
      return
    }

    const state = genericStore.getState(normalizedEntityHandle)
    referenceColumnsMap.value[normalizedEntityHandle] = state.entityTemplates
      .filter(
        (entry) =>
          !entry.isAutoIncrement &&
          !entry.isReference &&
          !entry.options?.includes('isSecurity') &&
          !entry.options?.includes('isSystem'),
      )
      .map((entry) => ({ ...entry, key: entry.name }))
  }

  async function ensureReferenceColumns(template: EntityTemplate): Promise<void> {
    const entityHandle = template.referenceName
    if (!canReadReferenceEntity(entityHandle)) {
      referenceColumnsMap.value[entityHandle ?? ''] = []
      return
    }

    if (!referenceColumnsMap.value[entityHandle ?? '']) {
      await genericStore.loadGeneric(entityHandle ?? '', 'global')
      setReferenceColumns(entityHandle)
    }
  }

  async function ensureReferenceColumnsForTemplates(
    nextTemplates: EntityTemplate[],
  ): Promise<void> {
    const readableEntityHandles = [
      ...new Set(
        nextTemplates
          .map((template) => template.referenceName?.trim())
          .filter(
            (entityHandle): entityHandle is string =>
              Boolean(entityHandle) && canReadReferenceEntity(entityHandle),
          ),
      ),
    ]

    const missingEntityHandles = readableEntityHandles.filter(
      (entityHandle) => !referenceColumnsMap.value[entityHandle],
    )

    nextTemplates.forEach((template) => {
      const entityHandle = template.referenceName?.trim()
      if (entityHandle && !canReadReferenceEntity(entityHandle)) {
        referenceColumnsMap.value[entityHandle] = []
      }
    })

    if (missingEntityHandles.length === 0) {
      return
    }

    await genericStore.loadGenericMany(
      missingEntityHandles.map((entityHandle) => ({
        entityHandle,
        namespaces: ['global'],
      })),
    )

    missingEntityHandles.forEach(setReferenceColumns)
  }

  async function prefetchReferenceColumns(nextTemplates: EntityTemplate[]): Promise<void> {
    try {
      await ensureReferenceColumnsForTemplates(nextTemplates)
    } catch (error) {
      console.error('Error prefetching reference columns:', error)
    }
  }

  async function fetchReferenceData(
    template: EntityTemplate,
    { search, page, pageSize }: { search: string; page: number; pageSize: number },
  ): Promise<{ items: Record<string, SaplingGenericItem>[]; total: number }> {
    const entityHandle = template.referenceName
    let filter: Record<string, unknown> = {}
    const columns = getReferenceColumnsSync(template).filter(isTextSearchableTemplate)

    if (search && columns.length > 0) {
      filter = {
        $or: columns.map((column) => ({ [column.key]: { $ilike: `%${search}%` } })),
      }
    }

    const result = await ApiGenericService.find<SaplingGenericItem>(entityHandle ?? '', {
      filter,
      page,
      limit: pageSize,
    })

    return {
      items: result.data as Record<string, SaplingGenericItem>[],
      total: result.meta.total,
    }
  }

  return {
    extractDependencyIdentifier,
    getReferenceParentFilter,
    isReferenceDependencyBlocked,
    isReferenceValueValidForDependency,
    applyReferenceDependencyParent,
    findSingleReferenceForDependency,
    getReferenceColumnsSync,
    canReadReferenceEntity,
    ensureReferenceColumns,
    ensureReferenceColumnsForTemplates,
    prefetchReferenceColumns,
    fetchReferenceData,
  }
}
