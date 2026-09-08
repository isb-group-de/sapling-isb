<template>
  <SaplingDialog
    :model-value="isOpen"
    size="3xl"
    :height="SAPLING_DIALOG_HEIGHT.xl"
    persistent
    @update:model-value="handleVisibilityChange"
    @keydown.esc.stop.prevent="closeMailDialog"
  >
    <SaplingDialogCard
      class="sapling-message-dialog sapling-mail-dialog"
      :tilt="false"
      :close="closeMailDialog"
    >
      <div class="sapling-message-dialog__shell sapling-mail-dialog__shell">
        <v-card-title class="sapling-message-dialog__header sapling-mail-dialog__header">
          <SaplingDialogHero
            :loading="isTranslationLoading"
            :eyebrow="translate('mail.title')"
            :title="dialogTitle"
            :stats="heroStats"
            :stats-columns="3"
            stats-layout="compact"
            :loading-stats-count="3"
          />
        </v-card-title>

        <v-card-text class="sapling-message-dialog__content sapling-mail-dialog__content">
          <div
            v-if="isTranslationLoading"
            class="sapling-message-dialog__scroll sapling-mail-dialog__scroll"
          >
            <div class="sapling-message-dialog__grid sapling-mail-dialog__grid">
              <v-skeleton-loader class="glass-panel" type="article, article, article" />
              <v-skeleton-loader class="glass-panel" type="article, article, article" />
            </div>
          </div>
          <div v-else class="sapling-message-dialog__scroll sapling-mail-dialog__scroll">
            <v-alert
              v-if="draftStatus !== 'none'"
              :type="draftStatus === 'failed' ? 'warning' : 'info'"
              variant="tonal"
              class="mb-3"
            >
              {{
                translate(
                  `mail.draft${draftStatus === 'failed' ? 'Failed' : draftStatus === 'restored' ? 'Restored' : 'Saved'}`,
                )
              }}
              <v-btn variant="text" :disabled="composerLocked" @click="discardDraft">{{
                translate('mail.discardDraft')
              }}</v-btn>
            </v-alert>
            <div class="sapling-message-dialog__grid sapling-mail-dialog__grid">
              <SaplingDialogMailComposer
                ref="composer"
                :entity-handle="context?.entityHandle"
                :item-handle="context?.itemHandle ?? undefined"
                :inert="composerLocked"
                :can-upload="canUpload"
                :is-uploading="isUploading"
                :failed-uploads="failedUploads"
                @upload-attachments="uploadAttachments"
                :signatures="signatures"
                :signature-rotation="signatureRotation"
                :signature-handle="signatureHandle"
                :signatures-disabled="!signaturesReady || isSending || isSavingSignatureDefaults"
                @save-signature-defaults="saveCurrentSignatureDefaults"
                @update:signature-rotation="changeSignatureRotation"
                @update:signature-handle="changeSignatureHandle"
                :templates="templates"
                :template-handle="templateHandle"
                :to-recipients="toRecipients"
                :cc-recipients="ccRecipients"
                :bcc-recipients="bccRecipients"
                :sender-email="senderEmail"
                :selected-sender-email="selectedSenderEmail"
                :sender-options="senderOptions"
                :is-loading-sender-options="isLoadingSenderOptions"
                :recipient-options="recipientOptions"
                :is-loading-recipient-options="isLoadingRecipientOptions"
                :subject="subject"
                :body-markdown="bodyMarkdown"
                :available-attachments="availableAttachments"
                :attachment-handles="attachmentHandles"
                :attachment-selection-summary="attachmentSelectionSummary"
                :is-loading-templates="isLoadingTemplates"
                :is-loading-attachments="isLoadingAttachments"
                :has-item-handle="context?.itemHandle != null"
                :translate="translate"
                @update:template-handle="templateHandle = $event"
                @update:to-recipients="toRecipients = $event"
                @update:cc-recipients="ccRecipients = $event"
                @update:bcc-recipients="bccRecipients = $event"
                @update:selected-sender-email="selectedSenderEmail = $event"
                @update:subject="subject = $event"
                @update:body-markdown="bodyMarkdown = $event"
                @update:attachment-handles="attachmentHandles = $event"
                @focus-subject="insertTarget = 'subject'"
                @focus-body="insertTarget = 'body'"
                @apply-template="applyTemplate"
              />

              <SaplingDialogMailPreview
                :inert="composerLocked"
                :placeholder-groups="placeholderGroups"
                :insert-target="insertTarget"
                :is-loading-placeholders="isLoadingPlaceholders"
                :is-preview-loading="isPreviewLoading"
                :preview-from="senderEmail"
                :preview-to="previewTo"
                :preview-cc="previewCc"
                :preview-bcc="previewBcc"
                :preview-subject="previewSubject"
                :attachment-selection-summary="attachmentSelectionSummary"
                :preview-markdown="previewMarkdown"
                :translate="translate"
                @update:insert-target="insertTarget = $event"
                @insert-placeholder="insertPlaceholder"
                @refresh-preview="refreshPreview"
              />
            </div>
          </div>
        </v-card-text>

        <v-alert
          v-if="sendIssues.length"
          type="warning"
          variant="tonal"
          class="mx-4 mb-3"
          role="alert"
        >
          <strong>{{ translate('mail.checkBeforeSend') }}</strong>
          <ul class="ms-5 my-2">
            <li v-for="issue in sendIssues" :key="issue.key">
              {{ translate(issue.key) }} <span v-if="issue.detail">{{ issue.detail }}</span>
            </li>
          </ul>
          <v-btn
            v-if="!sendIssues.some((issue) => issue.blocking)"
            variant="tonal"
            @click="confirmSend"
            >{{ translate('mail.sendAnyway') }}</v-btn
          >
          <v-btn variant="text" @click="cancelPendingSend">{{
            translate('mail.continueEditing')
          }}</v-btn>
        </v-alert>
        <v-alert v-if="isHolding" type="info" variant="tonal" class="mx-4 mb-3" role="status">
          {{ $t('mail.sendCountdown', { seconds: remainingSeconds }) }}
          <v-btn variant="tonal" @click="cancelPendingSend">{{
            translate('mail.cancelSend')
          }}</v-btn>
          <div class="text-caption">{{ translate('mail.sendCountdownHint') }}</div>
        </v-alert>

        <SaplingActionBarSkeleton v-if="isTranslationLoading" :leading="1" :trailing="2" />
        <SaplingActionMail
          v-else
          :close="closeMailDialog"
          :refresh-preview="refreshPreview"
          :send="sendMail"
          :can-send="canSendMail"
          :is-preview-loading="isPreviewLoading"
          :is-sending="isSending"
          :sender-summary="senderSummary"
          :locked="composerLocked"
        />
      </div>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script lang="ts" setup>
