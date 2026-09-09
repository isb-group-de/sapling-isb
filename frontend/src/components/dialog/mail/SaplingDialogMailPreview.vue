<template>
  <div
    class="sapling-message-dialog__preview-shell sapling-mail-dialog__preview-shell sapling-mail-dialog__workspace"
  >
    <v-tabs v-model="activeTab" color="primary" density="compact" show-arrows>
      <v-tab :id="`${tabId}-preview-tab`" value="preview" :aria-controls="`${tabId}-preview`">{{
        translate('document.preview')
      }}</v-tab>
      <v-tab
        :id="`${tabId}-information-tab`"
        value="information"
        :aria-controls="`${tabId}-information`"
      >
        {{ translate('navigation.information') }}
        <v-chip
          v-if="noticeCount"
          size="x-small"
          class="ms-2"
          :color="hasWarning ? 'warning' : 'primary'"
          >{{ noticeCount }}</v-chip
        >
      </v-tab>
      <v-tab
        :id="`${tabId}-placeholders-tab`"
        value="placeholders"
        :aria-controls="`${tabId}-placeholders`"
        >{{ translate('mail.placeholders') }}</v-tab
      >
    </v-tabs>
    <div
      v-show="activeTab === 'information'"
      ref="informationPane"
      :id="`${tabId}-information`"
      role="tabpanel"
      :aria-labelledby="`${tabId}-information-tab`"
      class="sapling-mail-dialog__pane"
      tabindex="0"
    >
      <SaplingMailInformation
        :draft-status="draftStatus"
        :failed-uploads="failedUploads"
        :send-issues="sendIssues"
        :no-rotation-signatures="noRotationSignatures"
        :has-item-handle="hasItemHandle"
        :composer-locked="composerLocked"
        :translate="translate"
        @reset-draft="$emit('reset-draft')"
        @reset-draft-and-close="$emit('reset-draft-and-close')"
        @confirm-send="$emit('confirm-send')"
        @continue-editing="$emit('continue-editing')"
      />
    </div>
    <div
      v-show="activeTab === 'placeholders'"
      :id="`${tabId}-placeholders`"
      role="tabpanel"
      :aria-labelledby="`${tabId}-placeholders-tab`"
      class="sapling-mail-dialog__pane"
      :inert="composerLocked"
    >
      <v-card class="sapling-mail-dialog__helper-card glass-panel">
        <v-card-text
          class="sapling-message-dialog__helper-card-text sapling-mail-dialog__helper-card-text"
        >
          <div class="sapling-message-dialog__helper-header sapling-mail-dialog__helper-header">
            <v-btn-toggle
              :model-value="insertTarget"
              class="sapling-segmented-toggle sapling-segmented-toggle--small"
              color="primary"
              density="compact"
              mandatory
              @update:model-value="handleInsertTargetUpdate"
            >
              <v-btn variant="outlined" value="subject" size="small">{{
                translate('document.subject')
              }}</v-btn>
              <v-btn variant="outlined" value="body" size="small">{{
                translate('document.content')
              }}</v-btn>
            </v-btn-toggle>
          </div>

          <v-progress-linear v-if="isLoadingPlaceholders" indeterminate color="primary" />
          <div
            v-else
            class="sapling-message-dialog__placeholder-groups sapling-mail-dialog__placeholder-groups"
          >
            <div
              v-for="group in placeholderGroups"
              :key="group.name"
              class="sapling-message-dialog__placeholder-group sapling-mail-dialog__placeholder-group"
            >
              <div
                class="sapling-message-dialog__placeholder-group-title sapling-mail-dialog__placeholder-group-title"
              >
                {{ group.name }}
              </div>
              <div
                class="sapling-message-dialog__placeholder-chip-list sapling-mail-dialog__placeholder-chip-list"
              >
                <v-chip
                  v-for="placeholder in group.items"
                  :key="placeholder.token"
                  size="small"
                  class="sapling-message-dialog__placeholder-chip sapling-mail-dialog__placeholder-chip"
                  @click="$emit('insert-placeholder', placeholder.token)"
                >
                  {{ placeholder.label }}
                </v-chip>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>
    <div
      v-show="activeTab === 'preview'"
      :id="`${tabId}-preview`"
      role="tabpanel"
      :aria-labelledby="`${tabId}-preview-tab`"
      class="sapling-mail-dialog__pane sapling-mail-dialog__preview-pane"
      tabindex="0"
    >
      <div class="sapling-message-dialog__preview-toolbar sapling-mail-dialog__preview-toolbar">
        <span class="sapling-message-dialog__preview-title sapling-mail-dialog__preview-title">{{
          translate('document.preview')
        }}</span>
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-refresh"
          :loading="isPreviewLoading"
          :disabled="composerLocked"
          @click="$emit('refresh-preview')"
        >
          {{ translate('mail.refreshPreview') }}
        </v-btn>
      </div>

      <v-card
        class="sapling-message-dialog__preview-card sapling-mail-dialog__preview-card glass-panel"
      >
        <v-card-text>
          <div class="sapling-message-dialog__preview-meta sapling-mail-dialog__preview-meta">
            <div v-if="previewFrom">
              <strong>{{ translate('document.from') }}:</strong> {{ previewFrom }}
            </div>
            <div>
              <strong>{{ translate('document.to') }}:</strong> {{ previewTo }}
            </div>
            <div v-if="previewCc">
              <strong>{{ translate('document.cc') }}:</strong> {{ previewCc }}
            </div>
            <div v-if="previewBcc">
              <strong>{{ translate('document.bcc') }}:</strong> {{ previewBcc }}
            </div>
            <div>
              <strong>{{ translate('document.subject') }}:</strong> {{ previewSubject || ' ' }}
            </div>
            <div v-if="attachmentSelectionSummary">
              <strong>{{ translate('document.attachments') }}:</strong>
              {{ attachmentSelectionSummary }}
            </div>
          </div>
          <v-divider class="my-4" />
          <div class="sapling-message-dialog__preview-html sapling-mail-dialog__preview-html">
            <SaplingMarkdownContent :source="previewMarkdown" />
          </div>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, useId, watch } from 'vue'
