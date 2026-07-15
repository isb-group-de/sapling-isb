import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'

export function buildKanbanOrderBy(
  templates: EntityTemplate[],
  preferredFields: string[] = [],
): Record<string, string> {
  const orderBy: Record<string, string> = {}
  preferredFields.forEach((field) => {
    if (templates.some((template) => template.name === field)) {
      orderBy[field] = field === 'updatedAt' ? 'DESC' : 'ASC'
    }
  })

  if (templates.some((template) => template.name === 'sortOrder')) {
    orderBy.sortOrder = 'ASC'
  }
  templates.forEach((template) => {
    if (template.options?.includes('isOrderASC')) orderBy[template.name] = 'ASC'
    else if (template.options?.includes('isOrderDESC')) orderBy[template.name] = 'DESC'
  })

  return Object.keys(orderBy).length > 0 ? orderBy : { handle: 'ASC' }
}

export function isExpectedKanbanValue(value: unknown, expected = true): boolean {
  if (typeof value === 'boolean') return value === expected
  if (typeof value === 'string') return (value === 'true') === expected
  return expected ? Boolean(value) : !value
}

export function getKanbanColumnStyle(column: SaplingGenericItem): Record<string, string> {
  const color = typeof column.color === 'string' && column.color.trim() ? column.color : '#607d8b'
  return { '--sapling-kanban-column-color': color }
}

export function getKanbanColumnIcon(column: SaplingGenericItem): string {
  return typeof column.icon === 'string' && column.icon.trim() ? column.icon : 'mdi-ray-start-arrow'
}

export function getKanbanRelationHandle(relation: unknown): string {
  if (typeof relation === 'number' || typeof relation === 'string') {
    return String(relation)
  }
  if (typeof relation === 'object' && relation !== null && 'handle' in relation) {
    return getKanbanRelationHandle((relation as { handle?: unknown }).handle)
  }
  return ''
}

export function getKanbanRelationHandleNumber(relation: unknown): number {
  const parsed = Number.parseInt(getKanbanRelationHandle(relation), 10)
  return Number.isNaN(parsed) ? Number.NaN : parsed
}

export function normalizeKanbanFilterHandles(values: string[]): number[] {
  return values.map((value) => Number.parseInt(value, 10)).filter((value) => !Number.isNaN(value))
}

export function formatKanbanDisplayValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    const item = value as SaplingGenericItem
    const label = [item.title, item.name, item.handle].find(
      (entry) => typeof entry === 'string' || typeof entry === 'number',
    )
    return label == null ? '' : String(label).trim()
  }
  return String(value).trim()
}
