import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  AccumulatedPermission,
  ColumnFilterItem,
  DialogSaveAction,
  DialogSaveContext,
  EditDialogOptions,
  EntityTemplate,
  SortItem,
} from '@/entity/structure'
import type { EntityItem, SaplingGenericItem, ScriptButtonItem } from '@/entity/entity'
import ApiGenericService, {
  getGenericUpdateConflict,
  type FilterQuery,
  type GenericUpdateConflictDetails,
} from '@/services/api.generic.service'
import { useChangeLogDialogStore } from '@/stores/changeLogDialogStore'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import {
  buildConcurrencyOptions,
  buildConcurrencyPayload,
  getItemHandle,
  normalizeConcurrencyTimestamp,
} from '@/composables/table/saplingTableAction.utils'
import { useSaplingTableFavorites } from '@/composables/table/useSaplingTableFavorites'
import { useSaplingTableTransferActions } from '@/composables/table/useSaplingTableTransferActions'
import { useSaplingTableDeleteActions } from '@/composables/table/useSaplingTableDeleteActions'
import { useSaplingTableScripts } from '@/composables/table/useSaplingTableScripts'
import { useSaplingTableContextActions } from '@/composables/table/useSaplingTableContextActions'

export interface UpdateConflictDialogState {
  visible: boolean
  conflict: GenericUpdateConflictDetails | null
  draftItem: SaplingGenericItem | null
  action: DialogSaveAction
  isSaving: boolean
}

interface UseSaplingTableActionsProps {
  items: SaplingGenericItem[]
  search: string
  sortBy: SortItem[]
  entityHandle: string
  entity: EntityItem | null
  entityPermission: AccumulatedPermission | null
  entityTemplates: EntityTemplate[]
  parentFilter?: Record<string, unknown>
  scriptButtons?: ScriptButtonItem[]
  activeFilter?: FilterQuery
  showActions?: boolean
}

type UseSaplingTableActionsEmit = {
  (event: 'reload'): void
}

interface UseSaplingTableActionsOptions {
  props: UseSaplingTableActionsProps
  emit: UseSaplingTableActionsEmit
  localColumnFilters: Ref<Record<string, ColumnFilterItem>>
  selectedItems: Ref<SaplingGenericItem[]>
  selectedRows: Ref<number[]>
  clearSelection: () => void
}

