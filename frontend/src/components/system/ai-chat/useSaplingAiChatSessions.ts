import { ref, type Ref } from 'vue'
import type { AiChatMessageItem, AiChatSessionItem } from '@/entity/entity'
import ApiAiService from '@/services/api.ai.service'

const MESSAGE_PAGE_SIZE = 100

interface SaplingAiChatSessionOptions {
  activeSession: Ref<AiChatSessionItem | null>
  messages: Ref<AiChatMessageItem[]>
  hasMoreMessages: Ref<boolean>
  nextMessageBeforeSequence: Ref<number | null>
  selectedPlaybookHandle: Ref<string | null>
  resetMessageWindow: () => void
  mergeMessages: (
    olderMessages: AiChatMessageItem[],
    existingMessages: AiChatMessageItem[],
  ) => AiChatMessageItem[]
  syncSelectedAgent: () => void
  syncSelectedPlaybook: () => void
  getPlaybookHandle: (playbook?: { handle?: string | null } | string | null) => string | null
  onActiveSessionArchived: () => void
}

export function useSaplingAiChatSessions(options: SaplingAiChatSessionOptions) {
  const sessions = ref<AiChatSessionItem[]>([])
  const includeArchived = ref(false)
  const isLoadingSessions = ref(false)
  const isLoadingMessages = ref(false)
  const isLoadingOlderMessages = ref(false)
  const editingSessionHandle = ref<number | null>(null)
  const editingSessionTitle = ref('')

  async function reloadSessions() {
    isLoadingSessions.value = true

    try {
      sessions.value = await ApiAiService.listSessions(includeArchived.value)

      if (!options.activeSession.value?.handle) return
      const matchedSession = sessions.value.find(
        (session) => session.handle === options.activeSession.value?.handle,
      )
      options.activeSession.value = matchedSession ?? null

      if (matchedSession) {
        options.syncSelectedAgent()
        options.selectedPlaybookHandle.value = options.getPlaybookHandle(matchedSession.playbook)
        options.syncSelectedPlaybook()
        await loadMessages(matchedSession.handle)
      } else {
        options.messages.value = []
        options.resetMessageWindow()
      }
    } finally {
      isLoadingSessions.value = false
    }
  }

  async function loadMessages(
    sessionHandle?: number | null,
    requestOptions?: { beforeSequence?: number | null; prepend?: boolean },
  ) {
    if (!sessionHandle) {
      options.messages.value = []
      options.resetMessageWindow()
      return
    }

    const isPrepending = requestOptions?.prepend === true
    if (isPrepending) isLoadingOlderMessages.value = true
    else isLoadingMessages.value = true

    try {
      const response = await ApiAiService.listMessages(sessionHandle, {
        limit: MESSAGE_PAGE_SIZE,
        beforeSequence: requestOptions?.beforeSequence ?? undefined,
      })
      options.messages.value = isPrepending
        ? options.mergeMessages(response.data, options.messages.value)
        : response.data
      options.hasMoreMessages.value = response.meta.hasMore
      options.nextMessageBeforeSequence.value = response.meta.nextBeforeSequence
    } finally {
      if (isPrepending) isLoadingOlderMessages.value = false
      else isLoadingMessages.value = false
    }
  }

  async function loadOlderMessages() {
    if (
      !options.activeSession.value?.handle ||
      !options.hasMoreMessages.value ||
      options.nextMessageBeforeSequence.value == null ||
      isLoadingOlderMessages.value
    ) {
      return
    }

    try {
      await loadMessages(options.activeSession.value.handle, {
        beforeSequence: options.nextMessageBeforeSequence.value,
        prepend: true,
      })
    } catch {
      // The API service already reports the error.
    }
  }

  async function updateIncludeArchived(value: boolean) {
    includeArchived.value = value
    await reloadSessions()
  }

  function beginRename(session: AiChatSessionItem) {
    editingSessionHandle.value = session.handle ?? null
    editingSessionTitle.value = session.title
  }

  async function saveSessionTitle(session: AiChatSessionItem) {
    const nextTitle = editingSessionTitle.value.trim()

    if (!session.handle || !nextTitle) {
      editingSessionHandle.value = null
      return
    }

    const updatedSession = await ApiAiService.updateSession(session.handle, { title: nextTitle })
    replaceSession(updatedSession)
    if (options.activeSession.value?.handle === updatedSession.handle) {
      options.activeSession.value = updatedSession
    }
    editingSessionHandle.value = null
  }

  async function toggleArchive(session: AiChatSessionItem) {
    if (!session.handle) return
    const updatedSession = await ApiAiService.updateSession(session.handle, {
      isArchived: !session.isArchived,
    })
    replaceSession(updatedSession)

    if (!includeArchived.value && updatedSession.isArchived) {
      sessions.value = sessions.value.filter((item) => item.handle !== updatedSession.handle)
      if (options.activeSession.value?.handle === updatedSession.handle) {
        options.onActiveSessionArchived()
      }
    } else if (options.activeSession.value?.handle === updatedSession.handle) {
      options.activeSession.value = updatedSession
    }
  }

  function replaceSession(session: AiChatSessionItem) {
    const index = sessions.value.findIndex((item) => item.handle === session.handle)
    if (index >= 0) sessions.value.splice(index, 1, session)
    else sessions.value.unshift(session)

    sessions.value = [...sessions.value].sort((left, right) => {
      const leftDate = left.lastMessageAt || left.updatedAt || left.createdAt
      const rightDate = right.lastMessageAt || right.updatedAt || right.createdAt
      return new Date(rightDate ?? 0).getTime() - new Date(leftDate ?? 0).getTime()
    })
  }

  return {
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
    updateIncludeArchived,
    beginRename,
    saveSessionTitle,
    toggleArchive,
    replaceSession,
  }
}
