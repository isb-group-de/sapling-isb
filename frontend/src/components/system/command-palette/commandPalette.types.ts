export type CommandPaletteGroupKey = 'record' | 'favorite' | 'entity' | 'action'

export interface CommandPaletteItem {
  id: string
  group: CommandPaletteGroupKey
  label: string
  hint?: string
  context?: string
  icon: string
  haystack: string
  path: string
  flatIndex: number
  run?: () => void | Promise<void>
}

export interface CommandPaletteGroup {
  key: CommandPaletteGroupKey
  label: string
  items: CommandPaletteItem[]
}
