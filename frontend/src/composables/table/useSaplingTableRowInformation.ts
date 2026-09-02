import { computed, ref, watch } from 'vue'
import ApiGenericService from '@/services/api.generic.service'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useGenericStore } from '@/stores/genericStore'
import type { InformationItem, SaplingGenericItem } from '@/entity/entity'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import {
  clearSaplingDialogDraft,
  getCurrentDialogDraftRoute,
  normalizeDialogDraftIdentifier,
  readSaplingDialogDraft,
  writeSaplingDialogDraft,
  type SaplingDialogDraftContext,
} from '@/composables/dialog/saplingDialogDraftStorage'

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
  const activeDraftContext = ref<SaplingDialogDraftContext | null>(null)

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
        discardChanges()
        resetState()
        return
      }

      void loadInformation()
    },
    { immediate: true },
  )

  watch(
    content,
    () => {
      const context = activeDraftContext.value
      if (!context || isLoading.value) {
        return
      }

      if (!isDirty.value) {
        clearSaplingDialogDraft('information', context)
        return
      }

      writeSaplingDialogDraft('information', context, { content: content.value })
    },
    { flush: 'post' },
  )

  function resetState() {
    content.value = ''
    currentInformation.value = null
    isLoading.value = false
    isSaving.value = false
    activeDraftContext.value = null
  }

  function onDialogModelValueUpdate(value: boolean) {
    if (!value) {
      discardChanges()
      resetState()
      emit('close')
    }
  }

  async function loadInformation() {
    if (!referenceHandle.value) {
      pushMessage('error', 'global.referenceNotFound', '', props.entityHandle)
      return
    }

    const route = getCurrentDialogDraftRoute()
    activeDraftContext.value = null
    isLoading.value = true
    try {
      await Promise.all([
        genericStore.loadGeneric('information', 'global'),
        currentPersonStore.fetchCurrentPerson(),
      ])

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
      activeDraftContext.value = createDraftContext(route)
      const draft = readSaplingDialogDraft('information', activeDraftContext.value)
      if (typeof draft?.content === 'string') {
        content.value = draft.content
      }
    } catch {
      currentInformation.value = null
      content.value = ''
    } finally {
      isLoading.value = false
    }
  }

  function discardChanges(): void {
    clearSaplingDialogDraft('information', activeDraftContext.value)
    content.value = currentInformation.value?.content ?? ''
  }

  function createDraftContext(route = getCurrentDialogDraftRoute()): SaplingDialogDraftContext {
    return {
      route,
      personHandle: normalizeDialogDraftIdentifier(currentPersonStore.person?.handle),
      entityHandle: props.entityHandle,
      mode: 'edit',
      recordHandle: referenceHandle.value,
      recordVersion: normalizeDialogDraftIdentifier(props.item?.updatedAt),
      parentEntityHandle: '',
      parentRecordHandle: '',
      detailHandle: normalizeDialogDraftIdentifier(currentInformation.value?.handle),
      detailVersion: normalizeDialogDraftIdentifier(currentInformation.value?.updatedAt),
    }
  }

  function completeDraftSave(): void {
    const route = activeDraftContext.value?.route ?? getCurrentDialogDraftRoute()
    clearSaplingDialogDraft('information', activeDraftContext.value)
    activeDraftContext.value = createDraftContext(route)
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
          completeDraftSave()
          emit('saved')
          closeAfterSave()
          return true
        }

        const updatedInformation = await ApiGenericService.update<InformationItem>(
          'information',
          currentInformation.value.handle,
          { content: trimmedContent.value },
          { relations: ['entity', 'person'] },
        )
        clearSaplingDialogDraft('information', activeDraftContext.value)
        currentInformation.value = updatedInformation
        content.value = currentInformation.value.content ?? trimmedContent.value
        activeDraftContext.value = createDraftContext(
          activeDraftContext.value?.route ?? getCurrentDialogDraftRoute(),
        )
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
      completeDraftSave()

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