import SaplingMailInformation from './SaplingMailInformation.vue'
import type { MailSendIssue } from '@/composables/dialog/useMailSendGuard'
import SaplingMarkdownContent from '@/components/common/SaplingMarkdownContent.vue'
import type {
  InsertTarget,
  PlaceholderGroup,
} from '@/components/dialog/mail/SaplingDialogMail.types'

const props = defineProps<{
  composerLocked: boolean
  draftStatus: 'none' | 'saved' | 'restored' | 'failed'
  failedUploads: string[]
  sendIssues: MailSendIssue[]
  noRotationSignatures: boolean
  hasItemHandle: boolean
  placeholderGroups: PlaceholderGroup[]
  insertTarget: InsertTarget
  isLoadingPlaceholders: boolean
  isPreviewLoading: boolean
  previewFrom: string
  previewTo: string
  previewCc: string
  previewBcc: string
  previewSubject: string
  attachmentSelectionSummary: string
  previewMarkdown: string
  translate: (key: string) => string
}>()

const activeTab = ref('preview')
const informationPane = ref<HTMLElement | null>(null)
const tabId = useId()
const noticeCount = computed(
  () =>
    props.sendIssues.length +
    Number(props.failedUploads.length > 0) +
    Number(props.draftStatus !== 'none') +
    Number(props.noRotationSignatures) +
    Number(!props.hasItemHandle),
)
const hasWarning = computed(
  () =>
    props.sendIssues.length > 0 || props.failedUploads.length > 0 || props.draftStatus === 'failed',
)
watch(
  () => [props.sendIssues, props.failedUploads, props.draftStatus] as const,
  async () => {
    if (!hasWarning.value) return
    activeTab.value = 'information'
    await nextTick()
    if (informationPane.value) {
      informationPane.value.scrollTop = 0
      informationPane.value.focus({ preventScroll: true })
    }
  },
  { immediate: true },
)

const emit = defineEmits<{
  (event: 'reset-draft'): void
  (event: 'reset-draft-and-close'): void
  (event: 'confirm-send'): void
  (event: 'continue-editing'): void
  (event: 'update:insertTarget', value: InsertTarget): void
  (event: 'insert-placeholder', value: string): void
  (event: 'refresh-preview'): void
}>()

function handleInsertTargetUpdate(value: InsertTarget | null) {
  if (value) {
    emit('update:insertTarget', value)
  }
}
</script>
