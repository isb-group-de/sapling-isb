import { computed, ref, type Ref } from 'vue'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import { getDateCellState, getDateTimeCellState } from '@/utils/saplingFormatUtil'
import { useWorkspaceTab } from '@/composables/system/workspaceTabContext'

export interface TablePreferences {
  rowDeadlineFields: string[]
  showGrouping: boolean
  groupField: string
  groupFields?: string[]
}

const preferencesByEntity = new Map<string, Ref<TablePreferences>>()
const storageKey = (entity: string) => `sapling.table.preferences.${entity}`

export function readTablePreferences(entity: string): TablePreferences {
  const defaults = { rowDeadlineFields: [], showGrouping: false, groupField: '' }
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(entity)) ?? 'null')
    if (!value || typeof value !== 'object') return defaults
    return {
      rowDeadlineFields: Array.isArray(value.rowDeadlineFields)
        ? ([
            ...new Set(
              value.rowDeadlineFields.filter(
                (field: unknown): field is string => typeof field === 'string',
              ),
            ),
          ] as string[])
        : [],
      showGrouping: value.showGrouping === true,
      groupField: typeof value.groupField === 'string' ? value.groupField : '',
      ...(Array.isArray(value.groupFields)
        ? {
            groupFields: [
              ...new Set(value.groupFields.filter((field: unknown) => typeof field === 'string')),
            ] as string[],
          }
        : {}),
    }
  } catch {
    return defaults
  }
}

export function useTablePreferences(entity: Ref<string>) {
  const tab = useWorkspaceTab()
  const preferences = tab
    ? ((tab.state.get('tablePreferences') as Map<string, Ref<TablePreferences>> | undefined) ??
      new Map<string, Ref<TablePreferences>>())
    : preferencesByEntity
  tab?.state.set('tablePreferences', preferences)
  if (!preferences.has(entity.value)) {
    preferences.set(entity.value, ref(readTablePreferences(entity.value)))
  }
  return computed({
    get() {
      if (!preferences.has(entity.value)) {
        preferences.set(entity.value, ref(readTablePreferences(entity.value)))
      }
      return preferences.get(entity.value)!.value
    },
    set(value: TablePreferences) {
      const state = preferences.get(entity.value)
      if (state) state.value = value
      else preferences.set(entity.value, ref(value))
      try {
        localStorage.setItem(storageKey(entity.value), JSON.stringify(value))
      } catch {
        // Settings remain usable when browser storage is unavailable.
      }
    },
  })
}

export function isDeadlineTemplate(template: EntityTemplate): boolean {
  return (
    template.fieldAccess?.allowRead !== false &&
    Boolean(template.options?.includes('isDeadline')) &&
    ['date', 'datetype', 'datetime'].includes(template.type.toLowerCase())
  )
}

export function isGroupTemplate(template: EntityTemplate): boolean {
  return (
    template.fieldAccess?.allowRead !== false &&
    template.isPersistent !== false &&
    !template.genericReference &&
    (template.isReference || Boolean(template.referenceName)
      ? ['m:1', '1:1'].includes(template.kind ?? '')
      : ['string', 'number', 'boolean', 'date', 'datetype', 'datetime', 'time'].includes(
          template.type.toLowerCase(),
        ) && !template.options?.some((option) => ['isMarkdown', 'isPassword'].includes(option)))
  )
}

export function getActiveGroupFields(
  preferences: TablePreferences,
  templates: EntityTemplate[],
  allowed: boolean,
): string[] {
  if (!allowed || !preferences.showGrouping) return []
  const fields = preferences.groupFields ?? (preferences.groupField ? [preferences.groupField] : [])
  return [...new Set(fields)].filter((field) =>
    templates.some((template) => template.name === field && isGroupTemplate(template)),
  )
}

export function getActiveGroupField(
  preferences: TablePreferences,
  templates: EntityTemplate[],
  allowed: boolean,
): string {
  return getActiveGroupFields(preferences, templates, allowed)[0] ?? ''
}

export const TABLE_GROUP_DRAG_TYPE = 'application/x-sapling-table-group'

export function getRowDeadlineState(
  item: SaplingGenericItem,
  templates: EntityTemplate[],
  fields: string[],
) {
  const dateValue = (value: unknown) =>
    typeof value === 'string' || value instanceof Date ? value : null
  let state = 'default'
  for (const template of templates.filter(
    (template) => isDeadlineTemplate(template) && fields.includes(template.name),
  )) {
    const value = dateValue(item[template.name])
    const next =
      template.type.toLowerCase() === 'datetime'
        ? getDateTimeCellState(
            value,
            dateValue(item[`${template.name}_date`]),
            dateValue(item[`${template.name}_time`]),
          )
        : getDateCellState(value)
    if (next === 'past') return next
    if (next === 'upcoming') state = next
  }
  return state
}

export function getGroupIdentity(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object' && 'handle' in value) return value.handle
  return value
}

export function getChangedGroupFields(
  item: SaplingGenericItem,
  previous: SaplingGenericItem | undefined,
  fields: string[],
): string[] {
  const changed = previous
    ? fields.findIndex(
        (field) => getGroupIdentity(previous[field]) !== getGroupIdentity(item[field]),
      )
    : 0
  return changed < 0 ? [] : fields.slice(changed)
}
