import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiMergeService, {
  type RecordMergePreview,
  type RecordMergeResult,
  type RecordMergeSource,
} from '@/services/api.merge.service'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

interface RecordMergeProps {
  modelValue: boolean
  entityHandle: string
  item: SaplingGenericItem | null
}

export function useSaplingRecordMerge(
  props: RecordMergeProps,
  onMerged: (result: RecordMergeResult) => void,
) {
  const { t } = useI18n()
  const { pushMessage } = useSaplingMessageCenter()
  const loser = ref<SaplingGenericItem | null>(null)
  const winner = ref<SaplingGenericItem | null>(null)
  const preview = ref<RecordMergePreview | null>(null)
  const selections = ref<Record<string, RecordMergeSource>>({})
  const loading = ref(false)
  const saving = ref(false)
  let requestId = 0

  const pair = computed(() => {
    const loserHandle = loser.value?.handle
    const winnerHandle = winner.value?.handle
    if (
      (typeof loserHandle !== 'number' && typeof loserHandle !== 'string') ||
      (typeof winnerHandle !== 'number' && typeof winnerHandle !== 'string') ||
      String(loserHandle) === String(winnerHandle)
    )
      return null
    return { loserHandle, winnerHandle }
  })

  function resetPreview() {
    requestId++
    preview.value = null
    selections.value = {}
    loading.value = false
  }

  watch(
    () => [props.modelValue, props.entityHandle, props.item?.handle],
    () => {
      resetPreview()
      loser.value = props.modelValue ? props.item : null
      winner.value = null
    },
    { immediate: true },
  )

  watch(pair, () => resetPreview(), { flush: 'sync' })

  async function loadPreview() {
    if (!pair.value || saving.value || loading.value) return
    const id = ++requestId
    loading.value = true
    preview.value = null
    try {
      const result = await ApiMergeService.preview(props.entityHandle, pair.value)
      if (id !== requestId || !props.modelValue) return
      preview.value = result
      selections.value = Object.fromEntries(
        result.fields
          .filter((field) => field.selectable)
          .map((field) => [field.property, field.selectedSource]),
      )
    } catch {
      // The API client reports errors through the shared message center.
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function swap() {
    if (!pair.value || loading.value || saving.value) return
    const previousLoser = loser.value
    loser.value = winner.value
    winner.value = previousLoser
  }

  async function merge() {
    if (!pair.value || !preview.value || saving.value || loading.value) return
    saving.value = true
    try {
      const result = await ApiMergeService.merge(props.entityHandle, {
        ...pair.value,
        previewToken: preview.value.previewToken,
        selections: { ...selections.value },
      })
      pushMessage(
        'success',
        t('recordMerge.success'),
        t('recordMerge.successDescription'),
        props.entityHandle,
      )
      onMerged(result)
    } catch {
      // Every failed save requires a fresh comparison; never resubmit stale choices.
      resetPreview()
    } finally {
      saving.value = false
    }
  }

  return { loser, winner, pair, preview, selections, loading, saving, swap, loadPreview, merge }
}
