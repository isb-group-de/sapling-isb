import type { SaplingTableHeaderItem } from '@/entity/structure'

export function withCellClass(
  header: SaplingTableHeaderItem,
  className: string,
): SaplingTableHeaderItem {
  const existingCellProps =
    typeof header.cellProps === 'object' && header.cellProps !== null
      ? (header.cellProps as Record<string, unknown>)
      : {}
  const existingClass =
    typeof existingCellProps.class === 'string' ? existingCellProps.class.trim() : ''

  return {
    ...header,
    cellProps: {
      ...existingCellProps,
      class: [existingClass, className].filter(Boolean).join(' '),
    },
  }
}

export function normalizeOpenEditHandle(value: string | number | null | undefined): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}
