import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { formatValue } from './saplingFormatUtil'

export interface EntityValueLabelLine {
  value: string
  isReference: boolean
}

export type EntityValueReferenceTemplates = Readonly<Record<string, EntityTemplate[]>>

export function getEntityValueLabel(
  item?: SaplingGenericItem | null,
  entityTemplates?: EntityTemplate[],
  referenceTemplates: EntityValueReferenceTemplates = {},
): string {
  return getEntityValueLabelLines(item, entityTemplates, referenceTemplates)
    .map((line) => line.value)
    .join('\n')
}

export function getEntityValueLabelLines(
  item?: SaplingGenericItem | null,
  entityTemplates?: EntityTemplate[],
  referenceTemplates: EntityValueReferenceTemplates = {},
): EntityValueLabelLine[] {
  return buildEntityValueLabelLines(item, entityTemplates, referenceTemplates, true)
}

function buildEntityValueLabelLines(
  item: SaplingGenericItem | null | undefined,
  entityTemplates: EntityTemplate[] | undefined,
  referenceTemplates: EntityValueReferenceTemplates,
  allowHandleFallback: boolean,
): EntityValueLabelLine[] {
  if (!item) return []

  const scalarParts: string[] = []
  const referenceLines: EntityValueLabelLine[] = []

  for (const template of entityTemplates?.filter((entry) => entry.options?.includes('isValue')) ??
    []) {
    const value = item[template.name]

    if (template.isReference) {
      const referenceItem = resolveReferenceItem(value)
      if (!referenceItem) continue

      const nestedTemplates = template.referenceName
        ? referenceTemplates[template.referenceName]
        : undefined
      const nestedValue = buildEntityValueLabelLines(
        referenceItem,
        nestedTemplates,
        referenceTemplates,
        false,
      )
        .map((line) => line.value)
        .join('\n')
      if (nestedValue) {
        referenceLines.push({ value: nestedValue, isReference: true })
      }
      continue
    }

    if (
      value === null ||
      typeof value === 'undefined' ||
      typeof value === 'object' ||
      String(value).trim().length === 0
    ) {
      continue
    }

    const formattedValue = formatValue(String(value), template.type)
    if (formattedValue && formattedValue !== '-') {
      scalarParts.push(formattedValue)
    }
  }

  const lines: EntityValueLabelLine[] = []
  if (scalarParts.length > 0) {
    lines.push({ value: scalarParts.join(' '), isReference: false })
  }
  lines.push(...referenceLines)

  if (lines.length > 0) return lines
  if (!allowHandleFallback) return []

  const handleValue = item.handle
  if (
    typeof handleValue === 'string' ||
    typeof handleValue === 'number' ||
    typeof handleValue === 'boolean' ||
    (handleValue && typeof handleValue === 'object')
  ) {
    const value = formatFilterDisplayValue(handleValue)
    return value ? [{ value, isReference: false }] : []
  }
  return []
}

function resolveReferenceItem(value: unknown): SaplingGenericItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as SaplingGenericItem
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
