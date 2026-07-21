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
        <div class="sapling-chat-welcome__icon" aria-hidden="true">
          <v-icon icon="mdi-cloud-alert-outline" size="large" />
        </div>
        <div class="sapling-chat-welcome__copy">
          <div class="sapling-section-title sapling-chat-welcome__title">
            {{
              getTranslationLabel(
                'configurationLoadFailed',
                'Die KI-Konfiguration konnte nicht geladen werden.',
              )
            }}
          </div>
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
        'sapling-chat-message--user': message.role === 'user',
        'sapling-chat-message--assistant': message.role === 'assistant',
        'sapling-chat-message--failed': message.status === 'failed',
      }"
    >
      <div class="sapling-chat-message__role-row">
        <div class="sapling-chat-message__role sapling-ai-chat__message-role">
          {{ getMessageRoleLabel(message) }}
          <span
            v-if="message.status === 'streaming' || message.status === 'failed'"
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
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingMarkdownContent from '@/components/common/SaplingMarkdownContent.vue'
import type { AiChatMessageItem, AiChatToolActionItem } from '@/entity/entity'
import { normalizeAiChatErrorMessage } from '@/utils/aiChatError'
import SaplingAiChatToolActions from './SaplingAiChatToolActions.vue'
import { getMessageNavigationLinks, getMessageToolActions } from './aiChatNavigation'
import { useSaplingAiChatNavigation } from './useSaplingAiChatNavigation'

interface ChatImportAttachment {
  attachmentHandle: number | null
  filename: string
  importBatchHandle: number | null
  summary?: {
    rowCount?: number
    headers?: unknown[]
    status?: string
  } | null
}

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
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'select-starter', starter: string): void
  (event: 'retry-runtime-catalog'): void
  (event: 'load-older-messages'): void
  (event: 'toggle-message-speech', message: AiChatMessageItem): void
  (event: 'confirm-tool-action', action: AiChatToolActionItem): void
  (event: 'reject-tool-action', action: AiChatToolActionItem): void
}>()

const { t, te } = useI18n()
const { getNavigationLinkLabel, openNavigationLink } = useSaplingAiChatNavigation({
  onNavigated: () => emit('close'),
})
const messageContainer = ref<HTMLElement | null>(null)
const isNearMessageListBottom = ref(true)
const copiedMessageKey = ref<string | null>(null)
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
  return canPlayMessageSpeech(message) || getMessageNavigationLinks(message).length > 0
}

function getMessageImportAttachments(message: AiChatMessageItem): ChatImportAttachment[] {
  const requestPayload = asRecord(message.requestPayload)
  const contextPayload = asRecord(message.contextPayload)
  const attachments = Array.isArray(requestPayload?.importAttachments)
    ? requestPayload.importAttachments
    : Array.isArray(contextPayload?.importAttachments)
      ? contextPayload.importAttachments
      : []

  return attachments.filter(isChatImportAttachment)
}

function isChatImportAttachment(value: unknown): value is ChatImportAttachment {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { filename?: unknown }).filename === 'string'
  )
}

function formatImportAttachmentChip(attachment: ChatImportAttachment) {
  const rowCount =
    typeof attachment.summary?.rowCount === 'number'
      ? t('aiChat.attachmentRows', { count: attachment.summary.rowCount })
      : null
  const headerCount = Array.isArray(attachment.summary?.headers)
    ? t('aiChat.attachmentHeaders', { count: attachment.summary.headers.length })
    : null
  return [attachment.filename, rowCount, headerCount].filter(Boolean).join(' · ')
}

function getTransparencyChips(message: AiChatMessageItem): string[] {
  const payload = asRecord(message.responsePayload)

  if (!payload || message.role !== 'assistant') {
    return []
  }

  const toolResults = Array.isArray(payload.toolResults) ? payload.toolResults : []
  const sources = Array.isArray(payload.sources)
    ? payload.sources
    : Array.isArray(payload.navigationLinks)
      ? payload.navigationLinks
      : []
  const agentVersion = asRecord(payload.agentVersion)
  const playbook = asRecord(payload.playbook)
  const attachmentCount = getMessageImportAttachments(message).length
  const durationMs = getMessageDurationMs(message, payload)

  return [
    toolResults.length > 0 ? `${toolResults.length} ${t('aiChat.toolsUsed')}` : null,
    sources.length > 0 ? `${sources.length} ${t('aiChat.sourcesUsed')}` : null,
    attachmentCount > 0 ? `${attachmentCount} ${t('aiChat.attachmentsUsed')}` : null,
    durationMs != null
      ? `${getTranslationLabel('duration', 'Dauer')}: ${formatDurationMs(durationMs)}`
      : null,
    ...getUsageChips(payload),
    typeof agentVersion?.version === 'number' ? `v${agentVersion.version}` : null,
    typeof playbook?.title === 'string' ? playbook.title : null,
  ].filter((chip): chip is string => !!chip)
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

function formatMessageTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
}

