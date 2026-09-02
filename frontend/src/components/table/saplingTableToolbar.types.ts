import type {
  FormConfigMenuItem,
  FormConfigSelectionHandle,
} from '@/composables/dialog/saplingDialogEdit.utils'
import type { SaplingTableAutoRefreshInterval } from '@/composables/table/useSaplingTableAutoRefresh'
import type { FavoriteItem } from '@/entity/entity'

export interface SaplingTableToolbarActionsProps {
  isMobileTable: boolean
  isDownloadingJson: boolean
  isImportingCsv: boolean
  refreshButtonLabel: string
  autoRefreshIntervalMinutes: SaplingTableAutoRefreshInterval | null
  secondsUntilRefresh: number | null
  showFavorite: boolean
  showImport: boolean
  showAdd: boolean
  favoriteItems: FavoriteItem[]
  isFavoritesLoading: boolean
  activeFavoriteHandle?: number | null
  formConfigMenuItems: FormConfigMenuItem[]
  selectedFormConfigLabel?: string
  isLoadingFormConfigs: boolean
  canSaveCurrentView: boolean
  showFormConfigButton: boolean
  hasTemporaryColumnOrder: boolean
  isColumnOrderEditing: boolean
  isColumnChooserOpen: boolean
}

export type SaplingTableToolbarActionsEmit = {
  downloadJson: []
  downloadCsv: []
  downloadCsvTemplate: []
  importCsv: []
  refresh: []
  'update:autoRefreshIntervalMinutes': [value: SaplingTableAutoRefreshInterval | null]
  favorite: []
  resetWorklist: []
  selectFavorite: [favorite: FavoriteItem]
  deleteFavorite: [favorite: FavoriteItem]
  selectFormConfig: [handle: FormConfigSelectionHandle]
  saveCurrentView: []
  resetTemporaryColumnOrder: []
  beginColumnOrderEdit: []
  finishColumnOrderEdit: []
  toggleColumnChooser: []
  setDefaultFormConfig: [handle: number]
  deleteFormConfig: [item: FormConfigMenuItem]
  openFormConfig: []
  add: []
}
