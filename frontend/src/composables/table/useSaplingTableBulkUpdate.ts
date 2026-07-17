import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import {
  getItemHandle,
  normalizeConcurrencyTimestamp,
} from '@/composables/table/saplingTableAction.utils'

export type BulkUpdateDialogState = {
  visible: boolean
  isSaving: boolean
  items: SaplingGenericItem[]
}

interface UseSaplingTableBulkUpdateOptions {
  entityHandle: () => string
  selectedItems: Ref<SaplingGenericItem[]>
  clearSelection: () => void
  reload: () => void
}

export function useSaplingTableBulkUpdate({
  entityHandle,
  selectedItems,
  clearSelection,
  reload,
}: UseSaplingTableBulkUpdateOptions) {
  const { t } = useI18n()
  const { pushMessage } = useSaplingMessageCenter()
  const bulkUpdateDialog = ref<BulkUpdateDialogState>({
    visible: false,
    isSaving: false,
    items: [],
  })

  function openBulkUpdateDialog(): void {
    if (selectedItems.value.length === 0) {
      return
    }

    bulkUpdateDialog.value = {
      visible: true,
      isSaving: false,
      items: [...selectedItems.value],
    }
  }

  function closeBulkUpdateDialog(): void {
    if (bulkUpdateDialog.value.isSaving) {
      return
    }

    bulkUpdateDialog.value = {
      ...bulkUpdateDialog.value,
      visible: false,
    }
  }

  async function applyBulkUpdate(changes: Record<string, unknown>): Promise<void> {
    const handle = entityHandle()
    const items = [...bulkUpdateDialog.value.items]
    if (!handle || items.length === 0 || bulkUpdateDialog.value.isSaving) {
      return
    }

    const targets = items
      .map((item) => {
        const itemHandle = getItemHandle(item)
        if (itemHandle == null) {
          return null
        }

        return {
          handle: itemHandle,
          expectedUpdatedAt: normalizeConcurrencyTimestamp(item.updatedAt),
        }
      })
      .filter((target): target is NonNullable<typeof target> => target !== null)

    if (targets.length !== items.length) {
      return
    }

    bulkUpdateDialog.value = { ...bulkUpdateDialog.value, isSaving: true }
    try {
      const result = await ApiGenericService.bulkUpdate(handle, { targets, changes })
      bulkUpdateDialog.value = { visible: false, isSaving: false, items: [] }
      clearSelection()
      reload()
      pushMessage(
        'success',
        t('global.bulkUpdateSuccess'),
        t('global.bulkUpdateSuccessDescription', { count: result.updatedCount }),
        handle,
      )
    } catch {
      bulkUpdateDialog.value = { ...bulkUpdateDialog.value, isSaving: false }
    }
  }

  return {
    bulkUpdateDialog,
    openBulkUpdateDialog,
    closeBulkUpdateDialog,
    applyBulkUpdate,
  }
}
