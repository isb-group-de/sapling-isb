<template>
  <div class="sapling-mail-dialog__information" aria-live="polite">
    <section v-if="sendIssues.length" class="sapling-mail-dialog__section" role="alert">
      <div class="sapling-mail-dialog__notice">
        <v-icon class="sapling-mail-dialog__notice-icon" color="warning" size="20"
          >mdi-alert-circle-outline</v-icon
        >
        <div class="sapling-mail-dialog__notice-content">
          <h3 class="sapling-mail-dialog__section-title text-warning">
            {{ translate('mail.checkBeforeSend') }}
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
        </div>
      </div>
    </section>
    <section v-if="failedUploads.length" class="sapling-mail-dialog__section" role="alert">
      <div class="sapling-mail-dialog__notice">
        <v-icon class="sapling-mail-dialog__notice-icon" color="error" size="20"
          >mdi-upload-outline</v-icon
        >
        <div class="sapling-mail-dialog__notice-content">
          <h3 class="sapling-mail-dialog__section-title text-error">
            {{ translate('mail.uploadFailed') }}
          </h3>
          <ul class="ps-5">
            <li v-for="name in failedUploads" :key="name">{{ name }}</li>
          </ul>
        </div>
      </div>
    </section>
    <section v-if="draftStatus !== 'none'" class="sapling-mail-dialog__section">
      <div class="sapling-mail-dialog__notice">
        <v-icon
          class="sapling-mail-dialog__notice-icon"
          :color="draftStatus === 'failed' ? 'warning' : 'primary'"
          size="20"
          >{{
            draftStatus === 'failed' ? 'mdi-alert-outline' : 'mdi-content-save-check-outline'
          }}</v-icon
        >
        <div class="sapling-mail-dialog__notice-content">
          <h3 class="sapling-mail-dialog__section-title">
            {{ translate('mail.draftNoticeTitle') }}
          </h3>
          <p>
            {{
              translate(
                `mail.draft${draftStatus === 'failed' ? 'Failed' : draftStatus === 'restored' ? 'Restored' : 'Saved'}`,
              )
            }}
          </p>
          <div class="sapling-mail-dialog__information-actions">
            <v-btn
              color="primary"
              variant="tonal"
              size="small"
              :disabled="composerLocked"
              @click="$emit('reset-draft')"
              >{{ translate('mail.resetDraft') }}</v-btn
            >
            <v-btn
              color="primary"
              variant="outlined"
              size="small"
              :disabled="composerLocked"
              @click="$emit('reset-draft-and-close')"
              >{{ translate('mail.resetDraftAndClose') }}</v-btn
            >
          </div>
        </div>
      </div>
    </section>
    <section v-if="noRotationSignatures" class="sapling-mail-dialog__section">
      <div class="sapling-mail-dialog__notice">
        <v-icon class="sapling-mail-dialog__notice-icon" size="20">mdi-fountain-pen-tip</v-icon>
        <div class="sapling-mail-dialog__notice-content">
          <h3 class="sapling-mail-dialog__section-title">
            {{ translate('navigation.emailSignature') }}
          </h3>
          <p>{{ translate('mail.noRotationSignatures') }}</p>
        </div>
      </div>
    </section>
    <section v-if="!hasItemHandle" class="sapling-mail-dialog__section">
      <div class="sapling-mail-dialog__notice">
        <v-icon class="sapling-mail-dialog__notice-icon" size="20">mdi-paperclip</v-icon>
        <div class="sapling-mail-dialog__notice-content">
          <h3 class="sapling-mail-dialog__section-title">
            {{ translate('document.attachments') }}
          </h3>
          <p>{{ translate('mail.attachmentsAvailableAfterSave') }}</p>
        </div>
      </div>
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
  'reset-draft': []
  'reset-draft-and-close': []
  'confirm-send': []
  'continue-editing': []
}>()
</script>
