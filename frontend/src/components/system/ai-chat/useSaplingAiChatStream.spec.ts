import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { AiChatMessageItem, AiChatSessionItem, AiChatToolActionItem } from '@/entity/entity'
import { useSaplingAiChatStream } from './useSaplingAiChatStream'

const api = vi.hoisted(() => ({
  streamMessage: vi.fn(),
  confirmToolAction: vi.fn(),
  rejectToolAction: vi.fn(),
  queueInput: vi.fn(),
  listQueuedInputs: vi.fn().mockResolvedValue([]),
  cancelQueuedInput: vi.fn(),
}))

vi.mock('@/services/api.ai.service', () => ({ default: api }))

function setup() {
  const activeSession = ref<AiChatSessionItem | null>(null)
  const messages = ref<AiChatMessageItem[]>([])
  const pendingAttachments = ref([
    { handle: 17, filename: 'data.csv', rowCount: 2, headerCount: 3, status: 'analyzed' },
  ])
  const callbacks = {
    reportMessage: vi.fn(),
    upsertMessage: vi.fn((message: AiChatMessageItem) => messages.value.push(message)),
    appendMessageDelta: vi.fn(),
    appendLocalFailedExchange: vi.fn(),
    replaceSession: vi.fn(),
    loadMessages: vi.fn(async () => undefined),
    autoPlayAssistantSpeech: vi.fn(async () => undefined),
    onSessionResponseFinished: vi.fn(),
  }
  const state = useSaplingAiChatStream({
    route: {
      name: 'tickets',
      params: {},
      query: { status: 'open' },
      fullPath: '/tickets?status=open',
    } as unknown as RouteLocationNormalizedLoaded,
    isOpen: ref(false),
    activeSession,
    messages,
    draftMessage: ref('Analyze this file'),
    canSendMessage: ref(true),
    selectedProviderHandle: ref('openai'),
    selectedModelHandle: ref('gpt'),
    selectedAgentHandle: ref('songbird'),
    selectedPlaybookHandle: ref(null),
    selectedContextEntityHandle: ref('ticket'),
    selectedContextRecordHandle: ref('42'),
    activeTranscriptionHandle: ref(9),
    pendingAttachments,
    defaultAttachmentPrompt: () => 'Analyze attachment',
    currentPersonHandle: () => 5,
    ...callbacks,
  })
  return { state, callbacks, activeSession, messages, pendingAttachments }
}

