import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AiAgentItem,
  AiChatSessionItem,
  AiProviderModelItem,
  AiProviderTypeItem,
} from '@/entity/entity'
import type { SaplingAiPreferences } from '@/services/ai-preferences.service'
import { useSaplingAiChatRuntimeCatalog } from './useSaplingAiChatRuntimeCatalog'

const api = vi.hoisted(() => ({
  listProviders: vi.fn(),
  listModels: vi.fn(),
  listAgents: vi.fn(),
  listTranscriptionProviders: vi.fn(),
  listTranscriptionModels: vi.fn(),
  listSpeechProviders: vi.fn(),
  listSpeechModels: vi.fn(),
}))

vi.mock('@/services/api.ai.service', () => ({ default: api }))

const providers = [
  { handle: 'lm-studio', title: 'LM Studio' },
  { handle: 'ollama', title: 'Ollama' },
] as unknown as AiProviderTypeItem[]

const models = [
  {
    handle: 'lm-studio-gpt-oss-20b',
    title: 'GPT OSS 20B',
    provider: 'lm-studio',
    isDefault: true,
  },
  {
    handle: 'ollama-gemma4-e4b',
    title: 'Gemma 4 E4B',
    provider: 'ollama',
    isDefault: false,
  },
] as unknown as AiProviderModelItem[]

const agents = [
  {
    handle: 'songbird',
    title: 'Songbird',
    provider: 'lm-studio',
    model: 'lm-studio-gpt-oss-20b',
    isDefault: true,
    playbooks: [],
    allowedInternalTools: [],
  },
] as unknown as AiAgentItem[]

function createPreferences(overrides: Partial<SaplingAiPreferences> = {}): SaplingAiPreferences {
  return {
    chatProviderHandle: null,
    chatModelHandle: null,
    transcriptionProviderHandle: null,
    transcriptionModelHandle: null,
    speechProviderHandle: null,
    speechModelHandle: null,
    ...overrides,
  }
}

describe('useSaplingAiChatRuntimeCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listProviders.mockResolvedValue(providers)
    api.listModels.mockResolvedValue(models)
    api.listAgents.mockResolvedValue(agents)
    api.listTranscriptionProviders.mockResolvedValue([])
    api.listTranscriptionModels.mockResolvedValue([])
    api.listSpeechProviders.mockResolvedValue([])
    api.listSpeechModels.mockResolvedValue([])
  })

  afterEach(() => vi.useRealTimers())

  it('prefers the saved chat runtime over the default agent runtime for new chats', async () => {
    const runtime = useSaplingAiChatRuntimeCatalog(
      ref(null),
      createPreferences({
        chatProviderHandle: 'ollama',
        chatModelHandle: 'ollama-gemma4-e4b',
      }),
    )

    await runtime.loadRuntimeCatalogs()

    expect(runtime.selectedAgentHandle.value).toBe('songbird')
    expect(runtime.selectedProviderHandle.value).toBe('ollama')
    expect(runtime.selectedModelHandle.value).toBe('ollama-gemma4-e4b')
    expect(runtime.selectedProviderConfig.value?.title).toBe('Ollama')
    expect(runtime.selectedModelConfig.value?.title).toBe('Gemma 4 E4B')
  })

  it('keeps an existing session runtime ahead of saved preferences', async () => {
    const activeSession = ref({
      handle: 12,
      title: 'Existing chat',
      provider: 'lm-studio',
      model: 'lm-studio-gpt-oss-20b',
    } as unknown as AiChatSessionItem)
    const runtime = useSaplingAiChatRuntimeCatalog(
      activeSession,
      createPreferences({
        chatProviderHandle: 'ollama',
        chatModelHandle: 'ollama-gemma4-e4b',
      }),
    )

    await runtime.loadRuntimeCatalogs()

    expect(runtime.selectedProviderHandle.value).toBe('lm-studio')
    expect(runtime.selectedModelHandle.value).toBe('lm-studio-gpt-oss-20b')
  })

  it('falls back to the agent runtime when saved preferences are unavailable', async () => {
    const runtime = useSaplingAiChatRuntimeCatalog(
      ref(null),
      createPreferences({
        chatProviderHandle: 'missing-provider',
        chatModelHandle: 'missing-model',
      }),
    )

    await runtime.loadRuntimeCatalogs()

    expect(runtime.selectedProviderHandle.value).toBe('lm-studio')
    expect(runtime.selectedModelHandle.value).toBe('lm-studio-gpt-oss-20b')
  })

  it('retries an initially empty chat catalog before reporting no configuration', async () => {
    api.listProviders.mockResolvedValueOnce([]).mockResolvedValue(providers)
    api.listModels.mockResolvedValueOnce([]).mockResolvedValue(models)
    const runtime = useSaplingAiChatRuntimeCatalog(ref(null), createPreferences())

    await runtime.loadRuntimeCatalogs()

    expect(api.listProviders).toHaveBeenCalledTimes(2)
    expect(api.listModels).toHaveBeenCalledTimes(2)
    expect(runtime.hasConfiguredProviders.value).toBe(true)
    expect(runtime.hasLoadedRuntimeCatalog.value).toBe(true)
    expect(runtime.hasRuntimeCatalogLoadError.value).toBe(false)
  })

  it('keeps chat available when an optional speech catalog fails', async () => {
    api.listSpeechProviders.mockRejectedValue(new Error('temporary speech failure'))
    const runtime = useSaplingAiChatRuntimeCatalog(ref(null), createPreferences())

    await runtime.loadRuntimeCatalogs()

    expect(runtime.hasConfiguredProviders.value).toBe(true)
    expect(runtime.hasLoadedRuntimeCatalog.value).toBe(true)
    expect(runtime.hasRuntimeCatalogLoadError.value).toBe(false)
  })

  it('exposes a recoverable load error after both core catalog attempts fail', async () => {
    api.listProviders.mockRejectedValue(new Error('temporary provider failure'))
    const runtime = useSaplingAiChatRuntimeCatalog(ref(null), createPreferences())

    await runtime.loadRuntimeCatalogs()

    expect(api.listProviders).toHaveBeenCalledTimes(2)
    expect(runtime.hasConfiguredProviders.value).toBe(false)
    expect(runtime.hasLoadedRuntimeCatalog.value).toBe(true)
    expect(runtime.hasRuntimeCatalogLoadError.value).toBe(true)
  })

  it('leaves the loading state when a core catalog request never settles', async () => {
    vi.useFakeTimers()
    api.listProviders.mockImplementation(() => new Promise(() => undefined))
    const runtime = useSaplingAiChatRuntimeCatalog(ref(null), createPreferences())

    const loading = runtime.loadRuntimeCatalogs()
    await vi.advanceTimersByTimeAsync(13_000)
    await loading

    expect(api.listProviders).toHaveBeenCalledTimes(2)
    expect(runtime.isLoadingChatRuntimeCatalog.value).toBe(false)
    expect(runtime.hasLoadedRuntimeCatalog.value).toBe(true)
    expect(runtime.hasRuntimeCatalogLoadError.value).toBe(true)
  })
})
