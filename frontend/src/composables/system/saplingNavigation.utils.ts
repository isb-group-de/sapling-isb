import type { EntityGroupItem, EntityItem, EntityRouteItem } from '@/entity/entity'

export function matchesNavigationSearch(query: string, ...values: unknown[]): boolean {
  if (!query) return true
  return values.some((value) => normalizeNavigationText(value).includes(query))
}

export function normalizeNavigationText(value: unknown): string {
  if (typeof value === 'string') return value.trim().toLocaleLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value).toLocaleLowerCase()
  }
  if (Array.isArray(value)) return value.map(normalizeNavigationText).filter(Boolean).join(' ')
  return ''
}

export function sortNavigationGroups(
  groups: EntityGroupItem[],
  getLabel: (handle: string) => string,
): EntityGroupItem[] {
  return [...groups].sort((left, right) => {
    const orderDelta = (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
    return orderDelta || getLabel(left.handle).localeCompare(getLabel(right.handle))
  })
}

export function toggleNavigationHandle(current: string[], handle: string): string[] {
  return current.includes(handle)
    ? current.filter((entry) => entry !== handle)
    : [...current, handle]
}

export function getNavigationGroupParentHandle(group?: EntityGroupItem | null): string | null {
  const parent = group?.parent
  if (typeof parent === 'string') return parent || null
  return parent && typeof parent === 'object' ? parent.handle || null : null
}

export function getEntityNavigationGroupHandle(entity: EntityItem): string | null {
  const group = entity.group
  if (typeof group === 'string') return group || null
  return group && typeof group === 'object' ? group.handle || null : null
}

export function getRouteNavigationGroupHandle(route: EntityRouteItem): string | null {
  const group = route.group
  if (typeof group === 'string') return group || null
  return group && typeof group === 'object' ? group.handle || null : null
}

export function getEffectiveRouteGroupHandle(
  entity: EntityItem,
  route: EntityRouteItem,
): string | null {
  return getRouteNavigationGroupHandle(route) ?? getEntityNavigationGroupHandle(entity)
}

export function getEntityRoutesForNavigationGroup(
  entity: EntityItem,
  groupHandle: string,
): EntityRouteItem[] {
  return getFilterableEntityRoutes(entity).filter(
    (route) => getEffectiveRouteGroupHandle(entity, route) === groupHandle,
  )
}

export function getEntityNavigationGroupHandles(entity: EntityItem): Set<string> {
  return new Set(
    getFilterableEntityRoutes(entity)
      .map((route) => getEffectiveRouteGroupHandle(entity, route))
      .filter((handle): handle is string => Boolean(handle)),
  )
}

export function getFilterableEntityRoutes(entity: EntityItem): EntityRouteItem[] {
  return [...(entity.routes ?? [])].filter((route) => Boolean(route.route))
}

export function getEntityNavigationSortOrder(entity: EntityItem): number {
  return entity.order ?? 0
}
