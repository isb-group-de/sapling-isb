<template>
  <Teleport to="body">
    <div class="sapling-overlay-shell sapling-ai-chat-shell">
      <v-btn
        data-tutorial="songbird"
        v-if="hasSaplingAiChatAccess && !isOpen && !isGhostEasterEggActive"
        class="sapling-button--round sapling-ai-chat-fab"
        color="primary"
        size="large"
        variant="elevated"
        aria-label="Songbird"
        icon="mdi-bird"
        title="Songbird"
        @click="toggleSaplingAiChat"
      >
      </v-btn>
      <GhostEasterEgg
        v-else-if="hasSaplingAiChatAccess && !isOpen"
        placement="ai-fab"
        @activate="openChatFromGhost"
      />

      <v-dialog
        :model-value="isDialogOpen"
        class="sapling-ai-chat-dialog"
        content-class="sapling-ai-chat-dialog__content"
        scrim="transparent"
        :z-index="SAPLING_AI_CHAT_OVERLAY_Z_INDEX"
        @update:model-value="handleDialogModelUpdate"
      >
        <SaplingSurface
          as="section"
          class="sapling-floating-panel sapling-floating-panel--top-center sapling-floating-panel--mobile-sheet sapling-nested-backdrop-host sapling-ai-chat"
          data-tutorial="songbird-chat"
          @click.stop
        >
          <SaplingAiChatLoadingState v-if="isTranslationLoading" />

          <template v-else>
            <SaplingAiChatHeader
              :assistant-name="assistantName"
              :is-compact-header-actions="isCompactHeaderActions"
              @close="closePanel"
              @new-chat="startNewChat"
              @open-account-settings="openAccountSettings"
              @refresh="refreshChat"
            />

            <div class="sapling-floating-panel__progress-slot sapling-ai-chat__progress-slot">
              <v-progress-linear
                v-if="isBusy"
                indeterminate
                color="primary"
                class="sapling-floating-panel__progress sapling-ai-chat__progress"
              />
            </div>

            <div class="sapling-chat-layout sapling-ai-chat__layout">
              <SaplingAiChatSessions
                :sessions="sessions"
                :active-session-handle="activeSession?.handle ?? null"
                :active-session-title="activeSession?.title ?? ''"
                :include-archived="includeArchived"
                :editing-session-handle="editingSessionHandle"
                :editing-session-title="editingSessionTitle"
                :is-collapsible="isMobileLayout"
                :is-collapsed="isSessionRailCollapsed"
                :title-preview-limit="TITLE_PREVIEW_LIMIT"
                @toggle-collapse="toggleSessionRail"
                @update:include-archived="updateIncludeArchived"
                @update:editing-session-title="editingSessionTitle = $event"
                @select="selectSession"
                @begin-rename="beginRename"
                @cancel-rename="cancelRename"
                @save-title="saveSessionTitle"
                @toggle-archive="toggleArchive"
              />

              <SaplingAiChatConversation
                :active-conversation-title="activeConversationTitle"
                :active-runtime-summary="activeRuntimeSummary"
                :agent-options="agentOptions"
                :selected-agent-config="selectedAgentConfig"
                :selected-agent-handle="selectedAgentHandle"
                :playbook-options="playbookOptions"
                :selected-playbook-handle="selectedPlaybookHandle"
                :is-agent-locked="!!activeSession?.handle"
                :has-configured-providers="hasConfiguredProviders"
                :is-loading-runtime-catalog="isLoadingChatRuntimeCatalog"
                :has-loaded-runtime-catalog="hasLoadedRuntimeCatalog"
                :runtime-catalog-load-failed="hasRuntimeCatalogLoadError"
                :has-configured-transcription-providers="hasConfiguredTranscriptionProviders"
                :can-send-message="canSendMessage"
                :is-sending="isResponseActive"
                :queued-inputs="queuedInputs"
                :messages="messages"
                :draft-message="draftMessage"
                :assistant-name="assistantName"
                :current-person-display-name="currentPersonDisplayName"
                :streaming-duration-by-handle="streamingDurationByHandle"
                :has-more-messages="hasMoreMessages"
                :is-loading-older-messages="isLoadingOlderMessages"
                :is-voice-input-available="isVoiceInputAvailable"
                :is-voice-output-available="isVoiceOutputAvailable"
                :is-recording-voice-input="isRecordingVoiceInput"
                :is-transcribing-voice-input="isTranscribingVoiceInput"
                :can-upload-import-attachment="canUploadImportAttachment"
                :is-uploading-import-attachment="isUploadingImportAttachment"
                :pending-attachments="pendingAttachments"
                :active-tool-action-handles="activeToolActionHandles"
                :speech-state-by-handle="speechStateByHandle"
                :title-preview-limit="TITLE_PREVIEW_LIMIT"
                @update:draft-message="updateDraftMessage"
                @update:selected-agent="updateSelectedAgent"
                @update:selected-playbook="updateSelectedPlaybook"
                @close="closePanel"
                @load-older-messages="loadOlderMessages"
                @toggle-message-speech="toggleMessageSpeech"
                @confirm-tool-action="confirmToolAction"
                @reject-tool-action="rejectToolAction"
                @toggle-voice-input="toggleVoiceInput"
                @upload-import-attachment="uploadImportAttachment"
                @remove-import-attachment="removeImportAttachment"
                @send="sendMessage"
                @steer="steerMessage"
                @cancel-queued-input="cancelQueuedInput"
                @retry-runtime-catalog="loadRuntimeCatalogs"
              />
            </div>
          </template>
        </SaplingSurface>
      </v-dialog>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import type { AiChatSessionItem } from '@/entity/entity'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import GhostEasterEgg from '@/components/easter-egg/GhostEasterEgg.vue'
