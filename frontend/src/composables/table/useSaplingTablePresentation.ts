import { computed, provide, toRef, watch, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityTemplate, SaplingTableHeaderItem } from '@/entity/structure'
import type { SaplingTableEmit, SaplingTableProps } from '@/components/table/SaplingTable.types'
import { tablePresentationKey } from '@/components/table/saplingTablePresentation'
import { useGenericStore } from '@/stores/genericStore'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { canReadReferenceTemplate, getEntityValueLabel } from '@/utils/saplingTableUtil'
import { formatValue } from '@/utils/saplingFormatUtil'
import type { SaplingGenericItem } from '@/entity/entity'
import {
  getActiveGroupFields,
  getGroupIdentity,
  getChangedGroupFields,
  isGroupTemplate,
  useTablePreferences,
} from './saplingTablePreferences'

export function useSaplingTablePresentation(
  props: SaplingTableProps,
  visibleColumns: ComputedRef<SaplingTableHeaderItem[]>,
  emit: SaplingTableEmit,
) {
  const { t } = useI18n()
  const store = useGenericStore()
  const permissions = useCurrentPermissionStore()
  const preferences = useTablePreferences(toRef(props, 'entityHandle'))
  const groupTemplates = computed(() =>
    visibleColumns.value.filter(
      (template) =>
        isGroupTemplate(template) &&
        canReadReferenceTemplate(template, permissions.accumulatedPermission ?? []),
    ),
  )
  const groupFields = computed(() =>
    groupTemplates.value.map((template) => ({
      title: t(`${props.entityHandle}.${template.name}`),
      value: template.name,
    })),
  )
  const selectedGroups = computed({
    get: () =>
      getActiveGroupFields(preferences.value, groupTemplates.value, props.allowGrouping === true),
    set: (fields: string[]) => {
      preferences.value = {
        ...preferences.value,
        groupField: '',
        groupFields: fields.filter((field) =>
          groupTemplates.value.some((template) => template.name === field),
        ),
      }
    },
  })
  watch(
    () => groupTemplates.value.map((template) => template.name),
    (keys) => {
      if (props.allowGrouping) emit('update:groupableColumnKeys', keys)
    },
    { immediate: true },
  )
  function fieldLabel(template: EntityTemplate, value: unknown): string {
    const references = template.referenceName
      ? store.getState(template.referenceName).entityTemplates
      : []
    const nestedTemplates = Object.fromEntries(
      references
        .filter((template) => template.referenceName)
        .map((template) => [
          template.referenceName!,
          store.getState(template.referenceName!).entityTemplates,
        ]),
    )
    const label =
      getGroupIdentity(value) === null
        ? t('global.tableGroupEmpty')
        : template.isReference && typeof value === 'object'
          ? getEntityValueLabel(value as SaplingGenericItem, references, nestedTemplates)
          : formatValue(String(value), template.type)
    return `${t(`${props.entityHandle}.${template.name}`)}: ${label}`
  }
  function groupHeadings(index: number) {
    const item = props.items[index]
    if (!item) return []
    const fields = selectedGroups.value
    const previous = index > 0 ? props.items[index - 1] : undefined
    return getChangedGroupFields(item, previous, fields).map((field) => ({
      key: field,
      level: fields.indexOf(field),
      label: fieldLabel(
        groupTemplates.value.find((template) => template.name === field)!,
        item[field],
      ),
    }))
  }
  const canGroup = (field: string) =>
    props.allowGrouping === true &&
    preferences.value.showGrouping &&
    groupTemplates.value.some((template) => template.name === field)
  provide(tablePresentationKey, { preferences, groupHeadings, canGroup })
  return { preferences, groupFields, selectedGroups }
}
