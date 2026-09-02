import { computed, type ComputedRef, type Ref } from 'vue'
import type { EntityTemplate } from '@/entity/structure'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useGenericStore } from '@/stores/genericStore'
import {
  canReadReferenceTemplate,
  getListProjectionFieldNames,
  getListProjectionReferenceDependencyNames,
  getReadableReferenceRelationNames,
  getReferenceChipProjectionFieldNames,
} from '@/utils/saplingTableUtil'

const TABLE_VALUE_REFERENCE_KINDS = ['m:1', '1:1']

export function useSaplingTableProjection(options: {
  entityTemplates: ComputedRef<EntityTemplate[]>
  temporaryVisibleColumnKeys: Ref<string[]>
  additionalListProjectionFields: string[]
  currentPermissionStore: ReturnType<typeof useCurrentPermissionStore>
  genericStore: ReturnType<typeof useGenericStore>
}) {
  const {
    entityTemplates,
    temporaryVisibleColumnKeys,
    additionalListProjectionFields,
    currentPermissionStore,
    genericStore,
  } = options

  async function preloadValueReferenceMetadata(nextEntityTemplates: EntityTemplate[]) {
    const permissions = currentPermissionStore.accumulatedPermission ?? []
    const projectedFields = getListProjectionFieldNames(nextEntityTemplates, permissions)
    const rootRelations = [
      ...new Set([
        ...getReadableReferenceRelationNames(nextEntityTemplates, permissions, projectedFields),
        ...getListProjectionReferenceDependencyNames(nextEntityTemplates, permissions),
      ]),
    ]
    const rootRelationSet = new Set(rootRelations)
    const rootReferenceNames = [
      ...new Set(
        nextEntityTemplates
          .filter(
            (template) => rootRelationSet.has(template.name) && Boolean(template.referenceName),
          )
          .map((template) => template.referenceName as string),
      ),
    ]

    await Promise.all(
      rootReferenceNames.map((referenceName) => genericStore.loadGeneric(referenceName, 'global')),
    )

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

    await Promise.all(
      nestedValueReferenceNames.map((referenceName) =>
        genericStore.loadGeneric(referenceName, 'global'),
      ),
    )
  }

  function buildListProjectionFields(nextEntityTemplates: EntityTemplate[]) {
    const permissions = currentPermissionStore.accumulatedPermission ?? []
    const baseFields = [
      ...new Set([
        ...getListProjectionFieldNames(
          nextEntityTemplates,
          permissions,
          (referenceName) => genericStore.getState(referenceName).entityTemplates,
        ),
        ...nextEntityTemplates
          .filter(
            (template) =>
              template.name === 'updatedAt' &&
              template.isPersistent !== false &&
              template.fieldAccess?.allowRead !== false,
          )
          .map((template) => template.name),
        ...additionalListProjectionFields.filter((fieldName) =>
          nextEntityTemplates.some(
            (template) => template.name === fieldName && template.fieldAccess?.allowRead !== false,
          ),
        ),
        ...temporaryVisibleColumnKeys.value.filter((fieldName) =>
          nextEntityTemplates.some(
            (template) =>
              template.name === fieldName &&
              template.isPersistent !== false &&
              template.fieldAccess?.allowRead !== false,
          ),
        ),
      ]),
    ]

    return [
      ...new Set([
        ...baseFields,
        ...getReferenceChipProjectionFieldNames(
          nextEntityTemplates,
          permissions,
          baseFields,
          (referenceName) => genericStore.getState(referenceName).entityTemplates,
        ),
      ]),
    ]
  }
  const listProjectionFields = computed(() => buildListProjectionFields(entityTemplates.value))
  const readableReferenceRelations = computed(() =>
    getReadableReferenceRelationNames(
      entityTemplates.value,
      currentPermissionStore.accumulatedPermission ?? [],
      listProjectionFields.value,
      (referenceName) => genericStore.getState(referenceName).entityTemplates,
    ),
  )
  const referenceSearchTemplates = computed(() =>
    Object.fromEntries(
      readableReferenceRelations.value
        .filter((relationName) => !relationName.includes('.'))
        .map((relationName) => {
          const referenceName = entityTemplates.value.find(
            (template) => template.name === relationName,
          )?.referenceName

          return referenceName
            ? [relationName, genericStore.getState(referenceName).entityTemplates]
            : null
        })
        .filter(
          (entry): entry is [string, EntityTemplate[]] => entry !== null && entry[1].length > 0,
        ),
    ),
  )

  return {
    buildListProjectionFields,
    listProjectionFields,
    preloadValueReferenceMetadata,
    readableReferenceRelations,
    referenceSearchTemplates,
  }
}