function toDateTimeAttribute(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function getMessageRoleLabel(message: AiChatMessageItem) {
  return message.role === 'assistant' ? props.assistantName : props.currentPersonDisplayName
}

function getMessageDisplayContent(message: AiChatMessageItem) {
  if (message.status === 'failed') return getFailedMessageContent(message)
  return message.content?.trim() ? message.content : (message.content ?? '')
}

function isMessageContentLoading(message: AiChatMessageItem) {
  return message.status === 'streaming' && !message.content?.trim()
}

function getMessageStatusLabel(message: AiChatMessageItem) {
  if (message.status === 'failed') return t('aiChat.failed')
  const seconds =
    message.handle == null ? 0 : (props.streamingDurationByHandle[message.handle] ?? 0)
  return t('aiChat.streamingDuration', { seconds })
}

function getMessageDurationMs(
  message: AiChatMessageItem,
  payload: Record<string, unknown>,
): number | null {
  const agentRun = asRecord(payload.agentRun)
  return (
    getFiniteNumber(payload.durationMs) ??
    getFiniteNumber(agentRun?.durationMs) ??
    getDurationBetweenDates(message.createdAt, getString(payload.completedAt) ?? message.updatedAt)
  )
}

function getUsageChips(payload: Record<string, unknown>): string[] {
  const agentRun = asRecord(payload.agentRun)
  const usagePayload = asRecord(payload.usagePayload) ?? asRecord(agentRun?.usagePayload)

  if (!usagePayload) {
    return []
  }

  const totalTokens = getFirstFiniteNumber(usagePayload, [
    'totalTokens',
    'totalTokenCount',
    'total_tokens',
  ])
  const inputTokens = getFirstFiniteNumber(usagePayload, [
    'inputTokens',
    'promptTokens',
    'promptTokenCount',
    'prompt_tokens',
  ])
  const outputTokens = getFirstFiniteNumber(usagePayload, [
    'outputTokens',
    'completionTokens',
    'candidatesTokenCount',
    'completion_tokens',
  ])

  return [
    totalTokens != null
      ? `${getTranslationLabel('tokensUsed', 'Token')}: ${formatInteger(totalTokens)}`
      : null,
    inputTokens != null
      ? `${getTranslationLabel('inputTokens', 'Input')}: ${formatInteger(inputTokens)}`
      : null,
    outputTokens != null
      ? `${getTranslationLabel('outputTokens', 'Output')}: ${formatInteger(outputTokens)}`
      : null,
  ].filter((chip): chip is string => !!chip)
}

function getTranslationLabel(property: string, fallback: string) {
  const key = `aiChat.${property}`
  return te(key) ? t(key) : fallback
}

function formatDurationMs(durationMs: number) {
  const seconds = durationMs / 1000
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: seconds < 10 ? 1 : 0,
    minimumFractionDigits: seconds < 1 ? 1 : 0,
  }).format(seconds)} s`
}

function formatInteger(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function getFirstFiniteNumber(
  payload: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = getFiniteNumber(payload[key])
    if (value != null) {
      return value
    }
  }

  return null
}

function getFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function getDurationBetweenDates(startValue: unknown, endValue: unknown): number | null {
  const start = getDateTime(startValue)
  const end = getDateTime(endValue)

  return start != null && end != null && end >= start ? end - start : null
}

function getDateTime(value: unknown): number | null {
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'string'
        ? new Date(value).getTime()
        : null

  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null
}

function getFailedMessageContent(message: AiChatMessageItem) {
  const detail = getFailedMessageDetail(message)
  if (!message.content?.trim()) {
    return detail ? `${t('aiChat.requestFailed')}\n\n${detail}` : t('aiChat.requestFailed')
  }
  return detail
    ? `${message.content}\n\n${t('aiChat.requestFailed')}\n\n${detail}`
    : `${message.content}\n\n${t('aiChat.requestFailed')}`
}

function getFailedMessageDetail(message: AiChatMessageItem) {
  const rawError = asRecord(message.responsePayload)?.error
  const error = typeof rawError === 'string' ? rawError : ''
  const errorKey = normalizeAiChatErrorMessage(error)
  const errorLabel = error && te(errorKey) ? t(errorKey) : ''

  return error === 'ai.providerNotConfigured'
    ? [errorLabel || t('aiChat.noConfiguredProviders'), t('aiChat.contactAdministrator')]
        .filter(Boolean)
        .join(' ')
    : errorLabel
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
</script>
