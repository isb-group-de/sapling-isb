<template>
  <SaplingDialogEdit
    v-if="entity && recordItem"
    :model-value="dialog"
    :mode="dialogMode"
    :item="recordItem"
    :templates="entityTemplates"
    :entity="entity"
    @update:model-value="onDialogUpdate"
    @save="saveRecord"
    @cancel="recordDialogStore.closeRecord"
    @update:mode="onDialogModeUpdate"
    @update:item="recordItem = $event"
    @deleted="onRecordDeleted"
  />
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import { useGenericStore } from '@/stores/genericStore'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useRecordDialogStore } from '@/stores/recordDialogStore'
import ApiGenericService from '@/services/api.generic.service'
import type { DialogSaveAction, DialogSaveContext, DialogState } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import { getItemHandle } from '@/composables/dialog/saplingDialogEdit.utils'

const recordDialogStore = useRecordDialogStore()
const genericStore = useGenericStore()
const currentPermissionStore = useCurrentPermissionStore()
const { dialog, entityHandle, recordHandle } = storeToRefs(recordDialogStore)

const recordItem = ref<SaplingGenericItem | null>(null)
const dialogMode = ref<'edit' | 'readonly'>('readonly')
let activeLoadRequestId = 0

const entityState = computed(() => genericStore.getState(entityHandle.value))
const entity = computed(() => entityState.value.entity)
const entityTemplates = computed(() => entityState.value.entityTemplates)

watch(
  () => [dialog.value, entityHandle.value, recordHandle.value] as const,
  ([isOpen]) => {
    if (!isOpen) {
      recordItem.value = null
      return
    }

    void loadRecord()
  },
  { immediate: true },
)

async function loadRecord() {
  const currentRequestId = ++activeLoadRequestId
  const nextEntityHandle = entityHandle.value
  const nextRecordHandle = recordHandle.value

  if (!nextEntityHandle || nextRecordHandle == null) {
    recordItem.value = null
    return
  }

  recordItem.value = null

  try {
    await Promise.all([
      genericStore.loadGeneric(nextEntityHandle, 'global', 'filter', 'exception'),
      currentPermissionStore.fetchCurrentPermission(),
    ])

    if (currentRequestId !== activeLoadRequestId || entityHandle.value !== nextEntityHandle) {
      return
    }

    const permission = currentPermissionStore.accumulatedPermission?.find(
      (entry) => entry.entityHandle === nextEntityHandle,
    )
    dialogMode.value = permission?.allowUpdate ? 'edit' : 'readonly'

    const response = await ApiGenericService.find<SaplingGenericItem>(nextEntityHandle, {
      filter: { handle: nextRecordHandle },
      limit: 1,
      relations: ['m:1'],
    })

    if (currentRequestId !== activeLoadRequestId || entityHandle.value !== nextEntityHandle) {
      return
    }

    recordItem.value = response.data[0] ?? null
    if (!recordItem.value) {
      recordDialogStore.closeRecord()
    }
  } catch {
    if (currentRequestId === activeLoadRequestId) {
      recordDialogStore.closeRecord()
    }
  }
}

function onDialogUpdate(value: boolean) {
  if (!value) {
    recordDialogStore.closeRecord()
  }
}

function onDialogModeUpdate(value: DialogState) {
  if (value === 'edit' || value === 'readonly') {
    dialogMode.value = value
  }
}

async function saveRecord(
  value: SaplingGenericItem,
  action: DialogSaveAction,
  context: DialogSaveContext,
) {
  const handle = getItemHandle(recordItem.value) ?? getItemHandle(value)
  if (!entityHandle.value || handle == null) {
    context.complete(false)
    return
  }

  try {
    const saved = await ApiGenericService.update<SaplingGenericItem>(entityHandle.value, handle, value, {
      relations: ['m:1'],
    })
    recordItem.value = saved
    context.complete(true)

    if (action === 'saveAndClose') {
      recordDialogStore.closeRecord()
    }
  } catch {
    context.complete(false)
  }
}

function onRecordDeleted() {
  recordItem.value = null
  recordDialogStore.closeRecord()
}
</script>
