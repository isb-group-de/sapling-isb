import { computed, ref, type Ref } from 'vue'
import type {
  AiAgentItem,
  AiChatSessionItem,
  AiProviderModelItem,
  AiProviderTypeItem,
} from '@/entity/entity'
import ApiAiService from '@/services/api.ai.service'
import type { SaplingAiPreferences } from '@/services/ai-preferences.service'
import { sortSelectOptions } from '@/utils/saplingSelectOptions'
import { getModelHandle, getProviderHandle, resolveRuntimeTarget } from './aiChatRuntimeTargets'

const RUNTIME_CATALOG_RETRY_DELAY_MS = 200
const RUNTIME_CATALOG_REQUEST_TIMEOUT_MS = 6000

export function useSaplingAiChatRuntimeCatalog(
  activeSession: Ref<AiChatSessionItem | null>,
  preferences: SaplingAiPreferences,
) {
  const providerConfigs = ref<AiProviderTypeItem[]>([])
  const modelConfigs = ref<AiProviderModelItem[]>([])
  const agentConfigs = ref<AiAgentItem[]>([])
  const transcriptionProviderConfigs = ref<AiProviderTypeItem[]>([])
  const transcriptionModelConfigs = ref<AiProviderModelItem[]>([])
  const speechProviderConfigs = ref<AiProviderTypeItem[]>([])
  const speechModelConfigs = ref<AiProviderModelItem[]>([])
  const preferredChatProviderHandle = ref<string | null>(preferences.chatProviderHandle)
  const preferredChatModelHandle = ref<string | null>(preferences.chatModelHandle)
  const selectedProviderHandle = ref<string | null>(preferences.chatProviderHandle)
  const selectedModelHandle = ref<string | null>(preferences.chatModelHandle)
  const selectedAgentHandle = ref<string | null>(null)
  const selectedPlaybookHandle = ref<string | null>(null)
  const selectedTranscriptionProviderHandle = ref<string | null>(
    preferences.transcriptionProviderHandle,
  )
  const selectedTranscriptionModelHandle = ref<string | null>(preferences.transcriptionModelHandle)
  const selectedSpeechProviderHandle = ref<string | null>(preferences.speechProviderHandle)
  const selectedSpeechModelHandle = ref<string | null>(preferences.speechModelHandle)
  const loading = ref({
    agents: false,
    providers: false,
    models: false,
    transcriptionProviders: false,
    transcriptionModels: false,
    speechProviders: false,
    speechModels: false,
  })
  const hasLoadedRuntimeCatalog = ref(false)
  const hasRuntimeCatalogLoadError = ref(false)
  let runtimeCatalogPromise: Promise<void> | null = null

  const isLoadingRuntimeCatalog = computed(() => Object.values(loading.value).some(Boolean))
  const isLoadingChatRuntimeCatalog = computed(
    () => loading.value.providers || loading.value.models,
  )
  const hasConfiguredProviders = computed(
    () => providerConfigs.value.length > 0 && modelConfigs.value.length > 0,
  )
  const hasConfiguredTranscriptionProviders = computed(
    () =>
      transcriptionProviderConfigs.value.length > 0 && transcriptionModelConfigs.value.length > 0,
  )
  const hasConfiguredSpeechProviders = computed(
    () => speechProviderConfigs.value.length > 0 && speechModelConfigs.value.length > 0,
  )
  const canSendMessage = computed(
    () =>
      hasConfiguredProviders.value && !!selectedProviderHandle.value && !!selectedModelHandle.value,
  )
  const isVoiceOutputAvailable = computed(
    () => typeof Audio !== 'undefined' && hasConfiguredSpeechProviders.value,
  )
  const agentOptions = computed(() =>
    sortSelectOptions(agentConfigs.value, (agent) => agent.title).map((agent) => ({
      label: agent.title,
      value: agent.handle,
    })),
  )
  const selectedAgentConfig = computed(
    () => agentConfigs.value.find((agent) => agent.handle === selectedAgentHandle.value) ?? null,
  )
  const selectedProviderConfig = computed(
    () =>
      providerConfigs.value.find((provider) => provider.handle === selectedProviderHandle.value) ??
      null,
  )
  const selectedModelConfig = computed(
    () => modelConfigs.value.find((model) => model.handle === selectedModelHandle.value) ?? null,
  )
  const playbookOptions = computed(() =>
    sortSelectOptions(selectedAgentConfig.value?.playbooks ?? [], (playbook) => playbook.title).map(
      (playbook) => ({
        label: playbook.title,
        value: playbook.handle,
      }),
    ),
  )
  const canUploadImportAttachment = computed(() =>
    (selectedAgentConfig.value?.allowedInternalTools ?? []).some((tool) =>
      [
        'import_get_batch',
        'import_suggest_mapping',
        'import_match_existing_records',
        'import_configure_batch',
        'import_execute_batch',
      ].includes(tool),
    ),
  )

  function loadRuntimeCatalogs(): Promise<void> {
    if (runtimeCatalogPromise) return runtimeCatalogPromise

    const request = runRuntimeCatalogLoad()
    runtimeCatalogPromise = request
    void request.finally(() => {
      if (runtimeCatalogPromise === request) runtimeCatalogPromise = null
    })
    return request
  }

  async function runRuntimeCatalogLoad() {
    hasRuntimeCatalogLoadError.value = false

    const supplementalCatalogs = Promise.allSettled([
      loadCatalog('agents', ApiAiService.listAgents, agentConfigs, () => {
        syncSelectedAgent()
        syncSelectedPlaybook()
        syncSelectedRuntimeTarget()
      }),
      loadCatalog(
        'transcriptionProviders',
        ApiAiService.listTranscriptionProviders,
        transcriptionProviderConfigs,
        syncSelectedTranscriptionTarget,
      ),
      loadCatalog(
        'transcriptionModels',
        ApiAiService.listTranscriptionModels,
        transcriptionModelConfigs,
        syncSelectedTranscriptionTarget,
      ),
      loadCatalog(
        'speechProviders',
        ApiAiService.listSpeechProviders,
        speechProviderConfigs,
        syncSelectedSpeechTarget,
      ),
      loadCatalog(
        'speechModels',
        ApiAiService.listSpeechModels,
        speechModelConfigs,
        syncSelectedSpeechTarget,
      ),
    ])
    const [chatCatalogResult] = await Promise.allSettled([loadChatRuntimeCatalog()])

    hasRuntimeCatalogLoadError.value = chatCatalogResult.status === 'rejected'
    hasLoadedRuntimeCatalog.value = true
    await supplementalCatalogs
  }

  async function loadChatRuntimeCatalog() {
    setLoading('providers', true)
    setLoading('models', true)

    try {
      let lastError: unknown = null

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const [providers, models] = await Promise.all([
            withRuntimeCatalogTimeout(
              ApiAiService.listProviders({ suppressErrorMessage: attempt === 0 }),
            ),
            withRuntimeCatalogTimeout(
              ApiAiService.listModels(undefined, { suppressErrorMessage: attempt === 0 }),
            ),
          ])
          const shouldRetryEmptyCatalog =
            attempt === 0 && (providers.length === 0 || models.length === 0)

          if (!shouldRetryEmptyCatalog) {
            providerConfigs.value = providers
            modelConfigs.value = models
            syncSelectedRuntimeTarget()
            return
          }
        } catch (error) {
          lastError = error
          if (attempt === 1) throw error
        }

        await waitForRuntimeCatalogRetry()
      }

      if (lastError) throw lastError
    } finally {
      setLoading('providers', false)
      setLoading('models', false)
    }
  }

  async function loadCatalog<T>(
    key: keyof typeof loading.value,
    loader: () => Promise<T[]>,
    target: Ref<T[]>,
    synchronize: () => void,
  ) {
    setLoading(key, true)
    try {
      target.value = await withRuntimeCatalogTimeout(loader())
      synchronize()
    } finally {
      setLoading(key, false)
    }
  }

  function setLoading(key: keyof typeof loading.value, value: boolean) {
    loading.value = { ...loading.value, [key]: value }
  }

  function applyPreferences(nextPreferences: SaplingAiPreferences) {
    preferredChatProviderHandle.value = nextPreferences.chatProviderHandle
    preferredChatModelHandle.value = nextPreferences.chatModelHandle
    selectedProviderHandle.value = nextPreferences.chatProviderHandle
    selectedModelHandle.value = nextPreferences.chatModelHandle
    selectedTranscriptionProviderHandle.value = nextPreferences.transcriptionProviderHandle
    selectedTranscriptionModelHandle.value = nextPreferences.transcriptionModelHandle
    selectedSpeechProviderHandle.value = nextPreferences.speechProviderHandle
    selectedSpeechModelHandle.value = nextPreferences.speechModelHandle
    syncAllTargets()
  }

  function updateSelectedAgent(value: string) {
    if (activeSession.value?.handle) return
    selectedAgentHandle.value = value || null
    syncSelectedPlaybook()
    syncSelectedRuntimeTarget()
  }

  function updateSelectedPlaybook(value: string | null) {
    selectedPlaybookHandle.value = value || null
  }

  function applyPromptRuntime(agentHandle?: string, playbookHandle?: string) {
    const requestedAgent = agentHandle?.trim()
    const requestedPlaybook = playbookHandle?.trim()

    if (requestedAgent && agentConfigs.value.some((agent) => agent.handle === requestedAgent)) {
      selectedAgentHandle.value = requestedAgent
      syncSelectedRuntimeTarget()
    }

    if (
      requestedPlaybook &&
      playbookOptions.value.some((playbook) => playbook.value === requestedPlaybook)
    ) {
      selectedPlaybookHandle.value = requestedPlaybook
    } else {
      syncSelectedPlaybook()
    }
  }

  function syncAllTargets() {
    syncSelectedRuntimeTarget()
    syncSelectedTranscriptionTarget()
    syncSelectedSpeechTarget()
  }

  function syncSelectedRuntimeTarget() {
    const selectedAgent = agentConfigs.value.find(
      (agent) => agent.handle === selectedAgentHandle.value,
    )
    const sessionProviderHandle = getProviderHandle(activeSession.value?.provider)
    const sessionModelHandle = getModelHandle(activeSession.value?.model)
    const preferredProviderHandle = activeSession.value ? null : preferredChatProviderHandle.value
    const preferredModelHandle = activeSession.value ? null : preferredChatModelHandle.value
    const hasPreferredRuntime =
      hasAvailableProvider(preferredProviderHandle, providerConfigs.value) ||
      hasAvailableModel(preferredModelHandle, modelConfigs.value)
    const target = resolveRuntimeTarget({
      providerConfigs: providerConfigs.value,
      modelConfigs: modelConfigs.value,
      requestedProviderHandle:
        sessionProviderHandle ??
        (hasPreferredRuntime
          ? preferredProviderHandle
          : getProviderHandle(selectedAgent?.provider)),
      requestedModelHandle:
        sessionModelHandle ??
        (hasPreferredRuntime ? preferredModelHandle : getModelHandle(selectedAgent?.model)),
      preferredModelHandle: preferredModelHandle ?? selectedModelHandle.value,
    })
    selectedProviderHandle.value = target.providerHandle
    selectedModelHandle.value = target.modelHandle
  }

  function syncSelectedAgent() {
    const sessionAgentHandle = getAgentHandle(activeSession.value?.agent)
    const availableHandles = new Set(agentConfigs.value.map((agent) => agent.handle))

    if (sessionAgentHandle && availableHandles.has(sessionAgentHandle)) {
      selectedAgentHandle.value = sessionAgentHandle
    } else if (!selectedAgentHandle.value || !availableHandles.has(selectedAgentHandle.value)) {
      selectedAgentHandle.value =
        agentConfigs.value.find((agent) => agent.isDefault)?.handle ??
        agentConfigs.value[0]?.handle ??
        null
    }
  }

  function syncSelectedPlaybook() {
    const availableHandles = new Set(playbookOptions.value.map((playbook) => playbook.value))
    if (!selectedPlaybookHandle.value || !availableHandles.has(selectedPlaybookHandle.value)) {
      selectedPlaybookHandle.value = null
    }
  }

  function syncSelectedTranscriptionTarget() {
    const target = resolveRuntimeTarget({
      providerConfigs: transcriptionProviderConfigs.value,
      modelConfigs: transcriptionModelConfigs.value,
      requestedProviderHandle: selectedTranscriptionProviderHandle.value,
      requestedModelHandle: selectedTranscriptionModelHandle.value,
      preferredModelHandle: selectedTranscriptionModelHandle.value,
    })
    selectedTranscriptionProviderHandle.value = target.providerHandle
    selectedTranscriptionModelHandle.value = target.modelHandle
  }

  function syncSelectedSpeechTarget() {
    const target = resolveRuntimeTarget({
      providerConfigs: speechProviderConfigs.value,
      modelConfigs: speechModelConfigs.value,
      requestedProviderHandle: selectedSpeechProviderHandle.value,
      requestedModelHandle: selectedSpeechModelHandle.value,
      preferredModelHandle: selectedSpeechModelHandle.value,
    })
    selectedSpeechProviderHandle.value = target.providerHandle
    selectedSpeechModelHandle.value = target.modelHandle
  }

  return {
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
    isLoadingRuntimeCatalog,
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
  }
}

