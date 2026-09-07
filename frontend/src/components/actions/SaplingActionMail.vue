<template>
  <SaplingActionBar>
    <template #leading>
      <v-btn variant="text" prepend-icon="mdi-close" :disabled="isSending" @click="close">
        <template v-if="$vuetify.display.mdAndUp">
          {{ $t('global.close') }}
        </template>
      </v-btn>
    </template>

    <template #trailing>
      <span class="text-caption text-break">{{ $t('document.from') }}: {{ senderSummary }}</span>
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-eye-outline"
        :loading="isPreviewLoading"
        :disabled="locked"
        @click="refreshPreview"
      >
        <template v-if="$vuetify.display.mdAndUp">
          {{ $t('mail.reloadPreview') }}
        </template>
      </v-btn>
      <v-btn
        :disabled="!canSend"
        color="primary"
        prepend-icon="mdi-send"
        :loading="isSending"
        @click="send"
      >
        <template v-if="$vuetify.display.mdAndUp">
          {{ $t('mail.send') }}
        </template>
      </v-btn>
    </template>
  </SaplingActionBar>
</template>

<script lang="ts" setup>
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'

defineProps<{
  senderSummary?: string
  locked?: boolean
  close: () => void
  refreshPreview: () => void
  send: () => void
  canSend: boolean
  isPreviewLoading: boolean
  isSending: boolean
}>()
</script>