describe('useSaplingAiChatStream', () => {
  beforeEach(() => vi.clearAllMocks())

  it('streams the selected runtime/context and clears attachments after success', async () => {
    const session = { handle: 22, title: 'Imported data' } as AiChatSessionItem
    const assistantMessage = {
      handle: 32,
      role: 'assistant',
      status: 'completed',
      content: 'Done',
    } as AiChatMessageItem
    api.streamMessage.mockImplementation(
      async (_payload: unknown, onEvent: (event: Record<string, unknown>) => void) => {
        onEvent({ type: 'session.upsert', session })
        onEvent({ type: 'message.completed', message: assistantMessage, session })
      },
    )
    const testState = setup()

    await testState.state.sendMessage()

    expect(api.streamMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Analyze this file',
        providerHandle: 'openai',
        modelHandle: 'gpt',
        agentHandle: 'songbird',
        contextEntityHandle: 'ticket',
        contextRecordHandle: '42',
        transcriptionHandle: 9,
        attachmentHandles: [17],
      }),
      expect.any(Function),
      expect.any(AbortSignal),
    )
    expect(testState.callbacks.replaceSession).toHaveBeenCalledWith(session)
    expect(testState.callbacks.onSessionResponseFinished).toHaveBeenCalledWith(22)
    expect(testState.callbacks.upsertMessage).toHaveBeenCalledWith(assistantMessage)
    expect(testState.callbacks.autoPlayAssistantSpeech).toHaveBeenCalledWith(assistantMessage)
    expect(testState.pendingAttachments.value).toEqual([])
    expect(testState.state.isSending.value).toBe(false)
  })

  it('shows a localized interruption message when the response stream is lost', async () => {
    api.streamMessage.mockRejectedValue(new Error('network connection terminated'))
    const testState = setup()

    await testState.state.sendMessage()

    expect(testState.callbacks.reportMessage).toHaveBeenCalledWith(
      'error',
      'aiChat.streamFailed',
      '',
      'aiChat',
    )
    expect(testState.callbacks.appendLocalFailedExchange).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Analyze this file',
        errorMessage: 'aiChat.streamFailed',
      }),
    )
  })

  it('silently resumes from persisted activity when an established stream is lost', async () => {
    const session = {
      handle: 22,
      title: 'Long answer',
      responseStatus: 'responding',
    } as AiChatSessionItem
    api.streamMessage.mockImplementation(
      async (_payload: unknown, onEvent: (event: Record<string, unknown>) => void) => {
        onEvent({ type: 'session.upsert', session })
        throw new Error('network connection terminated')
      },
    )
    const testState = setup()

    await testState.state.sendMessage()

    expect(testState.callbacks.reportMessage).not.toHaveBeenCalled()
    expect(testState.callbacks.appendLocalFailedExchange).not.toHaveBeenCalled()
    expect(testState.callbacks.loadMessages).toHaveBeenCalledWith(22)
  })

  it('keeps streaming activity in its source session when another chat is selected', async () => {
    const sourceSession = { handle: 22, title: 'Long answer' } as AiChatSessionItem
    const otherSession = { handle: 23, title: 'Other chat' } as AiChatSessionItem
    const assistantMessage = {
      handle: 32,
      session: 22,
      role: 'assistant',
      status: 'completed',
      content: 'Done',
    } as AiChatMessageItem
    const testState = setup()
    api.streamMessage.mockImplementation(
      async (_payload: unknown, onEvent: (event: Record<string, unknown>) => void) => {
        onEvent({ type: 'session.upsert', session: sourceSession })
        testState.activeSession.value = otherSession
        onEvent({ type: 'message.delta', handle: 32, delta: 'Done' })
        onEvent({ type: 'message.completed', message: assistantMessage, session: sourceSession })
      },
    )

    await testState.state.sendMessage()

    expect(testState.activeSession.value).toEqual(otherSession)
    expect(testState.callbacks.appendMessageDelta).not.toHaveBeenCalled()
    expect(testState.callbacks.upsertMessage).not.toHaveBeenCalled()
    expect(testState.callbacks.onSessionResponseFinished).toHaveBeenCalledWith(22)
  })

  it('upserts confirmed actions and their follow-up action into the source message', async () => {
    const initialAction = {
      handle: 7,
      message: 44,
      serverName: 'sapling',
      toolName: 'generic_create',
      status: 'pending',
    } as AiChatToolActionItem
    const followUpAction = {
      handle: 8,
      message: 44,
      serverName: 'sapling',
      toolName: 'generic_update',
      status: 'pending',
    } as AiChatToolActionItem
    const confirmedAction = {
      ...initialAction,
      status: 'executed',
      resultPayload: { followUpToolAction: followUpAction },
    } as AiChatToolActionItem
    api.confirmToolAction.mockResolvedValue(confirmedAction)
    const testState = setup()
    testState.messages.value = [
      {
        handle: 44,
        responsePayload: { pendingToolActions: [initialAction] },
      } as AiChatMessageItem,
    ]

    await testState.state.confirmToolAction(initialAction)

    expect(api.confirmToolAction).toHaveBeenCalledWith(7)
    expect(testState.messages.value[0]?.responsePayload).toMatchObject({
      pendingToolActions: [confirmedAction, followUpAction],
    })
    expect(testState.state.activeToolActionHandles.value).toEqual({})
  })

  it('settles failed tool-action requests and clears their loading state', async () => {
    const action = {
      handle: 7,
      message: 44,
      serverName: 'sapling',
      toolName: 'generic_update',
      status: 'pending',
    } as AiChatToolActionItem
    api.confirmToolAction.mockRejectedValue(new Error('request failed'))
    const testState = setup()

    await expect(testState.state.confirmToolAction(action)).resolves.toBeUndefined()

    expect(api.confirmToolAction).toHaveBeenCalledWith(7)
    expect(testState.state.activeToolActionHandles.value).toEqual({})
  })

  it('queues Enter submissions while a response is active and supports steer priority', async () => {
    const testState = setup()
    testState.activeSession.value = {
      handle: 22,
      title: 'Active',
      responseStatus: 'responding',
    } as AiChatSessionItem
    api.queueInput.mockResolvedValue({ handle: 91, mode: 'queue', status: 'queued' })
    api.listQueuedInputs.mockResolvedValue([
      {
        handle: 91,
        sessionHandle: 22,
        mode: 'queue',
        status: 'queued',
        content: 'Analyze this file',
      },
    ])

    await testState.state.sendMessage()

    expect(api.streamMessage).not.toHaveBeenCalled()
    expect(api.queueInput).toHaveBeenCalledWith(
      expect.objectContaining({ sessionHandle: 22, mode: 'queue', content: 'Analyze this file' }),
    )
    expect(testState.state.queuedInputs.value).toHaveLength(1)

    testState.state.queuedInputs.value = []
    api.queueInput.mockClear()
    const second = setup()
    second.activeSession.value = testState.activeSession.value
    await second.state.steerMessage()
    expect(api.queueInput).toHaveBeenCalledWith(expect.objectContaining({ mode: 'steer' }))
  })

  it('applies streamed reasoning summaries and localized progress steps', async () => {
    const testState = setup()
    const assistant = {
      handle: 32,
      session: 22,
      role: 'assistant',
      status: 'streaming',
      content: '',
      responsePayload: { progress: { status: 'running', reasoningSummary: '', steps: [] } },
    } as AiChatMessageItem
    api.streamMessage.mockImplementation(
      async (_payload: unknown, onEvent: (event: Record<string, unknown>) => void) => {
        onEvent({ type: 'session.upsert', session: { handle: 22 } })
        onEvent({ type: 'message.assistant', message: assistant })
        onEvent({ type: 'progress.delta', handle: 32, delta: 'Prüfe Kontext.' })
        onEvent({
          type: 'progress.step',
          handle: 32,
          step: { id: 'tool-1', labelKey: 'aiChat.progressToolExecution', status: 'running' },
        })
      },
    )

    await testState.state.sendMessage()

    expect(assistant.responsePayload).toMatchObject({
      progress: {
        reasoningSummary: 'Prüfe Kontext.',
        steps: [expect.objectContaining({ id: 'tool-1' })],
      },
    })
  })
})