import SaplingAiChatConversation from '@/components/system/ai-chat/SaplingAiChatConversation.vue'
import SaplingAiChatHeader from '@/components/system/ai-chat/SaplingAiChatHeader.vue'
import SaplingAiChatLoadingState from '@/components/system/ai-chat/SaplingAiChatLoadingState.vue'
import SaplingAiChatSessions from '@/components/system/ai-chat/SaplingAiChatSessions.vue'
import { useSaplingAiChatAttachments } from '@/components/system/ai-chat/useSaplingAiChatAttachments'
import { useSaplingAiChatMessages } from '@/components/system/ai-chat/useSaplingAiChatMessages'
import { useSaplingAiChatRuntimeCatalog } from '@/components/system/ai-chat/useSaplingAiChatRuntimeCatalog'
import { useSaplingAiChatSessions } from '@/components/system/ai-chat/useSaplingAiChatSessions'
import { useSaplingAiChatSpeechPlayback } from '@/components/system/ai-chat/useSaplingAiChatSpeechPlayback'
import { useSaplingAiChatStream } from '@/components/system/ai-chat/useSaplingAiChatStream'
import { useSaplingAiChatVoiceInput } from '@/components/system/ai-chat/useSaplingAiChatVoiceInput'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useGhostEasterEgg } from '@/composables/easter-egg/useGhostEasterEgg'
import { useSaplingAiChat } from '@/composables/system/useSaplingAiChat'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { SAPLING_AI_CHAT_PROMPT_EVENT } from '@/utils/saplingScriptResultUtil'
import {
  SAPLING_AI_PREFERENCES_UPDATED_EVENT,
  loadSaplingAiPreferences,
  type SaplingAiPreferences,
} from '@/services/ai-preferences.service'
import { openSaplingAccountDialog } from '@/services/account-dialog.service'

interface SaplingAiChatPromptEventDetail {
  prompt?: string
  autoSend?: boolean
  newChat?: boolean
  agentHandle?: string
  playbookHandle?: string
  contextEntityHandle?: string
  contextRecordHandle?: string
}

const assistantName = 'Songbird'
const TITLE_PREVIEW_LIMIT = 30
const SAPLING_AI_CHAT_OVERLAY_Z_INDEX = 13000
const route = useRoute()
const currentPersonStore = useCurrentPersonStore()
const messageCenter = useSaplingMessageCenter()
const { t } = useI18n()
const { mdAndDown, smAndDown } = useDisplay()
const { isLoading: isTranslationLoading, loadTranslations } = useTranslationLoader(
  'aiChat',
  'ai',
  'import',
  'navigation',
  'global',
)
const isCompactHeaderActions = mdAndDown
const isMobileLayout = computed(() => smAndDown.value)
const activeSession = ref<AiChatSessionItem | null>(null)
const draftMessage = ref('')
const selectedContextEntityHandle = ref<string | null>(null)
const selectedContextRecordHandle = ref<string | null>(null)
const isSessionRailCollapsed = ref(false)
const hasInitialized = ref(false)
let initializationPromise: Promise<void> | null = null
let streamingClockTimer: number | null = null
let persistedActivityTimer: number | null = null
let persistedActivityRefresh: Promise<void> | null = null
let isLocalStreamSending = () => false

