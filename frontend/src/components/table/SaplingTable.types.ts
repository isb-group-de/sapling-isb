import type {
  FormConfigMenuItem,
  FormConfigSelectionHandle,
} from '@/composables/dialog/saplingDialogEdit.utils'
import type { SaplingTableViewSaveRequest } from '@/composables/table/saplingTableColumnOrder'
import type {
  UseSaplingTableEmit,
  UseSaplingTableProps,
} from '@/composables/table/useSaplingTableComponent'

export type SaplingTableProps = UseSaplingTableProps & {
  enableTutorial?: boolean
  showFavorite?: boolean
  showAdd?: boolean
  showImport?: boolean
  showSearch?: boolean
  showFormConfig?: boolean
  showToolbar?: boolean
  showSelectionToolbar?: boolean
  isInitialized?: boolean
  rowInteraction?: boolean
  showSidePanelToggle?: boolean
  sidePanelVisible?: boolean
  sidePanelToggleLabel?: string
  sidePanelToggleIcon?: string
  formConfigMenuItems?: FormConfigMenuItem[]
  selectedFormConfigLabel?: string
  isLoadingFormConfigs?: boolean
  isSavingTableView?: boolean
  syncEditDialogWithRoute?: boolean
}

export type SaplingTableEmit = UseSaplingTableEmit & {
  (event: 'toggleSidePanel'): void
  (event: 'resetWorklist'): void
  (event: 'selectFormConfig', value: FormConfigSelectionHandle): void
  (event: 'setDefaultFormConfig', value: number): void
  (event: 'deleteFormConfig', value: { handle: number; complete: (deleted: boolean) => void }): void
  (event: 'saveCurrentView', value: SaplingTableViewSaveRequest): void
}
