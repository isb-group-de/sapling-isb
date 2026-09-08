<template>
  <SaplingDialog
    :model-value="true"
    size="3xl"
    :height="SAPLING_DIALOG_HEIGHT.xl"
    @update:model-value="!$event && close()"
    @keydown.esc.stop.prevent="close"
  >
    <SaplingDialogCard class="sapling-dialog-card--fill" :close="close">
      <SaplingDialogShell fill-shell body-class="sapling-image-preview-dialog__body">
        <template #hero>
          <SaplingDialogHero :title="alt || $t('document.preview')" />
        </template>
        <template #body>
          <SaplingImageViewer :src="src" :alt="alt" />
        </template>
        <template #actions>
          <SaplingActionClose :close="close" />
        </template>
      </SaplingDialogShell>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script setup lang="ts">
import SaplingDialog from './SaplingDialog.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogShell from './SaplingDialogShell.vue'
import SaplingDialogHero from './SaplingDialogHero.vue'
import SaplingActionClose from '@/components/actions/SaplingActionClose.vue'
import SaplingImageViewer from './SaplingImageViewer.vue'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'

defineProps<{ src: string; alt: string }>()
const emit = defineEmits<{ close: [] }>()
function close() {
  emit('close')
}
</script>
