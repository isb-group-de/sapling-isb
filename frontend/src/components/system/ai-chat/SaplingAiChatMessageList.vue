<template>
  <div
    ref="messageContainer"
    class="sapling-scroll-list sapling-chat-message-list sapling-ai-chat__messages"
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
      class="sapling-empty-state-panel sapling-empty-state-panel--compact sapling-chat-empty-state sapling-ai-chat__empty-state"
    >
      {{ hasConfiguredProviders ? t('aiChat.noMessages') : t('aiChat.noConfiguredProviders') }}
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
        'sapling-chat-message--failed': message.status === 'failed',
      }"
    >
      <div class="sapling-chat-message__role sapling-ai-chat__message-role">
        {{ getMessageRoleLabel(message) }}
        <span
          v-if="message.status === 'streaming' || message.status === 'failed'"
          class="sapling-chat-message__status sapling-ai-chat__message-status"
        >
          {{ getMessageStatusLabel(message) }}
        </span>
      </div>
      <div class="sapling-chat-message__content sapling-ai-chat__message-content">
        <v-skeleton-loader
          v-if="isMessageContentLoading(message)"
          type="paragraph"
          class="sapling-ai-chat__message-content-skeleton"
        />
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
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingMarkdownContent from '@/components/common/SaplingMarkdownContent.vue'
import type { AiChatMessageItem, AiChatToolActionItem } from '@/entity/entity'
import { normalizeAiChatErrorMessage } from '@/utils/aiChatError'
import SaplingAiChatToolActions from './SaplingAiChatToolActions.vue'
import {
  getMessageNavigationLinks,
  getMessageToolActions,
  getPrimaryRouteNavigationLink,
} from './aiChatNavigation'
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
  hasConfiguredProviders: boolean
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
const autoOpenedNavigationKeys = new Set<string>()

function getLastItem<T>(items: readonly T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined
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

  return [
    toolResults.length > 0 ? `${toolResults.length} ${t('aiChat.toolsUsed')}` : null,
    sources.length > 0 ? `${sources.length} ${t('aiChat.sourcesUsed')}` : null,
    attachmentCount > 0 ? `${attachmentCount} ${t('aiChat.attachmentsUsed')}` : null,
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
    if (messageContainer.value)
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  },
)

watch(
  () => {
    const lastMessage = getLastItem(props.messages)
    const link = lastMessage ? getPrimaryRouteNavigationLink(lastMessage) : null
    return {
      handle: lastMessage?.handle ?? null,
      status: lastMessage?.status ?? null,
      role: lastMessage?.role ?? null,
      path: link?.path ?? null,
      kind: link?.kind ?? null,
    }
  },
  async ({ handle, status, role, path, kind }) => {
    if (role !== 'assistant' || status !== 'completed' || kind !== 'route' || !path) return
    const navigationKey = `${handle ?? 'pending'}:${path}`
    if (autoOpenedNavigationKeys.has(navigationKey)) return
    autoOpenedNavigationKeys.add(navigationKey)
    await openNavigationLink(path)
  },
)

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
