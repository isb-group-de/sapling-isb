import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  AiAgentEvaluationItem,
  AiAgentItem,
  AiAgentMemoryItem,
  AiAgentPlaybookItem,
  AiAgentRunItem,
  AiAgentVersionItem,
  AiProviderModelItem,
  AiProviderTypeItem,
  EntityItem,
  RoleItem,
  SaplingGenericItem,
} from '@/entity/entity'
import ApiAiService, { type AiMcpToolDescriptor } from '@/services/api.ai.service'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import TranslationService from '@/services/translation.service'
import type { AgentWorkbenchStats } from '@/components/ai/aiAgentBuilder.types'
import {
  createEmptyAgentDraft,
  createEmptyEvaluationDraft,
  getModelHandle,
  getNumberHandles,
  getProviderHandle,
  getStringHandles,
  mapHandlesToItems,
  toAgentDraft,
  toAgentPayload,
} from '@/components/ai/aiAgentBuilder.utils'

const KNOWLEDGE_ENTITY_HANDLES = [
  'knowledgeArticle',
  'ticket',
  'effortEstimate',
  'effortEstimatePosition',
  'salesOpportunity',
] as const

export function useAiAgentBuilder() {
  const { t } = useI18n()
  const translationService = new TranslationService()
  const activeTab = ref('profile')
  const agents = ref<AiAgentItem[]>([])
  const selectedAgent = ref<AiAgentItem | null>(null)
  const providers = ref<AiProviderTypeItem[]>([])
  const models = ref<AiProviderModelItem[]>([])
  const entities = ref<EntityItem[]>([])
  const roles = ref<RoleItem[]>([])
  const tools = ref<AiMcpToolDescriptor[]>([])
  const workbenchVersions = ref<AiAgentVersionItem[]>([])
  const workbenchPlaybooks = ref<AiAgentPlaybookItem[]>([])
  const workbenchMemories = ref<AiAgentMemoryItem[]>([])
  const workbenchRuns = ref<AiAgentRunItem[]>([])
  const workbenchEvaluations = ref<AiAgentEvaluationItem[]>([])
  const workbenchStats = ref<AgentWorkbenchStats>({})
  const draft = ref(createEmptyAgentDraft())
  const evaluationDraft = ref(createEmptyEvaluationDraft())
  const testPrompt = ref('')
  const selectedTestVersionHandle = ref<number | null>(null)
  const selectedTestPlaybookHandle = ref<string | null>(null)
  const latestTestRun = ref<AiAgentRunItem | null>(null)
  const isSaving = ref(false)
  const isRunningTest = ref(false)
  const isPageLoading = ref(true)

  const isEditingExisting = computed(() => !!selectedAgent.value?.handle)
  const activeAgentCount = computed(() => agents.value.filter((agent) => agent.isActive).length)
  const canSaveAgent = computed(
    () =>
      !!draft.value.handle.trim() &&
      !!draft.value.title.trim() &&
      !!draft.value.promptMarkdown.trim(),
  )
  const knowledgeEntityFilter = computed<FilterQuery>(() => ({
    handle: { $in: [...KNOWLEDGE_ENTITY_HANDLES] },
  }))
  const selectedAllowedEntities = computed<SaplingGenericItem[]>({
    get: () => mapHandlesToItems(draft.value.allowedEntityHandles, entities.value),
    set: (value) => {
      draft.value.allowedEntityHandles = getStringHandles(value)
    },
  })
  const selectedAllowedKnowledgeEntities = computed<SaplingGenericItem[]>({
    get: () => mapHandlesToItems(draft.value.allowedKnowledgeEntityHandles, entities.value),
    set: (value) => {
      draft.value.allowedKnowledgeEntityHandles = getStringHandles(value)
    },
  })
  const selectedRoles = computed<SaplingGenericItem[]>({
    get: () => mapHandlesToItems(draft.value.roles, roles.value),
    set: (value) => {
      draft.value.roles = getNumberHandles(value)
    },
  })
  const internalToolOptions = computed(() =>
    tools.value.filter((tool) => tool.serverName === 'sapling').map((tool) => tool.toolName),
  )
  const externalToolOptions = computed(() =>
    tools.value
      .filter((tool) => tool.serverName !== 'sapling')
      .map((tool) => `${tool.serverName}.${tool.toolName}`),
  )
  const filteredModels = computed(() =>
    draft.value.provider
      ? models.value.filter((model) => getProviderHandle(model.provider) === draft.value.provider)
      : models.value,
  )
  const versionOptions = computed(() =>
    workbenchVersions.value.map((version) => ({
      title: `v${version.version} (${version.status})`,
      value: version.handle ?? null,
    })),
  )
  const playbookOptions = computed(() =>
    workbenchPlaybooks.value.map((playbook) => ({
      title: playbook.title,
      value: playbook.handle,
    })),
  )
  const mutationModeOptions = computed(() => [
    { title: t('aiAgentBuilder.mutationConfirm'), value: 'confirm' },
    { title: t('aiAgentBuilder.mutationReadOnly'), value: 'readOnly' },
  ])

  async function loadAgents(): Promise<void> {
    agents.value = await ApiAiService.listAgents()
  }

  async function loadReferenceData(): Promise<void> {
    const [providerList, modelList, entityPage, rolePage, toolList] = await Promise.all([
      ApiAiService.listProviders(),
      ApiAiService.listModels(),
      ApiGenericService.find<EntityItem>('entity', { limit: 200 }),
      ApiGenericService.find<RoleItem>('role', { limit: 100 }),
      ApiAiService.listMcpTools(),
    ])
    providers.value = providerList
    models.value = modelList
    entities.value = entityPage.data
    roles.value = rolePage.data
    tools.value = toolList
  }

  async function loadWorkbench(agentHandle: string): Promise<void> {
    const workbench = await ApiAiService.getAgentWorkbench(agentHandle)
    workbenchVersions.value = workbench.versions
    workbenchPlaybooks.value = workbench.playbooks
    workbenchMemories.value = workbench.memories
    workbenchRuns.value = workbench.runs
    workbenchEvaluations.value = workbench.evaluations
    workbenchStats.value = workbench.stats
  }

  function resetWorkbench(): void {
    workbenchVersions.value = []
    workbenchPlaybooks.value = []
    workbenchMemories.value = []
    workbenchRuns.value = []
    workbenchEvaluations.value = []
    workbenchStats.value = {}
  }

  function selectAgent(agent: AiAgentItem | null): void {
    selectedAgent.value = agent
    draft.value = agent ? toAgentDraft(agent) : createEmptyAgentDraft()
    latestTestRun.value = null
    if (agent) void loadWorkbench(agent.handle)
    else resetWorkbench()
  }

  function startNewAgent(): void {
    selectedAgent.value = null
    draft.value = createEmptyAgentDraft()
    resetWorkbench()
    activeTab.value = 'profile'
  }

  function resetDraft(): void {
    selectAgent(selectedAgent.value)
  }

  async function saveAgent(): Promise<void> {
    if (!canSaveAgent.value) return
    isSaving.value = true
    try {
      const payload = toAgentPayload(draft.value)
      const savedAgent = isEditingExisting.value
        ? await ApiGenericService.update<AiAgentItem>('aiAgent', draft.value.handle, payload)
        : await ApiGenericService.create<AiAgentItem>('aiAgent', payload)
      await loadAgents()
      selectAgent(agents.value.find((agent) => agent.handle === savedAgent.handle) ?? savedAgent)
    } finally {
      isSaving.value = false
    }
  }

  async function createVersionFromDraft(): Promise<void> {
    if (!selectedAgent.value || !canSaveAgent.value) return
    const nextVersion =
      Math.max(0, ...workbenchVersions.value.map((version) => version.version ?? 0)) + 1
    await ApiGenericService.create<AiAgentVersionItem>('aiAgentVersion', {
      agent: selectedAgent.value.handle,
      version: nextVersion,
      status: workbenchVersions.value.length === 0 ? 'active' : 'draft',
      promptMarkdown: draft.value.promptMarkdown.trim(),
      changelog: 'Snapshot from Agent Workbench',
      provider: draft.value.provider || null,
      model: draft.value.model || null,
      allowedEntityHandles: draft.value.allowedEntityHandles,
      allowedKnowledgeEntityHandles: draft.value.allowedKnowledgeEntityHandles,
      allowedInternalTools: draft.value.allowedInternalTools,
      allowedExternalTools: draft.value.allowedExternalTools,
      activatedAt: workbenchVersions.value.length === 0 ? new Date().toISOString() : null,
    } as Partial<AiAgentVersionItem>)
    await loadWorkbench(selectedAgent.value.handle)
  }

  async function runAgentTest(): Promise<void> {
    if (!selectedAgent.value || !testPrompt.value.trim()) return
    isRunningTest.value = true
    try {
      latestTestRun.value = await ApiAiService.createAgentTestRun(selectedAgent.value.handle, {
        prompt: testPrompt.value.trim(),
        agentVersionHandle: selectedTestVersionHandle.value ?? undefined,
        playbookHandle: selectedTestPlaybookHandle.value ?? undefined,
      })
      await loadWorkbench(selectedAgent.value.handle)
    } finally {
      isRunningTest.value = false
    }
  }

  async function createEvaluation(): Promise<void> {
    if (!selectedAgent.value) return
    await ApiAiService.createAgentEvaluation(selectedAgent.value.handle, {
      title: evaluationDraft.value.title.trim(),
      prompt: evaluationDraft.value.prompt.trim(),
      expectedCriteria: evaluationDraft.value.expectedCriteria.trim() || undefined,
      agentVersionHandle: evaluationDraft.value.agentVersionHandle ?? undefined,
    })
    evaluationDraft.value = createEmptyEvaluationDraft()
    await loadWorkbench(selectedAgent.value.handle)
  }

  function getAgentSubtitle(agent: AiAgentItem): string {
    if (agent.isDefault) return t('aiAgentBuilder.defaultAgent')
    return agent.mutationMode === 'readOnly'
      ? t('aiAgentBuilder.mutationReadOnly')
      : t('aiAgentBuilder.mutationConfirm')
  }

  function formatDate(value?: Date | string | null): string {
    return value ? new Date(value).toLocaleString() : t('global.notAvailable')
  }

  onMounted(async () => {
    try {
      await Promise.all([
        translationService.prepare(
          'aiAgentBuilder',
          'aiAgent',
          'aiChatToolAction',
          'navigation',
          'global',
        ),
        loadAgents(),
        loadReferenceData(),
      ])
      selectAgent(agents.value.find((agent) => agent.isDefault) ?? agents.value[0] ?? null)
    } finally {
      isPageLoading.value = false
    }
  })

  return {
    activeAgentCount,
    activeTab,
    agents,
    canSaveAgent,
    createEvaluation,
    createVersionFromDraft,
    draft,
    evaluationDraft,
    externalToolOptions,
    filteredModels,
    formatDate,
    getAgentSubtitle,
    getModelHandle,
    getProviderHandle,
    internalToolOptions,
    isEditingExisting,
    isPageLoading,
    isRunningTest,
    isSaving,
    knowledgeEntityFilter,
    latestTestRun,
    mutationModeOptions,
    playbookOptions,
    providers,
    resetDraft,
    runAgentTest,
    saveAgent,
    selectedAgent,
    selectedAllowedEntities,
    selectedAllowedKnowledgeEntities,
    selectedRoles,
    selectedTestPlaybookHandle,
    selectedTestVersionHandle,
    selectAgent,
    startNewAgent,
    testPrompt,
    versionOptions,
    workbenchEvaluations,
    workbenchMemories,
    workbenchPlaybooks,
    workbenchRuns,
    workbenchStats,
    workbenchVersions,
  }
}
