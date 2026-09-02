<template>
  <div
    ref="messageContainer"
    class="sapling-scroll-list sapling-chat-message-list sapling-ai-chat__messages"
    @scroll="handleMessageScroll"
  >
    <div v-if="hasMoreMessages" class="sapling-ai-chat__history-loader">
      <v-btn
        size="small"
        variant="text"
        :loading="isLoadingOlderMessages"
        @click="emit('load-older-messages')"
      >
        {{ t('aiChat.loadOlderMessages') }}
      </v-btn>
    </div>

    <div
      v-if="messages.length === 0"
      class="sapling-empty-state-panel sapling-chat-empty-state sapling-chat-welcome sapling-ai-chat__empty-state"
    >
      <template v-if="isLoadingRuntimeCatalog">
        <div class="sapling-chat-welcome__icon" aria-hidden="true">
          <v-progress-circular indeterminate color="primary" size="28" width="3" />
        </div>
        <div class="sapling-chat-welcome__copy">
          <div class="sapling-section-title sapling-chat-welcome__title">
            {{ getTranslationLabel('loadingConfiguration', 'KI-Konfiguration wird geladen …') }}
          </div>
        </div>
      </template>
      <template v-else-if="!hasLoadedRuntimeCatalog || runtimeCatalogLoadFailed">
        <div class="sapling-chat-welcome__copy">
          <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="emit('retry-runtime-catalog')">
            {{ getTranslationLabel('retryConfiguration', 'Erneut laden') }}
          </v-btn>
        </div>
      </template>
      <template v-else-if="hasConfiguredProviders">
        <div class="sapling-chat-welcome__icon" aria-hidden="true">
          <v-icon :icon="agentIcon || 'mdi-creation'" size="large" />
        </div>
        <div class="sapling-chat-welcome__copy">
          <div class="sapling-section-title sapling-chat-welcome__title">{{ agentTitle }}</div>
          <SaplingMarkdownContent
            v-if="welcomeMessage"
            class="sapling-chat-welcome__message"
            :source="welcomeMessage"
          />
          <p v-else class="sapling-chat-welcome__message">{{ t('aiChat.noMessages') }}</p>
        </div>
        <div
          v-if="conversationStarters.length > 0"
          class="sapling-chat-welcome__starters"
          :aria-label="getTranslationLabel('conversationStarters', 'Vorschläge')"
        >
          <v-btn
            v-for="starter in conversationStarters"
            :key="starter"
            class="sapling-chat-welcome__starter"
            variant="tonal"
            append-icon="mdi-arrow-right"
            @click="emit('select-starter', starter)"
          >
            {{ starter }}
          </v-btn>
        </div>
      </template>
      <template v-else>
        <div class="sapling-chat-welcome__icon" aria-hidden="true">
          <v-icon icon="mdi-cloud-alert-outline" size="large" />
        </div>
        <div class="sapling-chat-welcome__copy">
          <div class="sapling-section-title sapling-chat-welcome__title">
            {{ t('aiChat.noConfiguredProviders') }}
          </div>
          <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="emit('retry-runtime-catalog')">
            {{ getTranslationLabel('retryConfiguration', 'Erneut laden') }}
          </v-btn>
        </div>
      </template>
    </div>

    <div
      v-for="message in messages"
      :key="message.handle ?? `${message.sequence}-${message.role}`"
      class="sapling-chat-message sapling-ai-chat__message"
      :class="{
        'sapling-ai-chat__message--user': message.role === 'user',
        'sapling-ai-chat__message--assistant': message.role === 'assistant',
        'sapling-ai-chat__message--failed': message.status === 'failed',
        'sapling-ai-chat__message--interrupted': message.status === 'interrupted',
        'sapling-chat-message--user': message.role === 'user',
        'sapling-chat-message--assistant': message.role === 'assistant',
        'sapling-chat-message--failed': message.status === 'failed',
      }"
    >
      <div class="sapling-chat-message__role-row">
        <div class="sapling-chat-message__role sapling-ai-chat__message-role">
          {{ getMessageRoleLabel(message) }}
          <span
            v-if="
              message.status === 'streaming' ||
              message.status === 'failed' ||
              message.status === 'interrupted'
            "
            class="sapling-chat-message__status sapling-ai-chat__message-status"
          >
            {{ getMessageStatusLabel(message) }}
          </span>
          <time
            v-if="message.createdAt"
            class="sapling-chat-message__time"
            :datetime="toDateTimeAttribute(message.createdAt)"
          >
            {{ formatMessageTime(message.createdAt) }}
          </time>
        </div>
        <v-btn
          v-if="canCopyMessage(message)"
          class="sapling-chat-message__copy"
          :icon="copiedMessageKey === getMessageKey(message) ? 'mdi-check' : 'mdi-content-copy'"
          size="x-small"
          variant="text"
          :aria-label="
            copiedMessageKey === getMessageKey(message)
              ? getTranslationLabel('messageCopied', 'Nachricht kopiert')
              : getTranslationLabel('copyMessage', 'Nachricht kopieren')
          "
          :title="
            copiedMessageKey === getMessageKey(message)
              ? getTranslationLabel('messageCopied', 'Nachricht kopiert')
              : getTranslationLabel('copyMessage', 'Nachricht kopieren')
          "
          @click="copyMessage(message)"
        />
      </div>
      <div class="sapling-chat-message__content sapling-ai-chat__message-content">
        <div
          v-if="isMessageContentLoading(message)"
          class="sapling-chat-message__typing sapling-ai-chat__message-typing"
          role="status"
          :aria-label="getTranslationLabel('writing', 'Antwort wird geschrieben')"
        >
          <span class="sapling-chat-message__typing-dot" aria-hidden="true" />
          <span class="sapling-chat-message__typing-dot" aria-hidden="true" />
          <span class="sapling-chat-message__typing-dot" aria-hidden="true" />
        </div>
        <SaplingMarkdownContent v-else :source="getMessageDisplayContent(message)" />
      </div>
      <div v-if="getMessageProgress(message)" class="sapling-ai-chat__work-log">
        <v-btn
          size="small"
          variant="text"
          :append-icon="isWorkLogOpen(message) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          @click="toggleWorkLog(message)"
        >
          {{ t('aiChat.workLog') }}
        </v-btn>
        <div v-if="isWorkLogOpen(message)" class="sapling-ai-chat__work-log-content">
          <SaplingMarkdownContent
            v-if="getMessageProgress(message)?.reasoningSummary"
            :source="getMessageProgress(message)?.reasoningSummary || ''"
          />
          <v-list density="compact" bg-color="transparent">
            <v-list-item
              v-for="step in getMessageProgress(message)?.steps || []"
              :key="step.id"
              :prepend-icon="
                step.status === 'running' ? 'mdi-loading mdi-spin' : 'mdi-check-circle-outline'
              "
              :title="getProgressStepLabel(step)"
            />
          </v-list>
        </div>
      </div>
      <div
        v-if="getMessageImportAttachments(message).length > 0"
        class="sapling-chip-row sapling-ai-chat__attachment-chips"
      >
        <v-chip
          v-for="attachment in getMessageImportAttachments(message)"
          :key="`${message.handle ?? message.sequence}-${attachment.attachmentHandle}`"
          size="small"
          variant="tonal"
          prepend-icon="mdi-file-delimited-outline"
        >
          {{ formatImportAttachmentChip(attachment) }}
        </v-chip>
      </div>
      <SaplingAiChatToolActions
        :actions="getMessageToolActions(message)"
        :active-tool-action-handles="activeToolActionHandles"
        @confirm="emit('confirm-tool-action', $event)"
        @reject="emit('reject-tool-action', $event)"
        @close="emit('close')"
      />
      <div
        v-if="getTransparencyChips(message).length > 0"
        class="sapling-chip-row sapling-ai-chat__transparency"
      >
        <v-chip
          v-for="chip in getTransparencyChips(message)"
          :key="chip"
          size="small"
          variant="tonal"
          prepend-icon="mdi-eye-outline"
        >
          {{ chip }}
        </v-chip>
      </div>
      <div
        v-if="shouldShowMessageActions(message)"
        class="sapling-chip-row sapling-chat-message__actions sapling-ai-chat__message-links"
      >
        <v-btn
          v-if="canRateMessage(message)"
          :icon="message.rating === 1 ? 'mdi-thumb-up' : 'mdi-thumb-up-outline'"
          size="small"
          :variant="message.rating === 1 ? 'tonal' : 'text'"
          :color="message.rating === 1 ? 'success' : undefined"
          :loading="isMessageRatingLoading(message)"
          :aria-label="getTranslationLabel('ratePositive', 'Antwort positiv bewerten')"
          :title="getTranslationLabel('ratePositive', 'Antwort positiv bewerten')"
          @click="emitMessageRating(message, message.rating === 1 ? null : 1)"
        />
        <v-btn
          v-if="canRateMessage(message)"
          :icon="message.rating === -1 ? 'mdi-thumb-down' : 'mdi-thumb-down-outline'"
          size="small"
          :variant="message.rating === -1 ? 'tonal' : 'text'"
          :color="message.rating === -1 ? 'error' : undefined"
          :loading="isMessageRatingLoading(message)"
          :aria-label="getTranslationLabel('rateNegative', 'Antwort negativ bewerten')"
          :title="getTranslationLabel('rateNegative', 'Antwort negativ bewerten')"
          @click="emitMessageRating(message, message.rating === -1 ? null : -1)"
        />
        <v-btn
          v-if="canPlayMessageSpeech(message)"
          size="small"
          variant="tonal"
          :loading="getMessageSpeechState(message) === 'loading'"
          :prepend-icon="getMessageSpeechButtonIcon(message)"
          @click="emit('toggle-message-speech', message)"
        >
          {{ getMessageSpeechButtonLabel(message) }}
        </v-btn>
        <v-btn
          v-for="link in getMessageNavigationLinks(message)"
          :key="`${message.handle ?? message.sequence}-${link.path}`"
          size="small"
          variant="tonal"
          prepend-icon="mdi-open-in-app"
          @click="openNavigationLink(link.path)"
        >
          {{ getNavigationLinkLabel(link) }}
        </v-btn>
        <v-btn
          v-for="source in getMessageWebSources(message)"
          :key="`${message.handle ?? message.sequence}-${source.url}`"
          :href="source.url"
          rel="noopener noreferrer"
          size="small"
          variant="tonal"
          prepend-icon="mdi-web"
          :title="getTranslationLabel('webSource', 'Webquelle öffnen')"
        >
          {{ source.title }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingMarkdownContent from '@/components/common/SaplingMarkdownContent.vue'
import type { AiChatMessageItem, AiChatToolActionItem } from '@/entity/entity'
import SaplingAiChatToolActions from './SaplingAiChatToolActions.vue'
import { getMessageNavigationLinks, getMessageToolActions } from './aiChatNavigation'
import { useSaplingAiChatNavigation } from './useSaplingAiChatNavigation'
import { useSaplingAiChatMessagePresentation } from './useSaplingAiChatMessagePresentation'

const props = defineProps<{
  messages: AiChatMessageItem[]
  agentTitle: string
  agentIcon?: string | null
  welcomeMessage?: string | null
  conversationStarters: string[]
  hasConfiguredProviders: boolean
  isLoadingRuntimeCatalog: boolean
  hasLoadedRuntimeCatalog: boolean
  runtimeCatalogLoadFailed: boolean
  hasMoreMessages: boolean
  isLoadingOlderMessages: boolean
  isVoiceOutputAvailable: boolean
  assistantName: string
  currentPersonDisplayName: string
  streamingDurationByHandle: Record<number, number>
  activeToolActionHandles: Record<number, boolean>
  speechStateByHandle: Record<number, string>
  ratingStateByHandle: Record<number, boolean>
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'select-starter', starter: string): void
  (event: 'retry-runtime-catalog'): void
  (event: 'load-older-messages'): void
  (event: 'toggle-message-speech', message: AiChatMessageItem): void
  (event: 'confirm-tool-action', action: AiChatToolActionItem): void
  (event: 'reject-tool-action', action: AiChatToolActionItem): void
  (
    event: 'update-message-rating',
    payload: { message: AiChatMessageItem; rating: -1 | 1 | null },
  ): void
}>()

