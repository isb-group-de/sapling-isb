import { ref, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import type {
  FormConfigMenuItem,
  FormConfigSelectionHandle,
} from '@/composables/dialog/saplingDialogEdit.utils'
import type { SaplingTableViewSaveRequest } from '@/composables/table/saplingTableColumnOrder'
import type { FavoriteItem } from '@/entity/entity'
import type { EditDialogOptions } from '@/entity/structure'
import type { SaplingBulkMailAction } from '@/utils/saplingMailMenuUtil'
import { useSaplingTableRouteDialogSync } from '@/composables/table/useSaplingTableRouteDialogSync'

interface SaplingTableShellProps {
  entityHandle: string
  isSavingTableView?: boolean
  selectedFormConfigLabel?: string
  syncEditDialogWithRoute?: boolean
}

interface SaplingTableShellActionsOptions {
  props: SaplingTableShellProps
  orderedColumnKeys: Ref<string[]>
  selectableColumnKeys: Ref<string[]>
  editDialog: Ref<EditDialogOptions>
  deleteFavorite: (favorite: FavoriteItem) => Promise<void>
  importCSVFile: (file: File | null) => Promise<void>
  resetColumnOrder: () => void
  emitDeleteFormConfig: (value: { handle: number; complete: (deleted: boolean) => void }) => void
  emitSaveCurrentView: (value: SaplingTableViewSaveRequest) => void
  emitSelectFormConfig: (handle: FormConfigSelectionHandle) => void
}

export function useSaplingTableShellActions({
  props,
  orderedColumnKeys,
  selectableColumnKeys,
  editDialog,
  deleteFavorite,
  importCSVFile,
  resetColumnOrder,
  emitDeleteFormConfig,
  emitSaveCurrentView,
  emitSelectFormConfig,
}: SaplingTableShellActionsOptions) {
  const route = useRoute()
  const router = useRouter()
  const { openMailDialog } = useSaplingMailDialog()
  const importInputRef = ref<HTMLInputElement | null>(null)
  const tableViewDialog = ref({ visible: false, name: '', loading: false })
  const savedItemDeleteDialog = ref<{
    visible: boolean
    kind: 'favorite' | 'view'
    title: string
    loading: boolean
    favorite: FavoriteItem | null
    formConfig: FormConfigMenuItem | null
  }>({
    visible: false,
    kind: 'favorite',
    title: '',
    loading: false,
    favorite: null,
    formConfig: null,
  })
  const isColumnOrderEditing = ref(false)
  const isColumnChooserOpen = ref(false)

  useSaplingTableRouteDialogSync({
    enabled: () => props.syncEditDialogWithRoute === true,
    editDialog,
    router,
    getRoute: () => route,
  })

  function resetShellState(): void {
    isColumnOrderEditing.value = false
    isColumnChooserOpen.value = false
  }

  function onMailToSelected(action: SaplingBulkMailAction): void {
    if (action.emails.length === 0) return
    openMailDialog({ entityHandle: props.entityHandle, initialTo: action.emails })
  }

  function openImportFilePicker(): void {
    importInputRef.value?.click()
  }

  function openTableViewDialog(): void {
    tableViewDialog.value = {
      visible: true,
      name: props.selectedFormConfigLabel?.trim() ?? '',
      loading: false,
    }
  }

  function beginColumnOrderEdit(): void {
    isColumnOrderEditing.value = true
  }

  function finishColumnOrderEdit(): void {
    resetShellState()
  }

  function selectFormConfig(handle: FormConfigSelectionHandle): void {
    resetShellState()
    resetColumnOrder()
    emitSelectFormConfig(handle)
  }

  function closeTableViewDialog(): void {
    if (tableViewDialog.value.loading || props.isSavingTableView) return
    tableViewDialog.value = { visible: false, name: '', loading: false }
  }

  function openFavoriteDeleteDialog(favorite: FavoriteItem): void {
    savedItemDeleteDialog.value = {
      visible: true,
      kind: 'favorite',
      title: favorite.title,
      loading: false,
      favorite,
      formConfig: null,
    }
  }

  function openFormConfigDeleteDialog(item: FormConfigMenuItem): void {
    if (!item.canDelete || typeof item.handle !== 'number') return
    savedItemDeleteDialog.value = {
      visible: true,
      kind: 'view',
      title: item.title,
      loading: false,
      favorite: null,
      formConfig: item,
    }
  }

  function closeSavedItemDeleteDialog(): void {
    if (savedItemDeleteDialog.value.loading) return
    savedItemDeleteDialog.value = {
      visible: false,
      kind: 'favorite',
      title: '',
      loading: false,
      favorite: null,
      formConfig: null,
    }
  }

  function updateSavedItemDeleteDialog(value: boolean): void {
    savedItemDeleteDialog.value.visible = value
  }

  async function confirmSavedItemDelete(): Promise<void> {
    const dialog = savedItemDeleteDialog.value
    if (dialog.loading) return
    if (dialog.kind === 'favorite' && dialog.favorite) {
      dialog.loading = true
      try {
        await deleteFavorite(dialog.favorite)
        dialog.loading = false
        closeSavedItemDeleteDialog()
      } catch {
        dialog.loading = false
      }
      return
    }

    const handle = dialog.formConfig?.handle
    if (typeof handle !== 'number') return
    dialog.loading = true
    emitDeleteFormConfig({
      handle,
      complete(deleted) {
        dialog.loading = false
        if (deleted) closeSavedItemDeleteDialog()
      },
    })
  }

  function saveCurrentView(): void {
    const name = tableViewDialog.value.name.trim()
    if (!name || tableViewDialog.value.loading || props.isSavingTableView) return
    tableViewDialog.value.loading = true
    emitSaveCurrentView({
      name,
      orderedColumnKeys: [...orderedColumnKeys.value],
      selectableColumnKeys: [...selectableColumnKeys.value],
      complete(saved) {
        tableViewDialog.value.loading = false
        if (saved) {
          resetShellState()
          tableViewDialog.value = { visible: false, name: '', loading: false }
        }
      },
    })
  }

  async function openFormConfigForTable(): Promise<void> {
    if (!props.entityHandle) return
    await router.push({ name: 'formConfig', query: { entity: props.entityHandle } })
  }

  function onImportFileInputChange(event: Event): void {
    const target = event.target as HTMLInputElement | null
    void importCSVFile(target?.files?.[0] ?? null)
    if (target) target.value = ''
  }

  return {
    importInputRef,
    tableViewDialog,
    savedItemDeleteDialog,
    isColumnOrderEditing,
    isColumnChooserOpen,
    resetShellState,
    onMailToSelected,
    openImportFilePicker,
    openTableViewDialog,
    beginColumnOrderEdit,
    finishColumnOrderEdit,
    selectFormConfig,
    closeTableViewDialog,
    openFavoriteDeleteDialog,
    openFormConfigDeleteDialog,
    closeSavedItemDeleteDialog,
    updateSavedItemDeleteDialog,
    confirmSavedItemDelete,
    saveCurrentView,
    openFormConfigForTable,
    onImportFileInputChange,
  }
}