const {
  isOpen,
  hasSaplingAiChatAccess,
  ensureSaplingAiChatAccess,
  closeSaplingAiChat,
  toggleSaplingAiChat,
  openSaplingAiChat,
} = useSaplingAiChat()
const { isActive: isGhostEasterEggActive } = useGhostEasterEgg()
const {
  messages,
  hasMoreMessages,
  nextMessageBeforeSequence,
  streamingClock,
  streamingDurationByHandle,
  resetMessageWindow,
  mergeMessages,
  upsertMessage,
  appendMessageDelta,
  appendLocalFailedExchange,
} = useSaplingAiChatMessages()
const runtime = useSaplingAiChatRuntimeCatalog(activeSession, loadSaplingAiPreferences())
const {
  agentOptions,
  playbookOptions,
  speechModelConfigs,
  selectedAgentConfig,
  selectedProviderConfig,
  selectedModelConfig,
  selectedProviderHandle,
  selectedModelHandle,
  selectedAgentHandle,
  selectedPlaybookHandle,
  selectedTranscriptionProviderHandle,
  selectedTranscriptionModelHandle,
  selectedSpeechProviderHandle,
  selectedSpeechModelHandle,
  isLoadingChatRuntimeCatalog,
  hasLoadedRuntimeCatalog,
  hasRuntimeCatalogLoadError,
  hasConfiguredProviders,
  hasConfiguredTranscriptionProviders,
  canSendMessage,
  isVoiceOutputAvailable,
  canUploadImportAttachment,
  loadRuntimeCatalogs,
  applyPreferences,
  applyPromptRuntime,
  updateSelectedAgent,
  updateSelectedPlaybook,
  syncSelectedAgent,
  syncSelectedPlaybook,
  syncSelectedRuntimeTarget,
  getAgentHandle,
  getPlaybookHandle,
} = runtime
const sessionState = useSaplingAiChatSessions({
  activeSession,
  messages,
  hasMoreMessages,
  nextMessageBeforeSequence,
  selectedPlaybookHandle,
  resetMessageWindow,
  mergeMessages,
  syncSelectedAgent,
  syncSelectedPlaybook,
  getPlaybookHandle,
  onActiveSessionArchived: () => startNewChat(),
})
const {
  sessions,
  includeArchived,
  isLoadingSessions,
  isLoadingMessages,
  isLoadingOlderMessages,
  editingSessionHandle,
  editingSessionTitle,
  reloadSessions,
  loadMessages,
  loadOlderMessages,
  refreshPersistedActivity,
  markSessionRead,
  updateIncludeArchived,
  beginRename,
  cancelRename,
  saveSessionTitle,
  toggleArchive,
  replaceSession,
} = sessionState
const {
  pendingAttachments,
  isUploadingImportAttachment,
  uploadImportAttachment,
  removeImportAttachment,
  resetImportAttachments,
} = useSaplingAiChatAttachments(
  canUploadImportAttachment,
  () => activeSession.value?.handle ?? null,
)

const voiceInput = useSaplingAiChatVoiceInput({
  activeSession,
  draftMessage,
  selectedTranscriptionProviderHandle,
  selectedTranscriptionModelHandle,
  hasConfiguredProviders,
  hasConfiguredTranscriptionProviders,
  route,
  sendMessage: () => sendMessage(),
  isResponseActive: () =>
    isLocalStreamSending() || activeSession.value?.responseStatus === 'responding',
  pushMessage: messageCenter.pushMessage,
})
const {
  isRecordingVoiceInput,
  isTranscribingVoiceInput,
  isVoiceInputAvailable,
  activeTranscriptionHandle,
  toggleVoiceInput,
  cancelVoiceInput,
} = voiceInput
const speechPlayback = useSaplingAiChatSpeechPlayback({
  isOpen,
  isVoiceOutputAvailable,
  activeSession,
  messages,
  selectedSpeechProviderHandle,
  selectedSpeechModelHandle,
  speechModelConfigs,
  upsertMessage,
  reportPlaybackError: () =>
    messageCenter.pushMessage('error', 'ai.speech.playbackFailed', '', 'aiChat'),
})
const {
  speechStateByHandle,
  autoPlayAssistantSpeech,
  toggleMessageSpeech,
  stopSpeechPlayback,
  revokeSpeechObjectUrls,
} = speechPlayback
const {
  isSending,
  queuedInputs,
  activeToolActionHandles,
  sendMessage,
  steerMessage,
  loadQueuedInputs,
  cancelQueuedInput,
  confirmToolAction,
  rejectToolAction,
  abortStream,
} = useSaplingAiChatStream({
  route,
  isOpen,
  activeSession,
  messages,
  draftMessage,
  canSendMessage,
  selectedProviderHandle,
  selectedModelHandle,
  selectedAgentHandle,
  selectedPlaybookHandle,
  selectedContextEntityHandle,
  selectedContextRecordHandle,
  activeTranscriptionHandle,
  pendingAttachments,
  defaultAttachmentPrompt: () => t('aiChat.defaultImportAttachmentPrompt'),
  currentPersonHandle: () => currentPersonStore.person?.handle ?? 0,
  reportMessage: messageCenter.pushMessage,
  upsertMessage,
  appendMessageDelta,
  appendLocalFailedExchange,
  replaceSession,
  loadMessages,
  autoPlayAssistantSpeech,
  onSessionResponseFinished: markSessionResponseFinished,
})
isLocalStreamSending = () => isSending.value

