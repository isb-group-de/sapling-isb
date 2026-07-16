import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { formatValue } from './saplingFormatUtil'

export function getEntityValueLabel(
  item?: SaplingGenericItem | null,
  entityTemplates?: EntityTemplate[],
): string {
  if (!item) return ''

  const valueParts =
    entityTemplates
      ?.filter((template) => template.options?.includes('isValue'))
      .map((template) => {
        const value = item[template.name]
        if (
          value === null ||
          typeof value === 'undefined' ||
          typeof value === 'object' ||
          String(value).trim().length === 0
        ) {
          return ''
        }
        return formatValue(String(value), template.type)
      })
      .filter((value) => value && value !== '-') ?? []

  if (valueParts.length > 0) return valueParts.join(' ')

  const handleValue = item.handle
  if (
    typeof handleValue === 'string' ||
    typeof handleValue === 'number' ||
    typeof handleValue === 'boolean' ||
    (handleValue && typeof handleValue === 'object')
  ) {
    return formatFilterDisplayValue(handleValue)
  }
  return ''
}

function formatFilterDisplayValue(value: unknown): string {
  if (typeof value === 'string') {
    const tokenMatch = value.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/)
    return tokenMatch?.[1]?.trim() ?? value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map(formatFilterDisplayValue).filter(Boolean).join(', ')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key}: ${formatFilterDisplayValue(entry)}`)
      .filter((entry) => !entry.endsWith(': '))
      .join(', ')
  }
  return ''
}

export function getGenericReferenceEntityHandle(
  item?: SaplingGenericItem | null,
  template?: Partial<EntityTemplate>,
): string {
  const entityField = template?.genericReference?.entityField?.trim()
  if (!item || !entityField) return ''

  const rawValue = item[entityField]
  if (typeof rawValue === 'string') return rawValue.trim()
  if (
    rawValue &&
    typeof rawValue === 'object' &&
    'handle' in rawValue &&
    typeof rawValue.handle === 'string'
  ) {
    return rawValue.handle.trim()
  }
  return ''
}

export function getGenericReferenceHandle(
  item?: SaplingGenericItem | null,
  template?: Partial<EntityTemplate>,
): string | number | null {
  const handleField = template?.genericReference?.handleField?.trim()
  if (!item || !handleField) return null

  const rawValue = item[handleField]
  if (typeof rawValue === 'number') return rawValue
  if (typeof rawValue === 'string') {
    const trimmedValue = rawValue.trim()
    return trimmedValue.length > 0 ? trimmedValue : null
  }
  return null
}
