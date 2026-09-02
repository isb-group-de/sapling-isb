import type { EntityRouteItem } from '@/entity/entity'
import type {
  CommandPaletteGroup,
  CommandPaletteItem,
} from '@/components/system/command-palette/commandPalette.types'

export function getUniqueEntityRoutes(routes: EntityRouteItem[]): EntityRouteItem[] {
  const seenPaths = new Set<string>()

  return routes.filter((route) => {
    const path = normalizeRoutePath(route.route)
    if (!path || seenPaths.has(path)) return false
    seenPaths.add(path)
    return true
  })
}

export function normalizeRoutePath(route: EntityRouteItem['route']): string {
  return (route ?? '').replace(/^\/+/, '')
}

export function groupCommandPaletteItems(
  items: CommandPaletteItem[],
  translate: (key: string) => string,
): CommandPaletteGroup[] {
  const reindexed = items.map((item, index) => ({ ...item, flatIndex: index }))
  const definitions = [
    ['favorite', 'global.commandPalette.favorites'],
    ['entity', 'global.commandPalette.entities'],
    ['action', 'global.commandPalette.actions'],
    ['record', 'global.commandPalette.records'],
  ] as const

  return definitions.flatMap(([key, labelKey]) => {
    const groupItems = reindexed.filter((item) => item.group === key)
    return groupItems.length ? [{ key, label: translate(labelKey), items: groupItems }] : []
  })
}
