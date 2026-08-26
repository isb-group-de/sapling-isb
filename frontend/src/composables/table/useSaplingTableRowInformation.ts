import { computed, ref, watch } from 'vue'
import ApiGenericService from '@/services/api.generic.service'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useGenericStore } from '@/stores/genericStore'
import type { InformationItem, SaplingGenericItem } from '@/entity/entity'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

export interface UseSaplingTableRowInformationProps {
  show: boolean
  item: SaplingGenericItem | null
  entityHandle: string
  closeAfterSave?: boolean
}

export type UseSaplingTableRowInformationEmit = {
  (event: 'close'): void
  (event: 'saved'): void
}

export function useSaplingTableRowInformation(
  props: UseSaplingTableRowInformationProps,
  emit: UseSaplingTableRowInformationEmit,
) {
  const genericStore = useGenericStore()
  const currentPersonStore = useCurrentPersonStore()
  const { pushMessage } = useSaplingMessageCenter()

  const content = ref('')
  const currentInformation = ref<InformationItem | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)

  const referenceHandle = computed(() => {
    const handle = props.item?.handle
    return handle == null ? '' : String(handle)
  })

  const informationState = computed(() => genericStore.getState('information'))
  const informationPermission = computed(() => informationState.value.entityPermission)

  const hasExistingRecord = computed(() => currentInformation.value?.handle != null)
  const trimmedContent = computed(() => content.value.trim())
  const isDirty = computed(() => content.value !== (currentInformation.value?.content ?? ''))
  const canEdit = computed(
    () =>
      Boolean(informationPermission.value?.allowInsert) ||
      Boolean(informationPermission.value?.allowUpdate) ||
      Boolean(informationPermission.value?.allowDelete),
  )

  const canSave = computed(() => {
    if (!canEdit.value || isLoading.value || isSaving.value || !referenceHandle.value) {
      return false
    }

    if (hasExistingRecord.value) {
      return trimmedContent.value.length > 0
        ? Boolean(informationPermission.value?.allowUpdate)
        : Boolean(informationPermission.value?.allowDelete)
    }

    return trimmedContent.value.length > 0 && Boolean(informationPermission.value?.allowInsert)
  })

  watch(
    () => [props.show, referenceHandle.value, props.entityHandle] as const,
    ([show]) => {
      if (!show) {
        resetState()
        return
      }

      void loadInformation()
    },
    { immediate: true },
  )

  function resetState() {
    content.value = ''
    currentInformation.value = null
    isLoading.value = false
    isSaving.value = false
  }

  function onDialogModelValueUpdate(value: boolean) {
    if (!value) {
      resetState()
      emit('close')
    }
  }

  async function loadInformation() {
    if (!referenceHandle.value) {
      pushMessage('error', 'global.referenceNotFound', '', props.entityHandle)
      return
    }

    isLoading.value = true
    try {
      await genericStore.loadGeneric('information', 'global')

      const response = await ApiGenericService.find<InformationItem>('information', {
        filter: {
          entity: props.entityHandle,
          reference: referenceHandle.value,
        },
        relations: ['entity', 'person'],
        page: 1,
        limit: 1,
      })

      currentInformation.value = response.data[0] ?? null
      content.value = currentInformation.value?.content ?? ''
    } catch {
      currentInformation.value = null
      content.value = ''
    } finally {
      isLoading.value = false
    }
  }

  function discardChanges(): void {
    content.value = currentInformation.value?.content ?? ''
  }

  async function save(): Promise<boolean> {
    if (!isDirty.value) {
      return true
    }

    if (!canSave.value) {
      return false
    }

    isSaving.value = true

    try {
      if (hasExistingRecord.value && currentInformation.value?.handle != null) {
        if (trimmedContent.value.length === 0) {
          await ApiGenericService.delete('information', currentInformation.value.handle)
          currentInformation.value = null
          content.value = ''
          emit('saved')
          closeAfterSave()
          return true
        }

        currentInformation.value = await ApiGenericService.update<InformationItem>(
          'information',
          currentInformation.value.handle,
          { content: trimmedContent.value },
          { relations: ['entity', 'person'] },
        )
        content.value = currentInformation.value.content ?? trimmedContent.value
        emit('saved')
        closeAfterSave()
        return true
      }

      await currentPersonStore.fetchCurrentPerson()
      const personHandle = currentPersonStore.person?.handle
      if (personHandle == null) {
        pushMessage('error', 'global.entityNotFound', '', 'information')
        return false
      }

      currentInformation.value = await ApiGenericService.create<InformationItem>('information', {
        content: trimmedContent.value,
        entity: props.entityHandle,
        person: personHandle,
        reference: referenceHandle.value,
      })
      content.value = currentInformation.value.content ?? trimmedContent.value

      emit('saved')
      closeAfterSave()
      return true
    } catch {
      return false
    } finally {
      isSaving.value = false
    }
  }

  function closeAfterSave() {
    if (props.closeAfterSave === false) {
      return
    }

    resetState()
    emit('close')
  }

  return {
    content,
    isLoading,
    isSaving,
    hasExistingRecord,
    isDirty,
    canEdit,
    canSave,
    onDialogModelValueUpdate,
    discardChanges,
    save,
  }
}
