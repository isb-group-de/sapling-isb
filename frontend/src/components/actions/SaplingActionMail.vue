<template>
  <SaplingActionBar class="sapling-mail-dialog__actions">
    <template #leading>
      <v-btn
        variant="text"
        prepend-icon="mdi-close"
        :disabled="isSending"
        :aria-label="$t('global.close')"
        @click="close"
      >
        <template v-if="$vuetify.display.mdAndUp">
          {{ $t('global.close') }}
        </template>
      </v-btn>
    </template>

    <template #trailing>
      <v-chip
        v-if="senderSummary"
        size="small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-email-outline"
        class="sapling-mail-dialog__sender-badge"
        :title="senderSummary"
        :aria-label="`${$t('document.from')}: ${senderSummary}`"
      >
        {{ senderSummary }}
      </v-chip>
      <v-btn
        :disabled="!canSend || locked"
        :aria-label="$t('mail.send')"
        variant="flat"
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
  send: () => void
  canSend: boolean
  isSending: boolean
}>()
</script>
