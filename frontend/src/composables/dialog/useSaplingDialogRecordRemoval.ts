import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import type { AccumulatedPermission } from '@/entity/structure'
import type { RecordMergeResult } from '@/services/api.merge.service'
import ApiGenericService from '@/services/api.generic.service'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

type RemovalEmit = {
  (event: 'update:modelValue', value: boolean): void
  (event: 'cancel'): void
  (event: 'deleted', value: SaplingGenericItem | null): void
}

/** Owns the destructive actions and their shared close/refresh behavior. */
export function useSaplingDialogRecordRemoval(
  props: { modelValue: boolean; item: SaplingGenericItem | null },
  entityHandle: Readonly<Ref<string>>,
  permission: Readonly<Ref<AccumulatedPermission | null>>,
  disabled: Readonly<Ref<boolean>>,
  emit: RemovalEmit,
) {
  const { t } = useI18n()
  const { pushMessage } = useSaplingMessageCenter()
  const recordDeleteDialog = ref(false)
  const recordMergeDialog = ref(false)
  const canDeleteRecord = computed(
    () => props.item?.handle != null && Boolean(permission.value?.allowDelete),
  )

  function openRecordDeleteDialog() {
    if (canDeleteRecord.value) recordDeleteDialog.value = true
  }
  function closeRecordDeleteDialog() {
    recordDeleteDialog.value = false
  }
  function openRecordMergeDialog() {
    if (
      !disabled.value &&
      canDeleteRecord.value &&
      permission.value?.allowRead &&
      permission.value.allowUpdate
    ) {
      recordMergeDialog.value = true
    }
  }
  function completeRemoval(item: SaplingGenericItem | null) {
    emit('deleted', item)
    emit('update:modelValue', false)
    emit('cancel')
  }
  function handleRecordMerged(result: RecordMergeResult) {
    recordMergeDialog.value = false
    completeRemoval({ handle: result.deletedHandle })
  }
  async function confirmRecordDelete(
    confirmation: { cascadeRelations: string[] } = { cascadeRelations: [] },
  ) {
    const handle = props.item?.handle
    if (!entityHandle.value || handle == null) return
    try {
      const result = await ApiGenericService.delete(entityHandle.value, handle, {
        cascadeRelations: confirmation.cascadeRelations,
      })
      const action = result?.action ?? 'deleted'
      closeRecordDeleteDialog()
      pushMessage(
        'success',
        t(action === 'canceled' ? 'global.eventCanceled' : 'global.recordDeleted'),
        t(
          action === 'canceled'
            ? 'global.eventCanceledDescription'
            : 'global.recordDeletedDescription',
        ),
        entityHandle.value,
      )
      completeRemoval(props.item)
    } catch {
      // API errors are already routed through the shared message center.
    }
  }
  watch(
    () => [props.modelValue, entityHandle.value, props.item?.handle],
    () => {
      recordMergeDialog.value = false
      closeRecordDeleteDialog()
    },
  )

  return {
    recordDeleteDialog,
    recordMergeDialog,
    canDeleteRecord,
    openRecordDeleteDialog,
    closeRecordDeleteDialog,
    openRecordMergeDialog,
    handleRecordMerged,
    confirmRecordDelete,
  }
}
