<template>
  <SaplingDialogDelete
    persistent
    :model-value="recordDeleteDialog"
    :item="item"
    :entity-handle="entityHandle"
    @update:model-value="emit('set-record-delete-dialog', $event)"
    @confirm="emit('confirm-delete', $event)"
    @cancel="emit('cancel-delete')"
  />

  <SaplingTableRowUpload
    v-if="showUploadDialog"
    :show="showUploadDialog"
    :item="item"
    :entityHandle="entityHandle"
    @close="emit('close-upload')"
    @uploaded="emit('close-upload')"
  />

  <SaplingTableRowInformation
    v-if="showInformationDialog"
    :show="showInformationDialog"
    :item="item"
    :entityHandle="entityHandle"
    @close="emit('close-information')"
    @saved="emit('close-information')"
  />

  <SaplingExternalRecordLinksDialog
    v-if="showExternalRecordLinksDialog"
    :show="showExternalRecordLinksDialog"
    :item="item"
    :entity-handle="entityHandle"
    @update:show="(value) => !value && emit('close-external-record-links')"
    @close="emit('close-external-record-links')"
  />
</template>

<script lang="ts" setup>
import type { SaplingGenericItem } from '@/entity/entity'
import SaplingDialogDelete from '@/components/dialog/SaplingDialogDelete.vue'
import SaplingExternalRecordLinksDialog from '@/components/import/SaplingExternalRecordLinksDialog.vue'
import SaplingTableRowInformation from '@/components/table/SaplingTableRowInformation.vue'
import SaplingTableRowUpload from '@/components/table/SaplingTableRowUpload.vue'

defineProps<{
  recordDeleteDialog: boolean
  showUploadDialog: boolean
  showInformationDialog: boolean
  showExternalRecordLinksDialog: boolean
  item: SaplingGenericItem | null
  entityHandle: string
}>()

const emit = defineEmits<{
  (event: 'set-record-delete-dialog', value: boolean): void
  (event: 'confirm-delete', value: { cascadeRelations: string[] }): void
  (event: 'cancel-delete'): void
  (event: 'close-upload'): void
  (event: 'close-information'): void
  (event: 'close-external-record-links'): void
}>()
</script>
