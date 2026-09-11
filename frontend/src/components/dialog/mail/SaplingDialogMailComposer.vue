<template>
  <div
    class="sapling-message-dialog__form sapling-mail-dialog__form sapling-mail-dialog__workspace"
  >
    <v-tabs v-model="activeTab" color="primary" density="compact" show-arrows>
      <v-tab :id="`${tabId}-message-tab`" value="message" :aria-controls="`${tabId}-message`">{{
        translate('document.content')
      }}</v-tab>
      <v-tab :id="`${tabId}-options-tab`" value="options" :aria-controls="`${tabId}-options`">
        {{ translate('document.attachments') }}
        <v-chip v-if="attachmentHandles.length" size="x-small" class="ms-2">{{
          attachmentHandles.length
        }}</v-chip>
      </v-tab>
      <v-tab
        :id="`${tabId}-signature-tab`"
        value="signature"
        :aria-controls="`${tabId}-signature`"
        >{{ translate('navigation.emailSignature') }}</v-tab
      >
    </v-tabs>
    <div
      v-show="activeTab === 'message'"
      :id="`${tabId}-message`"
      role="tabpanel"
      :aria-labelledby="`${tabId}-message-tab`"
      class="sapling-mail-dialog__fields sapling-mail-dialog__pane"
    >
      <details class="sapling-mail-dialog__section sapling-mail-dialog__templates">
        <summary class="sapling-mail-dialog__section-title">
          <v-icon size="18">mdi-text-box-outline</v-icon>{{ translate('mail.template') }}
          <v-chip v-if="selectedTemplate" size="x-small" variant="tonal">{{
            selectedTemplate.name
          }}</v-chip>
        </summary>
        <div class="sapling-mail-dialog__field-pair">
          <SaplingAutocomplete
            :model-value="templateHandle"
            :items="sortedTemplates"
            item-title="name"
            item-value="handle"
            :label="translate('mail.template')"
            clearable
            :loading="isLoadingTemplates"
            hide-details="auto"
            @update:model-value="handleTemplateUpdate"
          />

          <SaplingAutocomplete
            v-model="snippetHandle"
            :items="sortedTemplates"
            item-title="name"
            item-value="handle"
            :label="translate('mail.insertSnippet')"
            :hint="translate('mail.snippetHint')"
            hide-details="auto"
            autocomplete="off"
            clearable
            @update:model-value="insertSnippet"
          />
        </div>
      </details>
      <section class="sapling-mail-dialog__section sapling-mail-dialog__recipients">
        <div class="sapling-mail-dialog__recipients-header">
          <h3 class="sapling-mail-dialog__section-title">
            <v-icon size="18">mdi-account-multiple-outline</v-icon
            >{{ translate('mail.recipientsStat') }}
          </h3>
          <span class="sapling-mail-dialog__recipient-toggles">
            <v-btn
              size="x-small"
              :variant="showCc ? 'tonal' : 'text'"
              :aria-pressed="showCc"
              @click="ccExpanded = !showCc"
              >{{ translate('document.cc') }}</v-btn
            >
            <v-btn
              size="x-small"
              :variant="showBcc ? 'tonal' : 'text'"
              :aria-pressed="showBcc"
              @click="bccExpanded = !showBcc"
              >{{ translate('document.bcc') }}</v-btn
            >
          </span>
        </div>
        <div class="sapling-message-dialog__sender sapling-mail-dialog__sender">
          <span
            v-if="senderOptions.length <= 1"
            class="sapling-message-dialog__sender-label sapling-mail-dialog__sender-label"
            >{{ translate('document.from') }}</span
          >
          <SaplingAutocomplete
            v-if="senderOptions.length > 1"
            class="sapling-message-dialog__sender-select sapling-mail-dialog__sender-select"
            :label="translate('document.from')"
            :model-value="selectedSenderEmail"
            :items="senderItems"
            item-title="title"
            item-value="value"
            chips
            density="comfortable"
            hide-details
            :loading="isLoadingSenderOptions"
            @update:model-value="handleSenderUpdate"
          >
            <template #chip="{ props: chipProps, item }">
              <v-chip v-bind="chipProps" :title="item.title">{{ item.value }}</v-chip>
            </template>
          </SaplingAutocomplete>
          <v-chip v-else size="small" variant="tonal" color="primary">
            {{ selectedSenderEmail || senderEmail || senderFallbackLabel }}
          </v-chip>
        </div>

        <SaplingCombobox
          :model-value="toRecipients"
          :items="recipientItems"
          item-title="title"
          item-value="value"
          :label="translate('document.to')"
          multiple
          chips
          closable-chips
          clearable
          hide-selected
          hide-details
          :loading="isLoadingRecipientOptions"
          :delimiters="[',', ';']"
          @update:model-value="handleToUpdate"
        >
          <template #item="{ props: itemProps, item }">
            <v-divider v-if="item.showDivider" class="my-1" />
            <v-list-subheader v-if="item.showCompanyHeader">
              <v-icon start size="small">mdi-domain</v-icon>
              {{ item.companyLabel }}
            </v-list-subheader>
            <v-list-item v-bind="itemProps" />
          </template>
          <template #chip="{ props: chipProps, item }">
            <v-chip v-bind="chipProps">{{ getRecipientSelectionEmail(item) }}</v-chip>
          </template>
        </SaplingCombobox>

        <div
          v-show="showCc || showBcc"
          class="sapling-message-dialog__meta-grid sapling-mail-dialog__meta-grid"
          :class="{ 'sapling-mail-dialog__meta-grid--single': !showCc || !showBcc }"
        >
          <SaplingCombobox
            v-show="showCc"
            :model-value="ccRecipients"
            :items="recipientItems"
            item-title="title"
            item-value="value"
            :label="translate('document.cc')"
            multiple
            chips
            closable-chips
            clearable
            hide-selected
            hide-details
            :loading="isLoadingRecipientOptions"
            :delimiters="[',', ';']"
            @update:model-value="handleCcUpdate"
          >
            <template #item="{ props: itemProps, item }">
              <v-divider v-if="item.showDivider" class="my-1" />
              <v-list-subheader v-if="item.showCompanyHeader">
                <v-icon start size="small">mdi-domain</v-icon>
                {{ item.companyLabel }}
              </v-list-subheader>
              <v-list-item v-bind="itemProps" />
            </template>
            <template #chip="{ props: chipProps, item }">
              <v-chip v-bind="chipProps">{{ getRecipientSelectionEmail(item) }}</v-chip>
            </template>
          </SaplingCombobox>
          <SaplingCombobox
            v-show="showBcc"
            :model-value="bccRecipients"
            :items="recipientItems"
            item-title="title"
            item-value="value"
            :label="translate('document.bcc')"
            multiple
            chips
            closable-chips
            clearable
            hide-selected
            hide-details
            :loading="isLoadingRecipientOptions"
            :delimiters="[',', ';']"
            @update:model-value="handleBccUpdate"
          >
            <template #item="{ props: itemProps, item }">
              <v-divider v-if="item.showDivider" class="my-1" />
              <v-list-subheader v-if="item.showCompanyHeader">
                <v-icon start size="small">mdi-domain</v-icon>
                {{ item.companyLabel }}
              </v-list-subheader>
              <v-list-item v-bind="itemProps" />
            </template>
            <template #chip="{ props: chipProps, item }">
              <v-chip v-bind="chipProps">{{ getRecipientSelectionEmail(item) }}</v-chip>
            </template>
          </SaplingCombobox>
        </div>
      </section>
      <section class="sapling-mail-dialog__section">
        <SaplingTextField
          ref="subjectField"
          :model-value="subject"
          :label="translate('document.subject')"
          hide-details="auto"
          @focus="handleSubjectFocus"
          @click="captureSubjectSelection"
          @keyup="captureSubjectSelection"
          @select="captureSubjectSelection"
          @blur="captureSubjectSelection"
          @update:model-value="handleSubjectUpdate"
        />

        <div class="sapling-mail-dialog__mention-editor">
          <SaplingMarkdownField
            ref="markdownField"
            :entity-handle="entityHandle"
            :item-handle="itemHandle"
            :model-value="bodyMarkdown"
            :label="translate('document.content')"
            :rows="10"
            :show-preview="false"
            @focus="handleBodyFocus"
            @click="handleBodySelectionChange"
            @keyup="handleBodySelectionChange"
            @update:model-value="handleBodyMarkdownUpdate"
          />

          <section
            v-if="mentionMatch"
            class="sapling-mail-dialog__mention-panel"
            data-test="mail-mention-panel"
            aria-live="polite"
          >
            <div class="sapling-mail-dialog__mention-header">
              <div>
                <h3 class="sapling-mail-dialog__section-title">
                  {{ translate('mail.mentionPerson') }}
                </h3>
                <p>{{ translate('mail.mentionRecipientHint') }}</p>
              </div>
              <v-btn
                icon="mdi-close"
                size="x-small"
                variant="text"
                :aria-label="translate('global.close')"
                @click="mentionMatch = null"
              />
            </div>

            <v-progress-linear v-if="isLoadingRecipientOptions" indeterminate color="primary" />
            <v-list v-else-if="mentionResults.length" density="compact" lines="two">
              <v-list-item
                v-for="option in mentionResults"
                :key="option.email"
                :title="option.name || option.email"
                :subtitle="buildMentionSubtitle(option)"
              >
                <template #append>
                  <div class="sapling-mail-dialog__mention-actions">
                    <v-btn
                      size="x-small"
                      variant="tonal"
                      @mousedown.prevent
                      @click="selectMentionRecipient(option, 'to')"
                      >{{ translate('document.to') }}</v-btn
                    >
                    <v-btn
                      size="x-small"
                      variant="text"
                      @mousedown.prevent
                      @click="selectMentionRecipient(option, 'cc')"
                      >{{ translate('document.cc') }}</v-btn
                    >
                    <v-btn
                      size="x-small"
                      variant="text"
                      @mousedown.prevent
                      @click="selectMentionRecipient(option, 'bcc')"
                      >{{ translate('document.bcc') }}</v-btn
                    >
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <p v-else class="sapling-mail-dialog__mention-empty">
              {{ translate('mail.mentionNoResults') }}
            </p>
          </section>
        </div>
      </section>
    </div>

    <div
      v-show="activeTab === 'options'"
      :id="`${tabId}-options`"
      role="tabpanel"
      :aria-labelledby="`${tabId}-options-tab`"
      class="sapling-mail-dialog__fields sapling-mail-dialog__pane"
    >
      <v-card class="sapling-mail-dialog__helper-card glass-panel">
        <v-card-text
          class="sapling-message-dialog__helper-card-text sapling-mail-dialog__helper-card-text"
        >
          <div class="sapling-message-dialog__helper-header sapling-mail-dialog__helper-header">
            <span class="sapling-message-dialog__helper-title sapling-mail-dialog__helper-title">{{
              translate('document.attachments')
            }}</span>
            <v-chip size="small" variant="tonal">{{ attachmentHandles.length }}</v-chip>
          </div>

          <p v-if="!hasItemHandle" class="text-medium-emphasis">
            {{ translate('mail.attachmentsAvailableAfterSave') }}
          </p>
          <template v-else>
            <div
              v-if="canUpload"
              class="sapling-mail-dialog__upload mb-3 pa-3 border rounded"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
              <v-file-input
                :model-value="[]"
                multiple
                autocomplete="off"
                :label="translate('mail.uploadAttachments')"
                :hint="translate('mail.uploadHint')"
                persistent-hint
                :loading="isUploading"
                :disabled="isUploading"
                @update:model-value="onFilesSelected"
              />
            </div>
            <SaplingAutocomplete
              :model-value="attachmentHandles"
              :items="availableAttachments"
              item-title="title"
              item-value="handle"
              :label="translate('mail.attachDocuments')"
              multiple
              chips
              closable-chips
              clearable
              :loading="isLoadingAttachments"
              hide-details="auto"
              @update:model-value="handleAttachmentUpdate"
            />
            <div
              v-if="attachmentSelectionSummary"
              class="sapling-message-dialog__attachment-summary sapling-mail-dialog__attachment-summary"
            >
              {{ attachmentSelectionSummary }}
            </div>
          </template>
        </v-card-text>
      </v-card>
    </div>
    <div
      v-show="activeTab === 'signature'"
      :id="`${tabId}-signature`"
      role="tabpanel"
      :aria-labelledby="`${tabId}-signature-tab`"
      class="sapling-mail-dialog__fields sapling-mail-dialog__pane"
    >
      <section class="sapling-mail-dialog__section">
        <h3 class="sapling-mail-dialog__section-title">
          <v-icon size="18">mdi-fountain-pen-tip</v-icon
          >{{ translate('navigation.emailSignature') }}
        </h3>
        <SaplingMailSignatureSelection
          hide-status
          :rotation="signatureRotation ?? true"
          :signature-handle="signatureHandle ?? null"
          :signatures="signatures ?? []"
          :disabled="signaturesDisabled"
          @update:rotation="emit('update:signatureRotation', $event)"
          @update:signature-handle="emit('update:signatureHandle', $event)"
        />

        <v-btn
          class="sapling-mail-dialog__secondary-action"
          variant="text"
          prepend-icon="mdi-content-save-outline"
          :disabled="signaturesDisabled"
          @click="emit('save-signature-defaults')"
        >
          {{ translate('mail.saveCurrentSignatureDefaults') }}
        </v-btn>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import SaplingMailSignatureSelection from './SaplingMailSignatureSelection.vue'
