import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import type { FilterQuery } from '@/services/api.generic.service'

export interface SaplingFieldSingleSelectProps {
  label: string
  entityHandle: string
  modelValue?: SaplingGenericItem | null
  rules?: Array<(value: unknown) => true | string>
  placeholder?: string
  disabled?: boolean
  parentFilter?: FilterQuery
  dependencyTargetField?: string
  density?: 'default' | 'comfortable' | 'compact'
  hideDetails?: boolean | 'auto'
  showOpenAction?: boolean
  openActionLabel?: string
  helpText?: string
  helpAriaLabel?: string
  reserveHelpSpace?: boolean
}

export function resolveSaplingItem(item: unknown): SaplingGenericItem | null {
  if (!item || typeof item !== 'object') return null
  if ('raw' in item && item.raw && typeof item.raw === 'object') {
    return item.raw as SaplingGenericItem
  }
  return item as SaplingGenericItem
}

export function hasIncompleteValueData(
  item: SaplingGenericItem,
  templates: EntityTemplate[],
): boolean {
  if (
    templates.some(
      (template) =>
        template.options?.includes('isValue') &&
        !Object.prototype.hasOwnProperty.call(item, template.name),
    )
  ) {
    return true
  }

  return templates.some((template) => {
    if (
      !template.isReference ||
      !['m:1', '1:1'].includes(template.kind ?? '') ||
      !template.options?.includes('isValue')
    ) {
      return false
    }
    const value = item[template.name]
    if (value == null) return false
    if (typeof value !== 'object' || Array.isArray(value)) return true
    return Object.keys(value).every((key) => key === 'handle')
  })
}
