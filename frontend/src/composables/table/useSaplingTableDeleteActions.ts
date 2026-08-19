import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { getItemHandle } from '@/composables/table/saplingTableAction.utils'

interface DeleteDialogState {
  visible: boolean
  item: SaplingGenericItem | null
}

interface BulkDeleteDialogState {
  visible: boolean
  items: SaplingGenericItem[]
}

interface UseSaplingTableDeleteActionsOptions {
  entityHandle: () => string
  selectedItems: Ref<SaplingGenericItem[]>
  selectedRows: Ref<number[]>
  clearSelection: () => void
  reload: () => void
}

const BULK_DELETE_CONCURRENCY = 5

/** Owns confirmation state and bounded deletion commands for generic tables. */
export function useSaplingTableDeleteActions({
  entityHandle,
  selectedItems,
  selectedRows,
  clearSelection,
  reload,
}: UseSaplingTableDeleteActionsOptions) {
  const { t } = useI18n()
  const { pushMessage } = useSaplingMessageCenter()
  const deleteDialog = ref<DeleteDialogState>({ visible: false, item: null })
  const bulkDeleteDialog = ref<BulkDeleteDialogState>({ visible: false, items: [] })

  function openDeleteDialog(item: SaplingGenericItem) {
    deleteDialog.value = { visible: true, item }
  }

  function closeDeleteDialog() {
    deleteDialog.value = { visible: false, item: null }
  }

  async function confirmDelete(
    confirmation: { cascadeRelations: string[] } = { cascadeRelations: [] },
  ) {
    const currentEntityHandle = entityHandle()
    const handle = getItemHandle(deleteDialog.value.item)
    if (handle == null || !currentEntityHandle) {
      return
    }

    try {
      const result = await ApiGenericService.delete(currentEntityHandle, handle, {
        cascadeRelations: confirmation.cascadeRelations,
      })
      const action = result?.action ?? 'deleted'
      closeDeleteDialog()
      reload()
      pushMessage(
        'success',
        t(action === 'canceled' ? 'global.eventCanceled' : 'global.recordDeleted'),
        t(
          action === 'canceled'
            ? 'global.eventCanceledDescription'
            : 'global.recordDeletedDescription',
        ),
        currentEntityHandle,
      )
    } catch {
      // API errors are already routed through the shared message center.
    }
  }

  function deleteAllSelected() {
    if (selectedRows.value.length === 0) {
      return
    }

    bulkDeleteDialog.value = {
      visible: true,
      items: [...selectedItems.value],
    }
  }

  function closeBulkDeleteDialog() {
    bulkDeleteDialog.value = { visible: false, items: [] }
  }

  async function confirmBulkDelete() {
    const currentEntityHandle = entityHandle()
    if (!currentEntityHandle) {
      return
    }

    const handles = bulkDeleteDialog.value.items
      .map((item) => getItemHandle(item))
      .filter((handle): handle is string | number => handle != null)

    try {
      for (let index = 0; index < handles.length; index += BULK_DELETE_CONCURRENCY) {
        const batch = handles.slice(index, index + BULK_DELETE_CONCURRENCY)
        await Promise.all(
          batch.map((handle) => ApiGenericService.delete(currentEntityHandle, handle)),
        )
      }

      clearSelection()
      closeBulkDeleteDialog()
      reload()
      pushMessage(
        'success',
        t('global.recordsDeleted'),
        t('global.recordsDeletedDescription', { count: handles.length }),
        currentEntityHandle,
      )
    } catch {
      // API errors are already routed through the shared message center.
    }
  }

  return {
    deleteDialog,
    bulkDeleteDialog,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
    deleteAllSelected,
    closeBulkDeleteDialog,
    confirmBulkDelete,
  }
}