import type { EmailSignature } from '@/services/api.mail-signature.service'
import { computed, nextTick, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingCombobox from '@/components/common/SaplingCombobox.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingMarkdownField from '@/components/dialog/fields/SaplingFieldMarkdown.vue'
import { sortSelectOptions } from '@/utils/saplingSelectOptions'
import type {
  AttachmentOption,
  EmailTemplateItem,
  InsertTarget,
  MailRecipientOption,
  MailSenderOption,
} from '@/components/dialog/mail/SaplingDialogMail.types'
import {
  buildMailRecipientTitle,
  sortMailRecipientOptions,
} from '@/utils/saplingMailRecipientOptions'
import {
  assignMailMentionRecipient,
  buildMailSenderTitle,
  clampMailSelection,
  filterMailMentionRecipients,
  findMailRecipientMention,
  getMailRecipientCompanyKey,
  normalizeMailRecipients,
  readMailRecipientValue,
  type MailMentionMatch,
  type MailRecipientField,
} from './saplingMailComposer.utils'

type TextSelectionInput = HTMLInputElement | HTMLTextAreaElement

type SubjectFieldInstance = {
  $el?: Element | null
}

type MarkdownFieldInstance = InstanceType<typeof SaplingMarkdownField> & {
  insertTextAtCursor?: (text: string) => void
  getTextSelection?: () => { from: number; to: number }
  replaceTextRange?: (from: number, to: number, text: string) => string
}

const props = defineProps<{
  entityHandle?: string
  itemHandle?: string | number
  canUpload?: boolean
  isUploading?: boolean
  signatures?: EmailSignature[]
  signatureRotation?: boolean
  signatureHandle?: number | null
  signaturesDisabled?: boolean
  templates: EmailTemplateItem[]
  templateHandle: number | null
  toRecipients: string[]
  ccRecipients: string[]
  bccRecipients: string[]
  senderEmail: string
  selectedSenderEmail: string
  senderOptions: MailSenderOption[]
  isLoadingSenderOptions: boolean
  recipientOptions: MailRecipientOption[]
  isLoadingRecipientOptions: boolean
  subject: string
  bodyMarkdown: string
  availableAttachments: AttachmentOption[]
  attachmentHandles: number[]
  attachmentSelectionSummary: string
  isLoadingTemplates: boolean
  isLoadingAttachments: boolean
  hasItemHandle: boolean
  translate: (key: string) => string
}>()

const ccExpanded = ref(false)
const bccExpanded = ref(false)
const showCc = computed(() => ccExpanded.value || props.ccRecipients.length > 0)
const showBcc = computed(() => bccExpanded.value || props.bccRecipients.length > 0)
const selectedTemplate = computed(() =>
  props.templates.find((template) => template.handle === props.templateHandle),
)
const activeTab = ref('message')
const tabId = useId()
const mentionMatch = ref<MailMentionMatch | null>(null)

const emit = defineEmits<{
  (event: 'upload-attachments', files: File[]): void
  (event: 'save-signature-defaults'): void
  (event: 'update:signatureRotation', value: boolean): void
  (event: 'update:signatureHandle', value: number | null): void
  (event: 'update:templateHandle', value: number | null): void
  (event: 'update:toRecipients', value: string[]): void
  (event: 'update:ccRecipients', value: string[]): void
  (event: 'update:bccRecipients', value: string[]): void
  (event: 'update:selectedSenderEmail', value: string): void
  (event: 'update:subject', value: string): void
  (event: 'update:bodyMarkdown', value: string): void
  (event: 'update:attachmentHandles', value: number[]): void
  (event: 'focus-subject'): void
  (event: 'focus-body'): void
  (event: 'apply-template'): void
}>()

const { locale } = useI18n()
const snippetHandle = ref<number | null>(null)
function insertSnippet(handle: number | null) {
  const snippet = props.templates.find((template) => template.handle === handle)
  if (snippet) markdownField.value?.insertTextAtCursor?.(snippet.bodyMarkdown)
  void nextTick(() => {
    snippetHandle.value = null
  })
}
function onFilesSelected(files: File | File[] | null) {
  if (!props.isUploading && files)
    emit('upload-attachments', Array.isArray(files) ? files : [files])
}
function onDrop(event: DragEvent) {
  if (props.canUpload && !props.isUploading && event.dataTransfer) {
    emit('upload-attachments', Array.from(event.dataTransfer.files))
  }
}
const subjectField = ref<SubjectFieldInstance | null>(null)
const markdownField = ref<MarkdownFieldInstance | null>(null)
const subjectSelectionStart = ref(0)
const subjectSelectionEnd = ref(0)
const senderFallbackLabel = computed(() =>
  locale.value === 'de' ? 'Keine Absenderadresse hinterlegt' : 'No sender address available',
)
const sortedTemplates = computed(() =>
  sortSelectOptions(props.templates, (template) => template.name),
)
const senderItems = computed(() =>
  sortSelectOptions(props.senderOptions, buildMailSenderTitle).map((option) => ({
    title: buildMailSenderTitle(option),
    value: option.email,
  })),
)
const recipientItems = computed(() => {
  const options = sortMailRecipientOptions(props.recipientOptions, locale.value)

  return options.map((option, index) => {
    const previousOption = options[index - 1]
    const showCompanyHeader =
      index === 0 ||
      getMailRecipientCompanyKey(previousOption) !== getMailRecipientCompanyKey(option)

    return {
      title: buildMailRecipientTitle(option),
      value: option.email,
      companyLabel: buildRecipientCompanyLabel(option),
      showCompanyHeader,
      showDivider: index > 0 && showCompanyHeader,
    }
  })
})
const mentionResults = computed(() =>
  filterMailMentionRecipients(
    sortMailRecipientOptions(props.recipientOptions, locale.value),
    mentionMatch.value?.query ?? '',
  ),
)

function handleTemplateUpdate(value: number | null | undefined) {
  emit('update:templateHandle', value ?? null)
  emit('apply-template')
}

function handleToUpdate(value: unknown) {
  emit('update:toRecipients', normalizeMailRecipients(value))
}

function handleCcUpdate(value: unknown) {
  emit('update:ccRecipients', normalizeMailRecipients(value))
}

function handleBccUpdate(value: unknown) {
  emit('update:bccRecipients', normalizeMailRecipients(value))
}

function handleSenderUpdate(value: string | null | undefined) {
  emit('update:selectedSenderEmail', value ?? '')
}

function handleSubjectUpdate(value: string) {
  emit('update:subject', value)
}

function handleBodyMarkdownUpdate(value: string) {
  emit('update:bodyMarkdown', value)
  refreshMention(value)
}

function handleBodyFocus() {
  emit('focus-body')
  handleBodySelectionChange()
}

function handleBodySelectionChange() {
  void nextTick(() => refreshMention(props.bodyMarkdown))
}

function refreshMention(value: string) {
  const selection = markdownField.value?.getTextSelection?.() ?? {
    from: value.length,
    to: value.length,
  }
  mentionMatch.value = findMailRecipientMention(value, selection)
}

function selectMentionRecipient(option: MailRecipientOption, field: MailRecipientField) {
  const match = mentionMatch.value
  if (!match) return

  const nextBody = markdownField.value?.replaceTextRange?.(
    match.from,
    match.to,
    `@${option.name.trim() || option.email}`,
  )
  if (nextBody != null) emit('update:bodyMarkdown', nextBody)

  const recipients = assignMailMentionRecipient(
    {
      to: props.toRecipients,
      cc: props.ccRecipients,
      bcc: props.bccRecipients,
    },
    field,
    option.email,
  )
  emit('update:toRecipients', recipients.to)
  emit('update:ccRecipients', recipients.cc)
  emit('update:bccRecipients', recipients.bcc)
  if (field === 'cc') ccExpanded.value = true
  if (field === 'bcc') bccExpanded.value = true
  mentionMatch.value = null
}

function buildMentionSubtitle(option: MailRecipientOption): string {
  return [option.companyName, option.departmentName, option.email].filter(Boolean).join(' · ')
}

function handleAttachmentUpdate(value: number[]) {
  emit('update:attachmentHandles', value)
}

function handleSubjectFocus() {
  captureSubjectSelection()
  emit('focus-subject')
}

function captureSubjectSelection() {
  const input = getSubjectInput()

  if (!input) {
    return
  }

  subjectSelectionStart.value = input.selectionStart ?? input.value.length
  subjectSelectionEnd.value = input.selectionEnd ?? subjectSelectionStart.value
}

function insertPlaceholderAtCursor(target: InsertTarget, token: string) {
  activeTab.value = 'message'
  void nextTick(() => {
    if (target === 'subject') insertIntoSubject(token)
    else markdownField.value?.insertTextAtCursor?.(token)
  })
}

function insertIntoSubject(token: string) {
  const currentValue = props.subject ?? ''
  const start = clampMailSelection(subjectSelectionStart.value, currentValue.length)
  const end = clampMailSelection(subjectSelectionEnd.value, currentValue.length)
  const nextValue = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`
  const nextCursor = start + token.length

  emit('update:subject', nextValue)

  nextTick(() => {
    const input = getSubjectInput()

    if (!input) {
      return
    }

    input.focus()
    input.setSelectionRange(nextCursor, nextCursor)
    subjectSelectionStart.value = nextCursor
    subjectSelectionEnd.value = nextCursor
  })
}

function getSubjectInput(): TextSelectionInput | null {
  const root = subjectField.value?.$el

  if (!(root instanceof HTMLElement)) {
    return null
  }

  return root.querySelector('input, textarea')
}

function buildRecipientCompanyLabel(option: MailRecipientOption): string {
  const companyName = option.companyName || '—'
  return option.isCurrentCompany
    ? `${companyName} · ${props.translate('mail.currentCompany')}`
    : companyName
}

function getRecipientSelectionEmail(item: unknown): string {
  return readMailRecipientValue(item)
}

defineExpose({
  insertPlaceholderAtCursor,
})
</script>
