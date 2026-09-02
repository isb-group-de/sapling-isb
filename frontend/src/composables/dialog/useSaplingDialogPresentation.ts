import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingDialogTemplateGroup } from '@/utils/saplingDialogLayoutUtil'

interface DialogPresentationProps {
  entity: EntityItem | null
  item: SaplingGenericItem | null
}

interface DialogPresentationOptions {
  dirtyFieldCount: ComputedRef<number>
  dirtyRelationNames: ComputedRef<string[]>
  getDirtyTemplateCount: (templates: EntityTemplate[]) => number
  informationDirty: Ref<boolean>
  onRelationTablePage: (templateName: string, page: number) => void
  relationTablePage: Ref<Record<string, number>>
  relationTableSearch: Ref<Record<string, string>>
  selectedFormConfigLabel: ComputedRef<string>
  selectedItems: Ref<SaplingGenericItem[]>
  selectedRelations: Ref<Record<string, SaplingGenericItem[]>>
  visibleTemplateGroups: ComputedRef<SaplingDialogTemplateGroup[]>
}

export function useSaplingDialogPresentation(
  props: DialogPresentationProps,
  options: DialogPresentationOptions,
) {
  const { d, t, te } = useI18n()

  function getTimestampTitle(field: 'createdAt' | 'updatedAt'): string {
    const entityHandle = props.entity?.handle
    const entityKey = entityHandle ? `${entityHandle}.${field}` : ''
    return entityKey && te(entityKey) ? t(entityKey) : t(`global.${field}`)
  }

  function formatTimestamp(value: unknown): string {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? '' : d(date)
  }

  const createdAtTitle = computed(() => getTimestampTitle('createdAt'))
  const updatedAtTitle = computed(() => getTimestampTitle('updatedAt'))
  const createdAtLabel = computed(() => formatTimestamp(props.item?.createdAt))
  const updatedAtLabel = computed(() => formatTimestamp(props.item?.updatedAt))
  const selectedFormConfigChipLabel = computed(() =>
    options.selectedFormConfigLabel.value
      ? `${t('formConfig.currentView')}: ${options.selectedFormConfigLabel.value}`
      : '',
  )
  const resetButtonLabel = computed(() => t('filter.reset'))
  const dirtyChangeCount = computed(
    () =>
      options.dirtyFieldCount.value +
      options.dirtyRelationNames.value.length +
      (options.informationDirty.value ? 1 : 0),
  )
  const dirtySummaryLabel = computed(() =>
    dirtyChangeCount.value > 0
      ? t('global.dirtyFieldCount', { count: dirtyChangeCount.value }, dirtyChangeCount.value)
      : '',
  )
  const expandedGroupIds = ref<string[]>([])

  function syncExpandedGroups(forceOpenAll = false): void {
    const groupIds = options.visibleTemplateGroups.value.map((group) => group.id)
    if (forceOpenAll) {
      expandedGroupIds.value = groupIds
      return
    }
    const expandedGroupSet = new Set(expandedGroupIds.value)
    groupIds.forEach((groupId) => expandedGroupSet.add(groupId))
    expandedGroupIds.value = groupIds.filter((groupId) => expandedGroupSet.has(groupId))
  }

  function isGroupExpanded(groupId: string): boolean {
    return expandedGroupIds.value.includes(groupId)
  }

  function toggleGroup(groupId: string): void {
    expandedGroupIds.value = isGroupExpanded(groupId)
      ? expandedGroupIds.value.filter((id) => id !== groupId)
      : [...expandedGroupIds.value, groupId]
  }

  function isGroupDirty(templates: EntityTemplate[]): boolean {
    return options.getDirtyTemplateCount(templates) > 0
  }

  function updateSelectedRelationItems(templateName: string, items: SaplingGenericItem[]): void {
    options.selectedRelations.value[templateName] = items
  }

  function updateSelectedRelationTableItems(items: SaplingGenericItem[]): void {
    options.selectedItems.value = items
  }

  function onRelationSearch(templateName: string, search: string): void {
    options.relationTableSearch.value[templateName] = search
    options.relationTablePage.value[templateName] = 1
    options.onRelationTablePage(templateName, 1)
  }

  watch(options.visibleTemplateGroups, () => syncExpandedGroups(), { immediate: true })

  return {
    createdAtTitle,
    updatedAtTitle,
    createdAtLabel,
    updatedAtLabel,
    selectedFormConfigChipLabel,
    resetButtonLabel,
    dirtyChangeCount,
    dirtySummaryLabel,
    expandedGroupIds,
    syncExpandedGroups,
    isGroupExpanded,
    toggleGroup,
    isGroupDirty,
    updateSelectedRelationItems,
    updateSelectedRelationTableItems,
    onRelationSearch,
  }
}