function waitForRuntimeCatalogRetry() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, RUNTIME_CATALOG_RETRY_DELAY_MS))
}

function withRuntimeCatalogTimeout<T>(request: Promise<T>) {
  let timeoutHandle: number | null = null
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = window.setTimeout(
      () => reject(new Error('ai.chat.runtimeCatalogTimeout')),
      RUNTIME_CATALOG_REQUEST_TIMEOUT_MS,
    )
  })

  return Promise.race([request, timeout]).finally(() => {
    if (timeoutHandle != null) window.clearTimeout(timeoutHandle)
  })
}

function getAgentHandle(agent?: AiAgentItem | string | null) {
  return agent ? (typeof agent === 'string' ? agent : agent.handle) : null
}

function getPlaybookHandle(playbook?: { handle?: string | null } | string | null) {
  return playbook ? (typeof playbook === 'string' ? playbook : (playbook.handle ?? null)) : null
}

function hasAvailableProvider(
  providerHandle: string | null | undefined,
  providerConfigs: AiProviderTypeItem[],
) {
  return !!providerHandle && providerConfigs.some((provider) => provider.handle === providerHandle)
}

function hasAvailableModel(
  modelHandle: string | null | undefined,
  modelConfigs: AiProviderModelItem[],
) {
  return !!modelHandle && modelConfigs.some((model) => model.handle === modelHandle)
}
