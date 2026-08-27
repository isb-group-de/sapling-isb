<template>
  <section class="sapling-min-size-0 sapling-chat-conversation sapling-ai-chat__conversation">
    <div class="sapling-chat-conversation__header">
      <SaplingAiChatConversationTitle
        :title="activeConversationTitle"
        :runtime-summary="activeRuntimeSummary"
        :title-preview-limit="titlePreviewLimit"
      />
      <div
        v-if="(!isAgentLocked && agentOptions.length > 0) || playbookOptions.length > 0"
        class="sapling-chat-conversation__controls sapling-ai-chat__conversation-controls"
      >
        <SaplingAutocomplete
          v-if="!isAgentLocked && agentOptions.length > 0"
          :model-value="selectedAgentHandle"
          class="sapling-ai-chat__agent-select"
          density="compact"
          hide-details
          item-title="label"
          item-value="value"
          :disabled="isSending"
          :items="agentOptions"
          :label="t('aiChat.agent')"
          variant="outlined"
          @update:model-value="emit('update:selectedAgent', String($event || ''))"
        >
          <template #label>
            <span>{{ t('aiChat.agent') }}</span>
            <SaplingHelpTooltip
              :text="t('aiChat.agentTooltip')"
              :aria-label="t('aiChat.agent')"
              icon-size="16"
            />
          </template>
        </SaplingAutocomplete>
        <SaplingAutocomplete
          v-if="playbookOptions.length > 0"
          :model-value="selectedPlaybookHandle"
          class="sapling-ai-chat__playbook-select"
          density="compact"
          hide-details
          item-title="label"
          item-value="value"
          :disabled="isSending"
          :items="playbookOptions"
          :label="t('aiChat.playbook')"
          clearable
          variant="outlined"
          @update:model-value="emit('update:selectedPlaybook', $event ? String($event) : null)"
        >
          <template #label>
            <span>{{ t('aiChat.playbook') }}</span>
            <SaplingHelpTooltip
              :text="t('aiChat.playbookTooltip')"
              :aria-label="t('aiChat.playbook')"
              icon-size="16"
            />
          </template>
        </SaplingAutocomplete>
      </div>
    </div>

    <SaplingAiChatMessageList
      :messages="messages"
      :agent-title="selectedAgentConfig?.title || assistantName"
      :agent-icon="selectedAgentConfig?.icon"
      :welcome-message="selectedAgentConfig?.welcomeMessage"
      :conversation-starters="selectedAgentConfig?.conversationStarters || []"
      :has-configured-providers="hasConfiguredProviders"
      :is-loading-runtime-catalog="isLoadingRuntimeCatalog"
      :has-loaded-runtime-catalog="hasLoadedRuntimeCatalog"
      :runtime-catalog-load-failed="runtimeCatalogLoadFailed"
      :has-more-messages="hasMoreMessages"
      :is-loading-older-messages="isLoadingOlderMessages"
      :is-voice-output-available="isVoiceOutputAvailable"
      :assistant-name="assistantName"
      :current-person-display-name="currentPersonDisplayName"
      :streaming-duration-by-handle="streamingDurationByHandle"
      :active-tool-action-handles="activeToolActionHandles"
      :speech-state-by-handle="speechStateByHandle"
      @close="emit('close')"
      @select-starter="applyConversationStarter"
      @retry-runtime-catalog="emit('retry-runtime-catalog')"
      @load-older-messages="emit('load-older-messages')"
      @toggle-message-speech="emit('toggle-message-speech', $event)"
      @confirm-tool-action="emit('confirm-tool-action', $event)"
      @reject-tool-action="emit('reject-tool-action', $event)"
    />

    <div class="sapling-stack-xl sapling-chat-composer sapling-ai-chat__composer">
      <div v-if="queuedInputs.length > 0" class="sapling-ai-chat__queued-inputs">
        <div class="sapling-section-title">{{ t('aiChat.queuedInputs') }}</div>
        <v-list density="compact" bg-color="transparent">
          <v-list-item v-for="(item, index) in queuedInputs" :key="item.handle">
            <template #prepend>
              <v-chip size="x-small" variant="tonal">{{ index + 1 }}</v-chip>
            </template>
            <v-list-item-title>{{ item.content }}</v-list-item-title>
            <template #append>
              <v-btn
                icon="mdi-close"
                size="x-small"
                variant="text"
                :title="t('aiChat.removeQueuedInput')"
                @click="emit('cancel-queued-input', item.handle)"
              />
            </template>
          </v-list-item>
        </v-list>
      </div>
      <SaplingTextarea
        ref="messageInput"
        v-model="draftMessageModel"
        :disabled="!hasConfiguredProviders"
        :placeholder="
          isLoadingRuntimeCatalog
            ? getTranslationLabel('loadingConfiguration', 'KI-Konfiguration wird geladen …')
            : !hasLoadedRuntimeCatalog || runtimeCatalogLoadFailed
              ? ''
              : hasConfiguredProviders
                ? t('aiChat.inputPlaceholder')
                : t('aiChat.noConfiguredProviders')
        "
        auto-grow
        density="comfortable"
        hide-details
        rows="3"
        max-rows="8"
        variant="outlined"
        @keydown.enter.exact.prevent="emit('send')"
      />

      <div class="sapling-chat-composer__hint sapling-ai-chat__composer-hint">
        {{ getTranslationLabel('composerHint', 'Enter senden · Shift+Enter Zeilenumbruch') }}
      </div>

      <input
        ref="importFileInput"
        class="sapling-ai-chat__attachment-input"
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
        @change="handleImportFileChange"
      />

      <div
        v-if="pendingAttachments.length > 0"
        class="sapling-chip-row sapling-ai-chat__attachment-chips"
      >
        <v-chip
          v-for="attachment in pendingAttachments"
          :key="attachment.handle"
          size="small"
          variant="tonal"
          prepend-icon="mdi-file-delimited-outline"
          closable
          @click:close="emit('remove-import-attachment', attachment.handle)"
        >
          {{ formatAttachmentChip(attachment) }}
        </v-chip>
      </div>

      <div
        class="sapling-row-between-md sapling-chat-composer__actions sapling-ai-chat__composer-actions"
      >
        <div class="sapling-ai-chat__composer-action-buttons">
          <v-btn
            v-if="canUploadImportAttachment"
            class="sapling-ai-chat__composer-action"
            variant="tonal"
            prepend-icon="mdi-paperclip"
            :disabled="!hasConfiguredProviders || isUploadingImportAttachment"
            :loading="isUploadingImportAttachment"
            :title="t('aiChat.attachImportFile')"
            :aria-label="t('aiChat.attachImportFile')"
            @click="openImportFilePicker"
          >
            {{ t('aiChat.attachImportFile') }}
          </v-btn>
          <v-btn
            class="sapling-ai-chat__composer-action"
            variant="tonal"
            :disabled="
              !hasConfiguredProviders ||
              !hasConfiguredTranscriptionProviders ||
              isTranscribingVoiceInput
            "
            :prepend-icon="isRecordingVoiceInput ? 'mdi-stop' : 'mdi-microphone-outline'"
            :loading="isTranscribingVoiceInput"
            :title="getVoiceInputButtonLabel()"
            :aria-label="getVoiceInputButtonLabel()"
            @click="emit('toggle-voice-input')"
          >
            {{ getVoiceInputButtonLabel() }}
          </v-btn>
          <v-btn
            class="sapling-ai-chat__composer-action"
            color="primary"
            variant="flat"
            :prepend-icon="isSending ? 'mdi-playlist-plus' : 'mdi-send'"
            :disabled="!canSendMessage || (!draftMessage.trim() && pendingAttachments.length === 0)"
            :title="isSending ? t('aiChat.queue') : t('aiChat.send')"
            :aria-label="isSending ? t('aiChat.queue') : t('aiChat.send')"
            @click="emit('send')"
          >
            {{ isSending ? t('aiChat.queue') : t('aiChat.send') }}
          </v-btn>
          <v-btn
            v-if="isSending"
            class="sapling-ai-chat__composer-action"
            color="secondary"
            variant="tonal"
            prepend-icon="mdi-directions-fork"
            :disabled="!canSendMessage || (!draftMessage.trim() && pendingAttachments.length === 0)"
            :title="t('aiChat.steer')"
            :aria-label="t('aiChat.steer')"
            @click="emit('steer')"
          >
            {{ t('aiChat.steer') }}
          </v-btn>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingTextarea from '@/components/common/SaplingTextarea.vue'