export function useSaplingTableActions({
  props,
  emit,
  localColumnFilters,
  selectedItems,
  selectedRows,
  clearSelection,
}: UseSaplingTableActionsOptions) {
  const { t } = useI18n()
  const changeLogDialogStore = useChangeLogDialogStore()
  const { pushMessage } = useSaplingMessageCenter()

  const editDialog = ref<EditDialogOptions>({ visible: false, mode: 'create', item: null })
  const updateConflictDialog = ref<UpdateConflictDialogState>({
    visible: false,
    conflict: null,
    draftItem: null,
    action: 'save',
    isSaving: false,
  })
  const {
    favoriteDialog,
    currentEntityFavorites,
    isCurrentEntityFavoritesLoading,
    activeFavoriteHandle,
    openFavoriteDialog,
    closeFavoriteDialog,
    saveFavorite,
    selectFavorite,
  } = useSaplingTableFavorites({ props, localColumnFilters })
  const {
    isDownloadingJSON,
    isImportingCSV,
    downloadJSON,
    exportCSV,
    exportCSVTemplate,
    importCSVFile,
    refreshTable,
    exportSelectedJSON,
  } = useSaplingTableTransferActions({
    props,
    localColumnFilters,
    selectedItems,
    reload: () => emit('reload'),
  })
  const {
    deleteDialog,
    bulkDeleteDialog,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
    deleteAllSelected,
    closeBulkDeleteDialog,
    confirmBulkDelete,
  } = useSaplingTableDeleteActions({
    entityHandle: () => props.entityHandle,
    selectedItems,
    selectedRows,
    clearSelection,
    reload: () => emit('reload'),
  })
  const {
    scriptButtons,
    multiSelectScriptButtons,
    rowScriptButtons,
    runSelectionScriptButton,
    runRowScriptButton,
  } = useSaplingTableScripts({
    props,
    selectedItems,
    reload: () => emit('reload'),
  })
  const {
    canNavigate,
    canShowInformation,
    contextMenu,
    contextMenuMailActions,
    showUploadDialog,
    uploadDialogItem,
    showInformationDialog,
    informationDialogItem,
    showExternalRecordLinksDialog,
    externalRecordLinksDialogItem,
    openContextMenu,
    closeContextMenu,
    onContextMenuAction,
    navigateToAddress,
    openTimeline,
    openChangeLog,
    openUploadDialog,
    closeUploadDialog,
    navigateToDocuments,
    openInformationDialog,
    closeInformationDialog,
    openExternalRecordLinksDialog,
    closeExternalRecordLinksDialog,
  } = useSaplingTableContextActions({
    props,
    loadItem: loadDialogItem,
    editItem: openEditDialog,
    showItem: openShowDialog,
    copyItem: openCopyDialog,
    deleteItem: openDeleteDialog,
    runScript: (payload) => void runRowScriptButton(payload),
  })

  function openCreateDialog() {
    editDialog.value = { visible: true, mode: 'create', item: null }
  }

  async function openEditDialog(item: SaplingGenericItem) {
    const dialogItem = await loadDialogItem(item)
    editDialog.value = { visible: true, mode: 'edit', item: dialogItem }
  }

  async function openShowDialog(item: SaplingGenericItem) {
    const dialogItem = await loadDialogItem(item)
    editDialog.value = { visible: true, mode: 'readonly', item: dialogItem }
  }

  function openCopyDialog(item: SaplingGenericItem) {
    const copiedItem = { ...item }

    props.entityTemplates
      .filter((template) => template.name === 'handle' || template.isUnique)
      .forEach((template) => {
        delete copiedItem[template.name]
      })

    editDialog.value = { visible: true, mode: 'create', item: copiedItem }
  }

  function closeDialog() {
    editDialog.value = { ...editDialog.value, visible: false }
  }

  async function loadDialogItem(item: SaplingGenericItem) {
    const handle = getItemHandle(item)
    if (handle == null || !props.entityHandle) {
      return item
    }

    const result = await ApiGenericService.find<SaplingGenericItem>(props.entityHandle, {
      filter: { handle },
      limit: 1,
      relations: getDialogItemRelations(),
    })

    return result.data[0] ?? item
  }

  function getDialogItemRelations(): string[] {
    return [
      'm:1',
      ...props.entityTemplates
        .filter((template) => template.inlineCollection && template.name)
        .map((template) => template.name),
    ]
  }

  function patchVisibleTableItem(item: SaplingGenericItem | null | undefined): void {
    const handle = getItemHandle(item)
    if (handle == null) {
      return
    }

    const itemIndex = props.items.findIndex((entry) => getItemHandle(entry) === handle)
    if (itemIndex === -1) {
      return
    }

    props.items.splice(itemIndex, 1, {
      ...props.items[itemIndex],
      ...item,
    })
  }

  async function saveDialog(
    item: SaplingGenericItem,
    action: DialogSaveAction,
    context?: DialogSaveContext,
  ) {
    if (!props.entityHandle) {
      context?.complete(false)
      return
    }

    let nextDialogItem: SaplingGenericItem | null = null
    let didSave = false
    try {
      if (editDialog.value.mode === 'edit' && editDialog.value.item) {
        const handle = getItemHandle(editDialog.value.item)
        if (handle == null) {
          return
        }

        nextDialogItem = await loadDialogItem(
          await ApiGenericService.update(props.entityHandle, handle, item, {
            concurrency: buildConcurrencyOptions(props.entityTemplates, editDialog.value.item),
            suppressConflictMessage: true,
          }),
        )
        patchVisibleTableItem(nextDialogItem)
      } else if (editDialog.value.mode === 'create') {
        nextDialogItem = await loadDialogItem(
          await ApiGenericService.create(props.entityHandle, item),
        )
      }

      didSave = true
      emit('reload')
      pushMessage(
        'success',
        t('global.recordSaved'),
        t('global.recordSavedDescription'),
        props.entityHandle,
      )

      if (action === 'saveAndClose') {
        closeDialog()
        return
      }

      editDialog.value = {
        visible: true,
        mode: 'edit',
        item: nextDialogItem ?? item,
      }
    } catch (error) {
      const conflict = getGenericUpdateConflict(error)
      if (conflict) {
        updateConflictDialog.value = {
          visible: true,
          conflict,
          draftItem: item,
          action,
          isSaving: false,
        }
      }
    } finally {
      context?.complete(didSave)
    }
  }

  function closeUpdateConflictDialog() {
    updateConflictDialog.value = {
      visible: false,
      conflict: null,
      draftItem: null,
      action: 'save',
      isSaving: false,
    }
  }

  function openUpdateConflictChangeLog() {
    const conflict = updateConflictDialog.value.conflict
    if (!conflict) {
      return
    }

    changeLogDialogStore.openChangeLog(conflict.entityHandle, String(conflict.handle))
  }

  async function reloadUpdateConflictRecord() {
    const conflict = updateConflictDialog.value.conflict
    if (!conflict?.current) {
      closeUpdateConflictDialog()
      return
    }

    const currentItem = await loadDialogItem(conflict.current)
    editDialog.value = {
      visible: true,
      mode: 'edit',
      item: currentItem,
    }
    closeUpdateConflictDialog()
    emit('reload')
  }

  async function mergeUpdateConflict(mergedItem: SaplingGenericItem) {
    const conflictState = updateConflictDialog.value
    const conflict = conflictState.conflict
    if (!conflict || !props.entityHandle || conflictState.isSaving) {
      return
    }

    const handle = getItemHandle(conflict.current) ?? conflict.handle
    if (handle == null) {
      return
    }

    updateConflictDialog.value = {
      ...conflictState,
      isSaving: true,
    }

    try {
      const savedItem = await ApiGenericService.update(props.entityHandle, handle, mergedItem, {
        concurrency: {
          expectedUpdatedAt:
            conflict.currentUpdatedAt ?? normalizeConcurrencyTimestamp(conflict.current?.updatedAt),
          basePayload: buildConcurrencyPayload(props.entityTemplates, conflict.current ?? null),
          resolution: 'detect',
        },
        suppressConflictMessage: true,
      })
      const nextDialogItem = await loadDialogItem(savedItem)
      patchVisibleTableItem(nextDialogItem)

      emit('reload')
      pushMessage(
        'success',
        t('global.recordSaved'),
        t('global.recordSavedDescription'),
        props.entityHandle,
      )

      closeUpdateConflictDialog()

      if (conflictState.action === 'saveAndClose') {
        closeDialog()
        return
      }

      editDialog.value = {
        visible: true,
        mode: 'edit',
        item: nextDialogItem ?? mergedItem,
      }
    } catch (error) {
      const nextConflict = getGenericUpdateConflict(error)
      if (nextConflict) {
        updateConflictDialog.value = {
          ...conflictState,
          visible: true,
          conflict: nextConflict,
          draftItem: mergedItem,
          isSaving: false,
        }
        return
      }

      updateConflictDialog.value = {
        ...conflictState,
        isSaving: false,
      }
    }
  }

  return {
    scriptButtons,
    multiSelectScriptButtons,
    rowScriptButtons,
    canNavigate,
    canShowInformation,
    editDialog,
    deleteDialog,
    bulkDeleteDialog,
    updateConflictDialog,
    showUploadDialog,
    uploadDialogItem,
    showInformationDialog,
    informationDialogItem,
    showExternalRecordLinksDialog,
    externalRecordLinksDialogItem,
    contextMenu,
    contextMenuMailActions,
    favoriteDialog,
    currentEntityFavorites,
    isCurrentEntityFavoritesLoading,
    activeFavoriteHandle,
    isDownloadingJSON,
    isImportingCSV,
    downloadJSON,
    exportCSV,
    exportCSVTemplate,
    importCSVFile,
    refreshTable,
    exportSelectedJSON,
    openContextMenu,
    closeContextMenu,
    onContextMenuAction,
    navigateToAddress,
    openTimeline,
    openChangeLog,
    openUploadDialog,
    closeUploadDialog,
    navigateToDocuments,
    openInformationDialog,
    closeInformationDialog,
    openExternalRecordLinksDialog,
    closeExternalRecordLinksDialog,
    openFavoriteDialog,
    closeFavoriteDialog,
    saveFavorite,
    selectFavorite,
    openCreateDialog,
    openEditDialog,
    openShowDialog,
    openCopyDialog,
    closeDialog,
    saveDialog,
    closeUpdateConflictDialog,
    openUpdateConflictChangeLog,
    reloadUpdateConflictRecord,
    mergeUpdateConflict,
    confirmDelete,
    openDeleteDialog,
    closeDeleteDialog,
    deleteAllSelected,
    confirmBulkDelete,
    closeBulkDeleteDialog,
    runSelectionScriptButton,
    runRowScriptButton,
  }
}