const isBusy = computed(
  () =>
    isLoadingChatRuntimeCatalog.value ||
    isLoadingSessions.value ||
    isLoadingMessages.value ||
    isSending.value,
)
const isResponseActive = computed(
  () => isSending.value || activeSession.value?.responseStatus === 'responding',
)
const isDialogOpen = computed(() => isOpen.value && hasSaplingAiChatAccess.value)
const activeConversationTitle = computed(
  () => activeSession.value?.title || t('aiChat.draftConversation'),
)
const activeRuntimeSummary = computed(() =>
  [
    selectedAgentConfig.value?.title ?? selectedAgentHandle.value,
    selectedProviderConfig.value?.title ?? selectedProviderHandle.value,
    selectedModelConfig.value?.title ?? selectedModelHandle.value,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' / '),
)
const currentPersonDisplayName = computed(() => {
  const person = currentPersonStore.person
  if (!person) return t('aiChat.user')
  const fullName = [person.firstName, person.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
  return fullName || person.loginName || t('aiChat.user')
})

watch(isMobileLayout, (isMobile) => (isSessionRailCollapsed.value = isMobile), {
  immediate: true,
})
watch(
  () => currentPersonStore.person?.handle,
  async (handle) => {
    if (handle && hasInitialized.value) await reloadSessions()
  },
)
watch(
  () => isOpen.value,
  async (nextIsOpen) => {
    if (!nextIsOpen) return
    if (!(await ensureSaplingAiChatAccess())) {
      closePanel()
      return
    }
    try {
      await ensureChatInitialized()
      await markSessionRead(activeSession.value?.handle)
    } catch {
      // Underlying services already report initialization failures.
    }
  },
  { immediate: true },
)
watch(hasSaplingAiChatAccess, (hasAccess) => {
  if (!hasAccess && isOpen.value) closePanel()
})
watch(activeSession, syncSelectedRuntimeTarget, { immediate: true })
watch(
  () => activeSession.value?.handle ?? null,
  (handle) => void loadQueuedInputs(handle).catch(() => undefined),
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener(SAPLING_AI_CHAT_PROMPT_EVENT, handleAiChatPromptEvent as EventListener)
  window.addEventListener(
    SAPLING_AI_PREFERENCES_UPDATED_EVENT,
    handleAiPreferencesUpdated as EventListener,
  )
  streamingClockTimer = window.setInterval(() => (streamingClock.value = Date.now()), 1000)
  persistedActivityTimer = window.setInterval(pollPersistedChatActivity, 1250)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener(SAPLING_AI_CHAT_PROMPT_EVENT, handleAiChatPromptEvent as EventListener)
  window.removeEventListener(
    SAPLING_AI_PREFERENCES_UPDATED_EVENT,
    handleAiPreferencesUpdated as EventListener,
  )
  abortStream()
  cancelVoiceInput()
  stopSpeechPlayback()
  revokeSpeechObjectUrls()
  if (streamingClockTimer != null) window.clearInterval(streamingClockTimer)
  if (persistedActivityTimer != null) window.clearInterval(persistedActivityTimer)
})

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closePanel()
}

function handleAiChatPromptEvent(event: CustomEvent<SaplingAiChatPromptEventDetail>) {
  void openPromptFromScriptButton(event.detail)
}

function handleAiPreferencesUpdated(event: CustomEvent<SaplingAiPreferences>) {
  applyPreferences(event.detail)
}