import SaplingAiChatConversationTitle from '@/components/system/ai-chat/SaplingAiChatConversationTitle.vue'
import SaplingAiChatMessageList from '@/components/system/ai-chat/SaplingAiChatMessageList.vue'
import SaplingHelpTooltip from '@/components/common/SaplingHelpTooltip.vue'
import type { AiAgentItem, AiChatMessageItem, AiChatToolActionItem } from '@/entity/entity'

type SelectOption = {
  label: string
  value: string
}

type PendingImportAttachment = {
  handle: number
  filename: string
  rowCount: number
  headerCount: number
  status: string
}

type QueuedInput = {
  handle: number
  content: string
  mode: 'queue' | 'steer'
}

const props = withDefaults(
  defineProps<{
    activeConversationTitle: string
    activeRuntimeSummary: string
    agentOptions: SelectOption[]
    selectedAgentConfig: AiAgentItem | null
    selectedAgentHandle: string | null
    playbookOptions: SelectOption[]
    selectedPlaybookHandle: string | null
    isAgentLocked: boolean
    hasConfiguredProviders: boolean
    isLoadingRuntimeCatalog: boolean
    hasLoadedRuntimeCatalog: boolean
    runtimeCatalogLoadFailed: boolean
    hasConfiguredTranscriptionProviders: boolean
    canSendMessage: boolean
    isSending: boolean
    messages: AiChatMessageItem[]
    draftMessage: string
    assistantName: string
    currentPersonDisplayName: string
    streamingDurationByHandle: Record<number, number>
    hasMoreMessages: boolean
    isLoadingOlderMessages: boolean
    isVoiceInputAvailable: boolean
    isVoiceOutputAvailable: boolean
    isRecordingVoiceInput: boolean
    isTranscribingVoiceInput: boolean
    canUploadImportAttachment: boolean
    isUploadingImportAttachment: boolean
    pendingAttachments: PendingImportAttachment[]
    queuedInputs: QueuedInput[]
    activeToolActionHandles: Record<number, boolean>
    speechStateByHandle: Record<number, string>
    titlePreviewLimit?: number
  }>(),
  {
    titlePreviewLimit: 30,
  },
)