import SaplingActionMail from '@/components/actions/SaplingActionMail.vue'
import SaplingActionBarSkeleton from '@/components/actions/SaplingActionBarSkeleton.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
import SaplingDialogMailComposer from '@/components/dialog/mail/SaplingDialogMailComposer.vue'
import SaplingDialogMailPreview from '@/components/dialog/mail/SaplingDialogMailPreview.vue'
import { useSaplingDialogMailEditor } from '@/composables/dialog/useSaplingDialogMailEditor'

const {
  draftStatus,
  discardDraft,
  composerLocked,
  senderSummary,
  canUpload,
  isUploading,
  failedUploads,
  uploadAttachments,
  remainingSeconds,
  isHolding,
  sendIssues,
  confirmSend,
  cancelPendingSend,
  saveCurrentSignatureDefaults,
  isSavingSignatureDefaults,
  signatures,
  signatureRotation,
  signatureHandle,
  signaturesReady,
  changeSignatureRotation,
  changeSignatureHandle,
  applyTemplate,
  availableAttachments,
  attachmentHandles,
  attachmentSelectionSummary,
  bccRecipients,
  bodyMarkdown,
  canSendMail,
  ccRecipients,
  closeMailDialog,
  composer,
  context,
  dialogTitle,
  handleVisibilityChange,
  heroStats,
  insertPlaceholder,
  insertTarget,
  isLoadingAttachments,
  isLoadingPlaceholders,
  isLoadingRecipientOptions,
  isLoadingSenderOptions,
  isLoadingTemplates,
  isOpen,
  isPreviewLoading,
  isSending,
  isTranslationLoading,
  placeholderGroups,
  previewBcc,
  previewCc,
  previewMarkdown,
  previewSubject,
  previewTo,
  recipientOptions,
  refreshPreview,
  selectedSenderEmail,
  sendMail,
  senderEmail,
  senderOptions,
  subject,
  templateHandle,
  templates,
  toRecipients,
  translate,
} = useSaplingDialogMailEditor()
</script>
