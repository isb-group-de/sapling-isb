import type { SaplingGenericItem } from '@/entity/entity'
import type { DialogState } from '@/entity/structure'

export type KanbanBoardScope = 'open' | 'all'

export interface KanbanEditDialogState {
  visible: boolean
  mode: DialogState
  item: SaplingGenericItem | null
}

export interface KanbanBoardProps {
  entityHandle: string
  navigationKey?: string
}