const emit = defineEmits<{
  (event: 'update:draftMessage', value: string): void
  (event: 'update:selectedAgent', value: string): void
  (event: 'update:selectedPlaybook', value: string | null): void
  (event: 'send'): void
  (event: 'steer'): void
  (event: 'cancel-queued-input', handle: number): void
  (event: 'retry-runtime-catalog'): void
  (event: 'close'): void
  (event: 'load-older-messages'): void
  (event: 'toggle-message-speech', message: AiChatMessageItem): void
  (event: 'confirm-tool-action', action: AiChatToolActionItem): void
  (event: 'reject-tool-action', action: AiChatToolActionItem): void
  (event: 'toggle-voice-input'): void
  (event: 'upload-import-attachment', file: File): void
  (event: 'remove-import-attachment', handle: number): void
}>()

const { t, te } = useI18n()
const importFileInput = ref<HTMLInputElement | null>(null)
const messageInput = ref<{ focus: () => void } | null>(null)

const draftMessageModel = computed({
  get: () => props.draftMessage,
  set: (value: string) => emit('update:draftMessage', value),
})

function getVoiceInputButtonLabel() {
  if (!props.isVoiceInputAvailable) {
    return t('aiChat.voiceInputUnavailable')
  }

  if (props.isTranscribingVoiceInput) {
    return t('aiChat.transcribingAudio')
  }

  if (props.isRecordingVoiceInput) {
    return t('aiChat.stopVoiceInput')
  }

  return t('aiChat.startVoiceInput')
}

function getTranslationLabel(property: string, fallback: string) {
  const key = `aiChat.${property}`
  return te(key) ? t(key) : fallback
}

function openImportFilePicker() {
  importFileInput.value?.click()
}

function applyConversationStarter(starter: string) {
  emit('update:draftMessage', starter)
  messageInput.value?.focus()
}

function handleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  input.value = ''

  if (!file) {
    return
  }

  emit('upload-import-attachment', file)
}

function formatAttachmentChip(attachment: PendingImportAttachment) {
  return [
    attachment.filename,
    t('aiChat.attachmentRows', { count: attachment.rowCount }),
    t('aiChat.attachmentHeaders', { count: attachment.headerCount }),
  ].join(' · ')
}
</script>