const { t, te } = useI18n()
const {
  formatImportAttachmentChip,
  formatMessageTime,
  getMessageDisplayContent,
  getMessageImportAttachments,
  getMessageProgress,
  getMessageWebSources,
  getProgressStepLabel,
  getTranslationLabel,
  getTransparencyChips,
  toDateTimeAttribute,
} = useSaplingAiChatMessagePresentation({
  t: (key, params) => String(t(key, params ?? {})),
  te,
})
const { getNavigationLinkLabel, openNavigationLink } = useSaplingAiChatNavigation({
  onNavigated: () => emit('close'),
})
const messageContainer = ref<HTMLElement | null>(null)
const isNearMessageListBottom = ref(true)
const copiedMessageKey = ref<string | null>(null)
const workLogOpenByMessage = ref<Record<string, boolean>>({})
let copiedMessageTimer: number | null = null

onUnmounted(() => {
  if (copiedMessageTimer != null) window.clearTimeout(copiedMessageTimer)
})

function getLastItem<T>(items: readonly T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined
}

watch(
  () => getMessageSessionKey(props.messages[0]),
  async () => {
    isNearMessageListBottom.value = true
    await nextTick()
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }
  },
)

function getMessageSessionKey(message?: AiChatMessageItem) {
  const session = message?.session
  if (typeof session === 'number') return session
  return session?.handle ?? null
}

