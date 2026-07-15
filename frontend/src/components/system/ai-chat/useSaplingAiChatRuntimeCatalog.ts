import { computed, ref, type Ref } from 'vue'
import type {
  AiAgentItem,
  AiChatSessionItem,
  AiProviderModelItem,
  AiProviderTypeItem,
} from '@/entity/entity'
import ApiAiService from '@/services/api.ai.service'
import type { SaplingAiPreferences } from '@/services/ai-preferences.service'
import { getModelHandle, getProviderHandle, resolveRuntimeTarget } from './aiChatRuntimeTargets'

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

  const isLoadingRuntimeCatalog = computed(() => Object.values(loading.value).some(Boolean))
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
    agentConfigs.value.map((agent) => ({ label: agent.title, value: agent.handle })),
  )
  const selectedAgentConfig = computed(
    () => agentConfigs.value.find((agent) => agent.handle === selectedAgentHandle.value) ?? null,
  )
  const playbookOptions = computed(() =>
    (selectedAgentConfig.value?.playbooks ?? []).map((playbook) => ({
      label: playbook.title,
      value: playbook.handle,
    })),
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

  async function loadRuntimeCatalogs() {
    await Promise.all([
      loadCatalog(
        'providers',
        ApiAiService.listProviders,
        providerConfigs,
        syncSelectedRuntimeTarget,
      ),
      loadCatalog('models', ApiAiService.listModels, modelConfigs, syncSelectedRuntimeTarget),
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
  }

  async function loadCatalog<T>(
    key: keyof typeof loading.value,
    loader: () => Promise<T[]>,
    target: Ref<T[]>,
    synchronize: () => void,
  ) {
    loading.value = { ...loading.value, [key]: true }
    try {
      target.value = await loader()
      synchronize()
    } finally {
      loading.value = { ...loading.value, [key]: false }
    }
  }

  function applyPreferences(nextPreferences: SaplingAiPreferences) {
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
    const target = resolveRuntimeTarget({
      providerConfigs: providerConfigs.value,
      modelConfigs: modelConfigs.value,
      requestedProviderHandle:
        getProviderHandle(activeSession.value?.provider) ??
        getProviderHandle(selectedAgent?.provider),
      requestedModelHandle:
        getModelHandle(activeSession.value?.model) ?? getModelHandle(selectedAgent?.model),
      preferredModelHandle: selectedModelHandle.value,
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
    selectedProviderHandle,
    selectedModelHandle,
    selectedAgentHandle,
    selectedPlaybookHandle,
    selectedTranscriptionProviderHandle,
    selectedTranscriptionModelHandle,
    selectedSpeechProviderHandle,
    selectedSpeechModelHandle,
    isLoadingRuntimeCatalog,
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

function getAgentHandle(agent?: AiAgentItem | string | null) {
  return agent ? (typeof agent === 'string' ? agent : agent.handle) : null
}

function getPlaybookHandle(playbook?: { handle?: string | null } | string | null) {
  return playbook ? (typeof playbook === 'string' ? playbook : (playbook.handle ?? null)) : null
}
