import {
  resolveSongbirdWidgetRuntime,
  isSongbirdWidgetRuntimeAvailable,
} from './songbirdWidgetRuntime'

import { computed, nextTick, ref, watch, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { AiChatSessionItem } from '@/entity/entity'
import { useSaplingAiChatAttachments } from '@/components/system/ai-chat/useSaplingAiChatAttachments'
import { useSaplingAiChatMessages } from '@/components/system/ai-chat/useSaplingAiChatMessages'
import { useSaplingAiChatRuntimeCatalog } from '@/components/system/ai-chat/useSaplingAiChatRuntimeCatalog'
import { useSaplingAiChatSessions } from '@/components/system/ai-chat/useSaplingAiChatSessions'
import { useSaplingAiChatSpeechPlayback } from '@/components/system/ai-chat/useSaplingAiChatSpeechPlayback'
import { useSaplingAiChatStream } from '@/components/system/ai-chat/useSaplingAiChatStream'
import { useSaplingAiChatVoiceInput } from '@/components/system/ai-chat/useSaplingAiChatVoiceInput'
import { useSaplingAiChatRatings } from '@/components/system/ai-chat/useSaplingAiChatRatings'
import { useSaplingAiChatLifecycle } from '@/components/system/ai-chat/useSaplingAiChatLifecycle'
import {
  createAsyncSingleFlight,
  SAPLING_AI_CHAT_TITLE_PREVIEW_LIMIT as TITLE_PREVIEW_LIMIT,
  type SaplingAiChatPromptEventDetail,
} from '@/components/system/ai-chat/saplingAiChat.utils'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingAiChat } from '@/composables/system/useSaplingAiChat'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { loadSaplingAiPreferences } from '@/services/ai-preferences.service'
import { openSaplingAccountDialog } from '@/services/account-dialog.service'