function shouldShowMessageActions(message: AiChatMessageItem) {
  return (
    canRateMessage(message) ||
    canPlayMessageSpeech(message) ||
    getMessageNavigationLinks(message).length > 0 ||
    getMessageWebSources(message).length > 0
  )
}

function canRateMessage(message: AiChatMessageItem) {
  return (
    message.role === 'assistant' &&
    message.status !== 'streaming' &&
    message.status !== 'interrupted' &&
    message.handle != null &&
    message.handle > 0
  )
}

function isMessageRatingLoading(message: AiChatMessageItem) {
  return message.handle != null && props.ratingStateByHandle[message.handle] === true
}

function emitMessageRating(message: AiChatMessageItem, rating: -1 | 1 | null) {
  if (!canRateMessage(message) || isMessageRatingLoading(message)) return
  emit('update-message-rating', { message, rating })
}

function canPlayMessageSpeech(message: AiChatMessageItem) {
  return (
    props.isVoiceOutputAvailable &&
    message.role === 'assistant' &&
    message.status === 'completed' &&
    message.handle != null &&
    !!message.content?.trim()
  )
}

function getMessageSpeechState(message: AiChatMessageItem) {
  return message.handle == null ? 'idle' : (props.speechStateByHandle[message.handle] ?? 'idle')
}

