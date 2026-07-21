import { ref, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { AiChatMessageItem, AiChatSessionItem, AiChatToolActionItem } from '@/entity/entity'
import ApiAiService, { type AiChatStreamEvent } from '@/services/api.ai.service'
import { normalizeAiChatErrorMessage } from '@/utils/aiChatError'
import { isToolAction } from './aiChatNavigation'
import type { PendingImportAttachment } from './useSaplingAiChatAttachments'

interface SaplingAiChatStreamOptions {
  route: RouteLocationNormalizedLoaded
  isOpen: Ref<boolean>
  activeSession: Ref<AiChatSessionItem | null>
  messages: Ref<AiChatMessageItem[]>
  draftMessage: Ref<string>
  canSendMessage: Ref<boolean>
  selectedProviderHandle: Ref<string | null>
  selectedModelHandle: Ref<string | null>
  selectedAgentHandle: Ref<string | null>
  selectedPlaybookHandle: Ref<string | null>
  selectedContextEntityHandle: Ref<string | null>
  selectedContextRecordHandle: Ref<string | null>
  activeTranscriptionHandle: Ref<number | null>
  pendingAttachments: Ref<PendingImportAttachment[]>
  defaultAttachmentPrompt: () => string
  currentPersonHandle: () => number
  reportMessage: (
    type: 'error' | 'info' | 'success' | 'warning',
    message: string,
    description: string,
    channel: string,
  ) => void
  upsertMessage: (message: AiChatMessageItem) => void
  appendMessageDelta: (handle: number, delta: string) => void
  appendLocalFailedExchange: (options: {
    content: string
    errorMessage: string
    personHandle: number
    sessionHandle: number
  }) => void
  replaceSession: (session: AiChatSessionItem) => void
  loadMessages: (sessionHandle?: number | null) => Promise<void>
  autoPlayAssistantSpeech: (message: AiChatMessageItem) => Promise<void>
  onSessionResponseStarted: (sessionHandle: number) => void
  onSessionResponseFinished: (sessionHandle: number) => void
}

export function useSaplingAiChatStream(options: SaplingAiChatStreamOptions) {
  const isSending = ref(false)
  const streamAbortController = ref<AbortController | null>(null)
  const activeToolActionHandles = ref<Record<number, boolean>>({})
  const activeSendAttempt = ref<{
    content: string
    receivedServerEvents: boolean
    shouldAutoPlaySpeech: boolean
    sessionHandle: number | null
  } | null>(null)

  async function sendMessage() {
    const hasPendingAttachments = options.pendingAttachments.value.length > 0
    const content =
      options.draftMessage.value.trim() ||
      (hasPendingAttachments ? options.defaultAttachmentPrompt() : '')

    if (!content || isSending.value) return
    if (!options.canSendMessage.value) {
      options.reportMessage(
        'info',
        'aiChat.noConfiguredProviders',
        'aiChat.contactAdministrator',
        'aiChat',
      )
      return
    }

    isSending.value = true
    options.isOpen.value = true
    abortStream()
    streamAbortController.value = new AbortController()
    activeSendAttempt.value = {
      content,
      receivedServerEvents: false,
      shouldAutoPlaySpeech: options.activeTranscriptionHandle.value != null,
      sessionHandle: options.activeSession.value?.handle ?? null,
    }
    if (activeSendAttempt.value.sessionHandle != null) {
      options.onSessionResponseStarted(activeSendAttempt.value.sessionHandle)
    }
    options.draftMessage.value = ''
    const attachmentHandles = options.pendingAttachments.value.map(
      (attachment) => attachment.handle,
    )
    let didSendSuccessfully = false

    try {
      await ApiAiService.streamMessage(
        {
          sessionHandle: options.activeSession.value?.handle ?? undefined,
          sessionTitle: options.activeSession.value?.title,
          content,
          routeName: options.route.name != null ? String(options.route.name) : undefined,
          url: window.location.href,
          pageTitle: document.title || undefined,
          providerHandle: options.selectedProviderHandle.value ?? undefined,
          modelHandle: options.selectedModelHandle.value ?? undefined,
          agentHandle: options.selectedAgentHandle.value ?? undefined,
          playbookHandle: options.selectedPlaybookHandle.value ?? undefined,
          contextEntityHandle: options.selectedContextEntityHandle.value ?? undefined,
          contextRecordHandle: options.selectedContextRecordHandle.value ?? undefined,
          transcriptionHandle: options.activeTranscriptionHandle.value ?? undefined,
          attachmentHandles: attachmentHandles.length > 0 ? attachmentHandles : undefined,
          contextPayload: {
            params: options.route.params,
            query: options.route.query,
            fullPath: options.route.fullPath,
          },
        },
        handleStreamEvent,
        streamAbortController.value.signal,
      )
      didSendSuccessfully = true
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const reportToMessageCenter = !(
          error instanceof Error && /^ai\.chat\.streamFailed \(\d+\)$/.test(error.message)
        )
        handleChatRequestFailure(error, reportToMessageCenter)
      }
    } finally {
      if (activeSendAttempt.value?.sessionHandle != null) {
        options.onSessionResponseFinished(activeSendAttempt.value.sessionHandle)
      }
      isSending.value = false
      activeSendAttempt.value = null
      options.activeTranscriptionHandle.value = null
      if (didSendSuccessfully) options.pendingAttachments.value = []
    }
  }

  function handleStreamEvent(event: AiChatStreamEvent) {
    switch (event.type) {
      case 'session.upsert':
        markActiveSendAttemptAsStarted()
        updateSession(event.session)
        break
      case 'message.user':
      case 'message.assistant':
      case 'message.completed':
        markActiveSendAttemptAsStarted()
        updateSession(event.session)
        if (event.message) {
          if (isStreamSessionVisible(event.message)) options.upsertMessage(event.message)
          const attempt = activeSendAttempt.value
          if (
            event.type === 'message.completed' &&
            event.message.role === 'assistant' &&
            attempt?.shouldAutoPlaySpeech &&
            isStreamSessionVisible(event.message)
          ) {
            activeSendAttempt.value = { ...attempt, shouldAutoPlaySpeech: false }
            void options.autoPlayAssistantSpeech(event.message)
          }
          if (event.type === 'message.completed' && event.message.role === 'assistant') {
            const sessionHandle = getMessageSessionHandle(event.message) ?? attempt?.sessionHandle
            if (sessionHandle != null) options.onSessionResponseFinished(sessionHandle)
          }
        }
        break
      case 'message.delta':
        if (event.handle != null && isStreamSessionVisible()) {
          options.appendMessageDelta(event.handle, event.delta ?? '')
        }
        break
      case 'tool.action.pending':
        if (event.action && isStreamSessionVisible()) upsertToolAction(event.action)
        break
      case 'error':
        handleChatRequestFailure(event.messageText ?? event.type)
        break
    }
  }

  function updateSession(session?: AiChatSessionItem) {
    if (!session) return
    const activeHandle = options.activeSession.value?.handle ?? null
    const previousAttemptHandle = activeSendAttempt.value?.sessionHandle ?? null
    if (session.handle != null && activeSendAttempt.value && previousAttemptHandle == null) {
      activeSendAttempt.value.sessionHandle = session.handle
      options.onSessionResponseStarted(session.handle)
    }
    options.replaceSession(session)
    if (
      session.handle != null &&
      (activeHandle === session.handle || (activeHandle == null && previousAttemptHandle == null))
    ) {
      options.activeSession.value = session
    }
  }

  function isStreamSessionVisible(message?: AiChatMessageItem) {
    const sessionHandle = getMessageSessionHandle(message) ?? activeSendAttempt.value?.sessionHandle
    return sessionHandle == null || options.activeSession.value?.handle === sessionHandle
  }

  function getMessageSessionHandle(message?: AiChatMessageItem) {
    if (!message) return null
    return typeof message.session === 'number' ? message.session : (message.session?.handle ?? null)
  }

  async function confirmToolAction(action: AiChatToolActionItem) {
    await submitToolAction(action, (handle) => ApiAiService.confirmToolAction(handle), true)
  }

  async function rejectToolAction(action: AiChatToolActionItem) {
    await submitToolAction(action, (handle) => ApiAiService.rejectToolAction(handle), false)
  }

  async function submitToolAction(
    action: AiChatToolActionItem,
    submit: (handle: number) => Promise<AiChatToolActionItem>,
    includeFollowUp: boolean,
  ) {
    if (!action.handle || activeToolActionHandles.value[action.handle]) return
    const handle = action.handle
    activeToolActionHandles.value = { ...activeToolActionHandles.value, [handle]: true }

    try {
      const updatedAction = await submit(handle)
      upsertToolAction(updatedAction)
      if (includeFollowUp) upsertFollowUpToolAction(updatedAction)
    } catch {
      // The API service already reports the localized request error. Keep the
      // component event handler settled so Vue does not emit an unhandled
      // promise warning and the user can retry or reject the pending action.
    } finally {
      const remainingActions = { ...activeToolActionHandles.value }
      delete remainingActions[handle]
      activeToolActionHandles.value = remainingActions
    }
  }

  function upsertToolAction(action: AiChatToolActionItem) {
    const messageHandle =
      typeof action.message === 'number'
        ? action.message
        : action.message && typeof action.message === 'object'
          ? action.message.handle
          : null
    if (!messageHandle) return

    const message = options.messages.value.find((item) => item.handle === messageHandle)
    if (!message) return

    const responsePayload =
      message.responsePayload && typeof message.responsePayload === 'object'
        ? { ...(message.responsePayload as Record<string, unknown>) }
        : {}
    const existingActions = Array.isArray(responsePayload.pendingToolActions)
      ? responsePayload.pendingToolActions.filter(isToolAction)
      : []
    const actionIndex = existingActions.findIndex((item) => item.handle === action.handle)
    if (actionIndex >= 0) existingActions.splice(actionIndex, 1, action)
    else existingActions.push(action)
    responsePayload.pendingToolActions = existingActions
    message.responsePayload = responsePayload
  }

  function upsertFollowUpToolAction(action: AiChatToolActionItem) {
    const payload =
      action.resultPayload && typeof action.resultPayload === 'object'
        ? (action.resultPayload as Record<string, unknown>)
        : null
    if (isToolAction(payload?.followUpToolAction)) {
      upsertToolAction(payload.followUpToolAction)
    }
  }

  function markActiveSendAttemptAsStarted() {
    if (activeSendAttempt.value) activeSendAttempt.value.receivedServerEvents = true
  }

  function handleChatRequestFailure(error: unknown, reportToMessageCenter = true) {
    const messageKey = normalizeAiChatErrorMessage(error)
    if (reportToMessageCenter) options.reportMessage('error', messageKey, '', 'aiChat')

    const attemptSessionHandle = activeSendAttempt.value?.sessionHandle ?? null
    if (
      activeSendAttempt.value?.receivedServerEvents &&
      attemptSessionHandle != null &&
      options.activeSession.value?.handle === attemptSessionHandle
    ) {
      void options.loadMessages(attemptSessionHandle).catch(() => undefined)
      return
    }

    if (
      attemptSessionHandle == null ||
      options.activeSession.value?.handle === attemptSessionHandle
    ) {
      options.appendLocalFailedExchange({
        content: activeSendAttempt.value?.content ?? '',
        errorMessage: messageKey,
        personHandle: options.currentPersonHandle(),
        sessionHandle: attemptSessionHandle ?? 0,
      })
    }
  }

  function abortStream() {
    streamAbortController.value?.abort()
    streamAbortController.value = null
  }

  return {
    isSending,
    activeToolActionHandles,
    sendMessage,
    confirmToolAction,
    rejectToolAction,
    abortStream,
  }
}