function handleDialogModelUpdate(nextIsOpen: boolean) {
  if (!nextIsOpen) closePanel()
}

async function openPromptFromScriptButton(detail?: SaplingAiChatPromptEventDetail) {
  const prompt = detail?.prompt?.trim()
  if (!prompt) return
  if (!(await ensureSaplingAiChatAccess())) {
    messageCenter.pushMessage('warning', 'global.permissionDenied', '', 'aiChat')
    return
  }

  isOpen.value = true
  await ensureChatInitialized()
  if (detail?.newChat !== false) startNewChat()
  applyPromptContext(detail)
  draftMessage.value = prompt
  if (detail?.autoSend !== false) {
    await nextTick()
    await sendMessage()
  }
}

async function ensureChatInitialized() {
  if (hasInitialized.value && hasLoadedRuntimeCatalog.value) return
  if (initializationPromise) return initializationPromise

  initializationPromise = (async () => {
    await Promise.all([
      currentPersonStore.fetchCurrentPerson(),
      loadTranslations(),
      loadRuntimeCatalogs(),
    ])
    if (currentPersonStore.person?.handle) await reloadSessions()
    hasInitialized.value = true
  })()

  try {
    await initializationPromise
  } finally {
    initializationPromise = null
  }
}

async function refreshChat() {
  await Promise.all([loadRuntimeCatalogs(), reloadSessions()])
}

async function selectSession(session: AiChatSessionItem) {
  cancelVoiceInput()
  stopSpeechPlayback()
  activeSession.value = session
  selectedAgentHandle.value = getAgentHandle(session.agent)
  selectedPlaybookHandle.value = getPlaybookHandle(session.playbook)
  activeTranscriptionHandle.value = null
  resetImportAttachments()
  editingSessionHandle.value = null
  isOpen.value = true
  await Promise.all([
    loadMessages(session.handle),
    loadQueuedInputs(session.handle),
    markSessionRead(session.handle),
  ])
  if (isMobileLayout.value) isSessionRailCollapsed.value = true
}

function startNewChat() {
  cancelVoiceInput()
  stopSpeechPlayback()
  activeSession.value = null
  messages.value = []
  resetMessageWindow()
  draftMessage.value = ''
  activeTranscriptionHandle.value = null
  resetImportAttachments()
  queuedInputs.value = []
  editingSessionHandle.value = null
  selectedContextEntityHandle.value = null
  selectedContextRecordHandle.value = null
  isOpen.value = true
  syncSelectedAgent()
  syncSelectedPlaybook()
  syncSelectedRuntimeTarget()
  if (isMobileLayout.value) isSessionRailCollapsed.value = true
}

function applyPromptContext(detail?: SaplingAiChatPromptEventDetail) {
  applyPromptRuntime(detail?.agentHandle, detail?.playbookHandle)
  selectedContextEntityHandle.value = detail?.contextEntityHandle?.trim() || null
  selectedContextRecordHandle.value = detail?.contextRecordHandle?.trim() || null
}

function updateDraftMessage(value: string) {
  draftMessage.value = value
  if (!value.trim()) activeTranscriptionHandle.value = null
}

function toggleSessionRail() {
  if (isMobileLayout.value) isSessionRailCollapsed.value = !isSessionRailCollapsed.value
}

function markSessionResponseFinished(sessionHandle: number) {
  if (!isOpen.value || activeSession.value?.handle !== sessionHandle) return
  void markSessionRead(sessionHandle).catch(() => undefined)
}

function pollPersistedChatActivity() {
  if (
    persistedActivityRefresh ||
    !isOpen.value ||
    (!sessions.value.some((session) => session.responseStatus === 'responding') &&
      queuedInputs.value.length === 0)
  ) {
    return
  }

  persistedActivityRefresh = (async () => {
    const activeResponseCompleted = await refreshPersistedActivity()
    await loadQueuedInputs(activeSession.value?.handle ?? null)
    if (activeResponseCompleted && activeSession.value?.handle) {
      await markSessionRead(activeSession.value.handle)
    }
  })()
    .catch(() => undefined)
    .finally(() => {
      persistedActivityRefresh = null
    })
}

function closePanel() {
  cancelVoiceInput()
  stopSpeechPlayback()
  closeSaplingAiChat()
}

async function openChatFromGhost() {
  await openSaplingAiChat()
}

function openAccountSettings() {
  openSaplingAccountDialog('songbird')
}
</script>