function getMessageSpeechButtonIcon(message: AiChatMessageItem) {
  return getMessageSpeechState(message) === 'playing' ? 'mdi-pause' : 'mdi-volume-high'
}

function getMessageSpeechButtonLabel(message: AiChatMessageItem) {
  const speechState = getMessageSpeechState(message)
  if (speechState === 'loading') return t('aiChat.loadingVoiceOutput')
  if (speechState === 'playing') return t('aiChat.pauseVoiceOutput')
  return t('aiChat.playVoiceOutput')
}

watch(
  () => {
    const lastMessage = getLastItem(props.messages)
    return lastMessage
      ? `${lastMessage.handle ?? 'pending'}:${lastMessage.content?.length ?? 0}:${lastMessage.status ?? ''}`
      : 'empty'
  },
  async () => {
    await nextTick()
    if (messageContainer.value && isNearMessageListBottom.value)
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  },
)

function handleMessageScroll() {
  const container = messageContainer.value
  if (!container) return
  isNearMessageListBottom.value =
    container.scrollHeight - container.scrollTop - container.clientHeight < 96
}

function canCopyMessage(message: AiChatMessageItem) {
  return message.status !== 'streaming' && !!message.content?.trim()
}

function getMessageKey(message: AiChatMessageItem) {
  return String(message.handle ?? `${message.sequence}-${message.role}`)
}

async function copyMessage(message: AiChatMessageItem) {
  if (!canCopyMessage(message) || !navigator.clipboard) return

  try {
    await navigator.clipboard.writeText(message.content)
    copiedMessageKey.value = getMessageKey(message)
    if (copiedMessageTimer != null) window.clearTimeout(copiedMessageTimer)
    copiedMessageTimer = window.setTimeout(() => (copiedMessageKey.value = null), 1800)
  } catch {
    // Clipboard permissions remain controlled by the browser.
  }
}

function getMessageRoleLabel(message: AiChatMessageItem) {
  return message.role === 'assistant' ? props.assistantName : props.currentPersonDisplayName
}

function isWorkLogOpen(message: AiChatMessageItem) {
  const key = getMessageKey(message)
  return workLogOpenByMessage.value[key] ?? message.status === 'streaming'
}

function toggleWorkLog(message: AiChatMessageItem) {
  const key = getMessageKey(message)
  workLogOpenByMessage.value = {
    ...workLogOpenByMessage.value,
    [key]: !isWorkLogOpen(message),
  }
}

function isMessageContentLoading(message: AiChatMessageItem) {
  return message.status === 'streaming' && !message.content?.trim()
}

function getMessageStatusLabel(message: AiChatMessageItem) {
  if (message.status === 'failed') return t('aiChat.failed')
  if (message.status === 'interrupted') return t('aiChat.interrupted')
  const seconds =
    message.handle == null ? 0 : (props.streamingDurationByHandle[message.handle] ?? 0)
  return t('aiChat.streamingDuration', { seconds })
}
</script>