import { useSongbirdPageContext } from '@/composables/system/songbirdPageContext'
import type { SongbirdPageContext } from '@/composables/system/songbirdPageContext'
import { captureSongbirdForm } from '@/composables/system/songbirdFormRegistry'
import {
  newSongbirdWorkspace,
  selectSongbirdSession,
  type SongbirdWorkspaceEntry,
} from './songbirdWorkspaceRegistry'
export function useSongbirdWorkspace(entry: SongbirdWorkspaceEntry) {
  const assistantName = 'Songbird'
  const route = useRoute()
  const currentPersonStore = useCurrentPersonStore()
  const messageCenter = useSaplingMessageCenter()
  const { t, te } = useI18n()
  const { isLoading: isTranslationLoading, loadTranslations } = useTranslationLoader(
    'aiChat',
    'ai',
    'document',
    'import',
    'navigation',
    'global',
  )
  const isSessionRailCollapsible = computed(() => true)
  const activeSession = ref<AiChatSessionItem | null>(entry.session ?? null)
  const frozenWidget = entry.widget
    ? (JSON.parse(JSON.stringify(entry.widget)) as NonNullable<typeof entry.widget>)
    : undefined
  const visibleSurfaces = ref(0)
  function mountSurface() {
    visibleSurfaces.value++
    if (
      hasInitialized.value &&
      !isSending.value &&
      activeSession.value?.responseStatus !== 'responding'
    )
      void reloadSessions().catch(() => undefined)
  }
  function unmountSurface() {
    visibleSurfaces.value--
  }
  const isOpen = computed({ get: () => visibleSurfaces.value > 0, set: () => {} })
  const followPage = ref(!entry.widget && !entry.session?.sourceWidgetId)
  const pageContext = useSongbirdPageContext(route)
  const pinnedContext = ref<SongbirdPageContext>({
    entityHandle: entry.session?.contextEntityHandle ?? null,
    recordHandle: entry.session?.contextRecordHandle ?? null,
    label: entry.session?.contextRecordHandle ?? '',
  })
  const effectiveContext = computed(() =>
    followPage.value ? pageContext.value : pinnedContext.value,
  )
  const contextLabel = computed(() => {
    const context = effectiveContext.value
    if (context.entityHandle) {
      const key = 'navigation.' + context.entityHandle
      const label = te(key) ? t(key) : context.entityHandle
      return context.recordHandle ? label + ' · ' + (context.label || context.recordHandle) : label
    }
    return context.label === 'home' ? 'Sapling' : context.label || t('aiChat.noPageContext')
  })
  function toggleContext() {
    if (followPage.value) pinnedContext.value = { ...pageContext.value }
    followPage.value = !followPage.value
  }
  const draftMessage = ref('')
  const selectedContextEntityHandle = ref<string | null>(null)
  const selectedContextRecordHandle = ref<string | null>(null)
  const isSessionRailCollapsed = ref(true)
  const hasInitialized = ref(false)
  let persistedActivityRefresh: Promise<void> | null = null
  let isLocalStreamSending = () => false

  const {
    isOpen: panelOpen,
    hasSaplingAiChatAccess,
    ensureSaplingAiChatAccess,
    closeSaplingAiChat,
  } = useSaplingAiChat()

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
  const { ratingStateByHandle, updateMessageRating } = useSaplingAiChatRatings(upsertMessage)
  const runtime = useSaplingAiChatRuntimeCatalog(
    activeSession,
    loadSaplingAiPreferences(),
    () =>
      `person:${currentPersonStore.person?.handle ?? 'anonymous'}:impersonator:${currentPersonStore.impersonator?.handle ?? 'none'}`,
  )
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
    canSendMessage: runtimeCanSendMessage,
    isVoiceOutputAvailable,
    canUploadImportAttachment,
    loadRuntimeCatalogs,
    loadTranscriptionCatalogs,
    loadSpeechCatalogs,
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
  includeArchived.value = entry.session?.isArchived ?? false
  const {
    pendingAttachments,
    isUploadingImportAttachment,
    uploadImportAttachment,
    removeImportAttachment,
    resetImportAttachments,
    uploadImageAttachments,
  } = useSaplingAiChatAttachments(
    canUploadImportAttachment,
    () => activeSession.value?.handle ?? null,
    {
      canUpload: computed(() => !!selectedModelConfig.value?.supportsVision),
      target: () => ({
        providerHandle: selectedProviderHandle.value ?? undefined,
        modelHandle: selectedModelHandle.value ?? undefined,
      }),
      reportError: (key) => messageCenter.pushMessage('error', key, '', 'aiChat'),
    },
  )
  const canUploadImage = computed(() => !!selectedModelConfig.value?.supportsVision)
  const widgetConfigurationError = computed(() => {
    const session = activeSession.value
    const config = session
      ? {
          agentHandle: getAgentHandle(session.agent) ?? undefined,
          providerHandle:
            typeof session.provider === 'string'
              ? session.provider
              : (session.provider?.handle ?? undefined),
          modelHandle:
            typeof session.model === 'string'
              ? session.model
              : (session.model?.handle ?? undefined),
        }
      : frozenWidget?.config
    return (
      !!config &&
      hasLoadedRuntimeCatalog.value &&
      !isSongbirdWidgetRuntimeAvailable(
        config,
        agentOptions.value,
        runtime.providerConfigs.value,
        runtime.modelConfigs.value,
      )
    )
  })
  const canSendMessage = computed(
    () =>
      hasSaplingAiChatAccess.value &&
      !widgetConfigurationError.value &&
      runtimeCanSendMessage.value &&
      !isUploadingImportAttachment.value &&
      (canUploadImage.value || !pendingAttachments.value.some((item) => item.purpose === 'vision')),
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
    ensureTranscriptionCatalog: loadTranscriptionCatalogs,
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
    ensureSpeechCatalog: loadSpeechCatalogs,
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
    payloadExtras: () => ({
      ...(!activeSession.value && frozenWidget
        ? {
            sessionTitle: frozenWidget.title,
            workspaceInstruction: frozenWidget.config.instruction,
            sourceWidgetId: frozenWidget.id,
            sourceDashboardHandle: entry.dashboardHandle,
          }
        : {}),
      contextEntityHandle: effectiveContext.value.entityHandle,
      contextRecordHandle: effectiveContext.value.recordHandle,
      ...(!followPage.value
        ? { routeName: undefined, url: undefined, pageTitle: undefined, contextPayload: {} }
        : {}),
      contextPayload: {
        ...(followPage.value
          ? { params: route.params, query: route.query, fullPath: route.fullPath }
          : {}),
        openedForm: captureSongbirdForm(effectiveContext.value.formId),
      },
    }),
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
    defaultAttachmentPrompt: () =>
      t(
        pendingAttachments.value.some((item) => item.purpose === 'vision')
          ? 'aiChat.defaultImagePrompt'
          : 'aiChat.defaultImportAttachmentPrompt',
      ),
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
  const isResponseActive = computed(
    () => isSending.value || activeSession.value?.responseStatus === 'responding',
  )
  const activeConversationTitle = computed(
    () => activeSession.value?.title || frozenWidget?.title || t('aiChat.draftConversation'),
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

  watch(isSessionRailCollapsible, (isMobile) => (isSessionRailCollapsed.value = isMobile), {
    immediate: true,
  })
  watch(
    () => currentPersonStore.person?.handle,
    async (handle) => {
      if (handle && hasInitialized.value) await reloadSessions()
    },
  )
  onMounted(async () => {
    try {
      await ensureChatInitialized()
      if (entry.session) await restoreSession(entry.session)
    } catch {
      /* Services report recoverable initialization failures. */
    }
  })
  watch(hasSaplingAiChatAccess, (hasAccess) => {
    if (!hasAccess && isOpen.value) closePanel()
  })
  watch(activeSession, syncSelectedRuntimeTarget, { immediate: true })
  watch(
    () => activeSession.value?.handle ?? null,
    (handle) => void loadQueuedInputs(handle).catch(() => undefined),
  )

  useSaplingAiChatLifecycle({
    listenForPrompts: false,
    streamingClock,
    closePanel,
    openPrompt: openPromptFromScriptButton,
    applyPreferences: (preferences) => {
      applyPreferences(preferences)
      applyFrozenWidgetRuntime()
    },
    pollPersistedActivity: pollPersistedChatActivity,
    abortStream,
    cancelVoiceInput,
    stopSpeechPlayback,
    revokeSpeechObjectUrls,
  })

  async function openPromptFromScriptButton(detail?: SaplingAiChatPromptEventDetail) {
    const prompt = detail?.prompt?.trim()
    if (!prompt) return
    if (!(await ensureSaplingAiChatAccess())) {
      messageCenter.pushMessage('warning', 'global.permissionDenied', '', 'aiChat')
      return
    }

    isOpen.value = true
    await ensureChatInitialized()

    applyPromptContext(detail)
    draftMessage.value = prompt
    if (detail?.autoSend !== false) {
      await nextTick()
      await sendMessage()
    }
  }

  function applyFrozenWidgetRuntime() {
    if (!activeSession.value && frozenWidget) {
      applyPromptRuntime(frozenWidget.config.agentHandle)
      const target = resolveSongbirdWidgetRuntime(
        frozenWidget.config,
        selectedAgentConfig.value,
        runtime.providerConfigs.value,
        runtime.modelConfigs.value,
      )
      selectedProviderHandle.value = target.providerHandle
      selectedModelHandle.value = target.modelHandle
    }
  }

  async function reloadRuntimeCatalogs() {
    await loadRuntimeCatalogs()
    applyFrozenWidgetRuntime()
  }

  const runChatInitialization = createAsyncSingleFlight(async () => {
    await Promise.all([currentPersonStore.fetchCurrentPerson(), loadTranslations()])
    await loadRuntimeCatalogs()
    void loadSpeechCatalogs().catch(() => undefined)
    if (currentPersonStore.person?.handle) await reloadSessions()
    applyFrozenWidgetRuntime()
    hasInitialized.value = true
  })

  async function ensureChatInitialized() {
    if (!hasInitialized.value || !hasLoadedRuntimeCatalog.value) await runChatInitialization()
  }

  async function restoreSession(session: AiChatSessionItem) {
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
    if (isSessionRailCollapsible.value) isSessionRailCollapsed.value = true
  }

  function startNewChat() {
    newSongbirdWorkspace(entry)
  }
  function selectSession(session: AiChatSessionItem) {
    selectSongbirdSession(session)
    panelOpen.value = true
  }
  function applyPromptContext(detail?: SaplingAiChatPromptEventDetail) {
    if (detail?.contextEntityHandle || detail?.contextRecordHandle) {
      followPage.value = false
      pinnedContext.value = {
        entityHandle: detail.contextEntityHandle ?? null,
        recordHandle: detail.contextRecordHandle ?? null,
        label: detail.contextRecordHandle ?? detail.contextEntityHandle ?? '',
      }
    }
    applyPromptRuntime(detail?.agentHandle, detail?.playbookHandle)
    selectedContextEntityHandle.value = detail?.contextEntityHandle?.trim() || null
    selectedContextRecordHandle.value = detail?.contextRecordHandle?.trim() || null
  }

  function updateDraftMessage(value: string) {
    draftMessage.value = value
    if (!value.trim()) activeTranscriptionHandle.value = null
  }

  function toggleSessionRail() {
    if (isSessionRailCollapsible.value) isSessionRailCollapsed.value = !isSessionRailCollapsed.value
  }

  function markSessionResponseFinished(sessionHandle: number) {
    if (!isOpen.value || activeSession.value?.handle !== sessionHandle) return
    void markSessionRead(sessionHandle).catch(() => undefined)
  }

  function pollPersistedChatActivity() {
    if (
      persistedActivityRefresh ||
      isSending.value ||
      (activeSession.value?.responseStatus !== 'responding' && queuedInputs.value.length === 0)
    ) {
      return
    }

    persistedActivityRefresh = (async () => {
      const activeResponseCompleted = await refreshPersistedActivity()
      await loadQueuedInputs(activeSession.value?.handle ?? null)
      if (isOpen.value && activeResponseCompleted && activeSession.value?.handle) {
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

  function openAccountSettings() {
    openSaplingAccountDialog('songbird')
  }

  return reactive({
    widgetConfigurationError,
    isTranslationLoading,
    activeConversationTitle,
    activeRuntimeSummary,
    agentOptions,
    selectedAgentConfig,
    selectedAgentHandle,
    playbookOptions,
    selectedPlaybookHandle,
    activeSession,
    frozenWidget,
    hasConfiguredProviders,
    isLoadingChatRuntimeCatalog,
    hasLoadedRuntimeCatalog,
    hasRuntimeCatalogLoadError,
    hasConfiguredTranscriptionProviders,
    canSendMessage,
    isResponseActive,
    queuedInputs,
    messages,
    draftMessage,
    assistantName,
    currentPersonDisplayName,
    streamingDurationByHandle,
    hasMoreMessages,
    isLoadingOlderMessages,
    isVoiceInputAvailable,
    isVoiceOutputAvailable,
    isRecordingVoiceInput,
    isTranscribingVoiceInput,
    canUploadImportAttachment,
    canUploadImage,
    isUploadingImportAttachment,
    pendingAttachments,
    activeToolActionHandles,
    speechStateByHandle,
    ratingStateByHandle,
    TITLE_PREVIEW_LIMIT,
    updateDraftMessage,
    updateSelectedAgent,
    updateSelectedPlaybook,
    closePanel,
    loadOlderMessages,
    toggleMessageSpeech,
    confirmToolAction,
    rejectToolAction,
    updateMessageRating,
    toggleVoiceInput,
    uploadImportAttachment,
    uploadImageAttachments,
    removeImportAttachment,
    sendMessage,
    steerMessage,
    cancelQueuedInput,
    loadRuntimeCatalogs: reloadRuntimeCatalogs,
    mountSurface,
    unmountSurface,
    contextLabel,
    followPage,
    toggleContext,
    sessions,
    includeArchived,
    editingSessionHandle,
    editingSessionTitle,
    updateEditingSessionTitle: (value: string) => {
      editingSessionTitle.value = value
    },
    isSessionRailCollapsible,
    isSessionRailCollapsed,
    toggleSessionRail,
    updateIncludeArchived,
    selectSession,
    beginRename,
    cancelRename,
    saveSessionTitle,
    toggleArchive,
    startNewChat,
    openPromptFromScriptButton,
    openAccountSettings,
    ensureChatInitialized,
    isSending,
  })
}
export type SongbirdWorkspaceState = ReturnType<typeof useSongbirdWorkspace>
