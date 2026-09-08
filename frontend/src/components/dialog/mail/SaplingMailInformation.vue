<template>
  <div class="sapling-mail-dialog__information" aria-live="polite">
    <section v-if="sendIssues.length" class="sapling-mail-dialog__section" role="alert">
      <h3 class="sapling-mail-dialog__section-title text-warning">
        <v-icon size="18">mdi-alert-circle-outline</v-icon>{{ translate('mail.checkBeforeSend') }}
      </h3>
      <ul class="ps-5">
        <li v-for="issue in sendIssues" :key="issue.key">
          {{ translate(issue.key) }} <span v-if="issue.detail">{{ issue.detail }}</span>
        </li>
      </ul>
      <div class="sapling-mail-dialog__information-actions">
        <v-btn
          v-if="!sendIssues.some((issue) => issue.blocking)"
          color="warning"
          variant="tonal"
          @click="$emit('confirm-send')"
        >
          {{ translate('mail.sendAnyway') }}
        </v-btn>
        <v-btn variant="text" @click="$emit('continue-editing')">{{
          translate('mail.continueEditing')
        }}</v-btn>
      </div>
    </section>
    <section v-if="failedUploads.length" class="sapling-mail-dialog__section" role="alert">
      <h3 class="sapling-mail-dialog__section-title text-error">
        <v-icon size="18">mdi-upload-outline</v-icon>{{ translate('mail.uploadFailed') }}
      </h3>
      <ul class="ps-5">
        <li v-for="name in failedUploads" :key="name">{{ name }}</li>
      </ul>
    </section>
    <section v-if="draftStatus !== 'none'" class="sapling-mail-dialog__section">
      <div class="sapling-mail-dialog__information-row">
        <v-icon :color="draftStatus === 'failed' ? 'warning' : 'primary'" size="20">{{
          draftStatus === 'failed' ? 'mdi-alert-outline' : 'mdi-content-save-check-outline'
        }}</v-icon>
        <p>
          {{
            translate(
              `mail.draft${draftStatus === 'failed' ? 'Failed' : draftStatus === 'restored' ? 'Restored' : 'Saved'}`,
            )
          }}
        </p>
      </div>
      <v-btn
        class="sapling-mail-dialog__secondary-action"
        variant="text"
        size="small"
        :disabled="composerLocked"
        @click="$emit('discard-draft')"
        >{{ translate('mail.discardDraft') }}</v-btn
      >
    </section>
    <section v-if="noRotationSignatures" class="sapling-mail-dialog__section">
      <h3 class="sapling-mail-dialog__section-title">
        <v-icon size="18">mdi-fountain-pen-tip</v-icon>{{ translate('navigation.emailSignature') }}
      </h3>
      <p>{{ translate('mail.noRotationSignatures') }}</p>
    </section>
    <section v-if="!hasItemHandle" class="sapling-mail-dialog__section">
      <h3 class="sapling-mail-dialog__section-title">
        <v-icon size="18">mdi-paperclip</v-icon>{{ translate('document.attachments') }}
      </h3>
      <p>{{ translate('mail.attachmentsAvailableAfterSave') }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { MailSendIssue } from '@/composables/dialog/useMailSendGuard'

defineProps<{
  draftStatus: 'none' | 'saved' | 'restored' | 'failed'
  failedUploads: string[]
  sendIssues: MailSendIssue[]
  noRotationSignatures: boolean
  hasItemHandle: boolean
  composerLocked: boolean
  translate: (key: string) => string
}>()
defineEmits<{
  'discard-draft': []
  'confirm-send': []
  'continue-editing': []
}>()
</script>
